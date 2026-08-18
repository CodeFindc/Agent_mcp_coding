package runtime

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/crypto"
	"github.com/coding-agent-platform/api/internal/mcp"
	"github.com/coding-agent-platform/api/internal/models"
	"github.com/coding-agent-platform/api/internal/projects"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"gorm.io/gorm"
)

var ErrNoActiveProject = errors.New("no active project")

type Service struct {
	db       *gorm.DB
	cfg      config.Config
	projects *projects.Service
	docker   *client.Client
	mcp      *mcp.Client
}

type StatusView struct {
	Status          models.RuntimeStatus `json:"status"`
	ActiveProjectID *uint                `json:"activeProjectId"`
	ContainerName   string               `json:"containerName"`
	LastError       string               `json:"lastError"`
	LastActiveAt    *time.Time           `json:"lastActiveAt"`
	MCPReady        bool                 `json:"mcpReady"`
}

func NewService(db *gorm.DB, cfg config.Config, projectsSvc *projects.Service) (*Service, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		// allow API to boot without docker; runtime ops will fail clearly
		cli = nil
	}
	return &Service{
		db:       db,
		cfg:      cfg,
		projects: projectsSvc,
		docker:   cli,
		mcp:      mcp.NewClient(cfg.MCPRequestTimeout),
	}, nil
}

func (s *Service) GetOrCreate(userID uint) (*models.WorkspaceRuntime, error) {
	var rt models.WorkspaceRuntime
	err := s.db.Where("user_id = ?", userID).First(&rt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		token, err := crypto.RandomToken(32)
		if err != nil {
			return nil, err
		}
		enc, err := crypto.EncryptString(s.cfg.DataEncryptionKey, token)
		if err != nil {
			return nil, err
		}
		rt = models.WorkspaceRuntime{
			UserID:        userID,
			Status:        models.RuntimeStopped,
			ContainerName: fmt.Sprintf("ctm-u%d", userID),
			MCPTokenEnc:   enc,
		}
		if err = s.db.Create(&rt).Error; err != nil {
			return nil, err
		}
		return &rt, nil
	}
	if err != nil {
		return nil, err
	}
	return &rt, nil
}

func (s *Service) Status(userID uint) (*StatusView, error) {
	rt, err := s.GetOrCreate(userID)
	if err != nil {
		return nil, err
	}
	view := &StatusView{
		Status:          rt.Status,
		ActiveProjectID: rt.ActiveProjectID,
		ContainerName:   rt.ContainerName,
		LastError:       rt.LastError,
		LastActiveAt:    rt.LastActiveAt,
	}
	if rt.Status == models.RuntimeRunning && s.docker != nil {
		token, _ := s.plainToken(rt)
		base := s.mcpURL(rt)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.mcp.Ping(ctx, base, token); err == nil {
			view.MCPReady = true
		}
	}
	return view, nil
}

func (s *Service) ActivateProject(userID, projectID uint) (*StatusView, error) {
	if _, err := s.projects.Get(userID, projectID); err != nil {
		return nil, err
	}
	rt, err := s.GetOrCreate(userID)
	if err != nil {
		return nil, err
	}
	needRestart := rt.ActiveProjectID == nil || *rt.ActiveProjectID != projectID || rt.Status == models.RuntimeRunning
	if err := s.db.Model(rt).Updates(map[string]any{
		"active_project_id": projectID,
	}).Error; err != nil {
		return nil, err
	}
	rt.ActiveProjectID = &projectID
	if needRestart {
		_ = s.Stop(userID)
		return s.Start(userID)
	}
	return s.Status(userID)
}

func (s *Service) Start(userID uint) (*StatusView, error) {
	if s.docker == nil {
		return nil, fmt.Errorf("docker client unavailable; is Docker running?")
	}
	rt, err := s.GetOrCreate(userID)
	if err != nil {
		return nil, err
	}
	if rt.ActiveProjectID == nil {
		return nil, ErrNoActiveProject
	}
	project, err := s.projects.Get(userID, *rt.ActiveProjectID)
	if err != nil {
		return nil, err
	}
	absPath, err := s.projects.AbsolutePath(project)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(absPath, 0o755); err != nil {
		return nil, err
	}

	_ = s.db.Model(rt).Updates(map[string]any{
		"status":     models.RuntimeStarting,
		"last_error": "",
	}).Error

	ctx := context.Background()
	if err := s.ensureNetwork(ctx); err != nil {
		return s.fail(rt, err)
	}
	// remove existing container with same name
	_ = s.removeContainer(ctx, rt.ContainerName)

	token, err := s.plainToken(rt)
	if err != nil {
		return s.fail(rt, err)
	}

	resp, err := s.docker.ContainerCreate(ctx, &container.Config{
		Image: s.cfg.CodingToolsImage,
		Env: []string{
			"CODING_TOOLS_MCP_WORKSPACE=/workspace",
			"CODING_TOOLS_MCP_HOST=0.0.0.0",
			"CODING_TOOLS_MCP_PORT=8765",
			"CODING_TOOLS_MCP_PERMISSION_MODE=" + s.cfg.PermissionMode,
			"CODING_TOOLS_MCP_AUTH_MODE=bearer",
			"CODING_TOOLS_MCP_AUTH_TOKEN=" + token,
			"CODING_TOOLS_MCP_GENERATE_AUTH_TOKEN=0",
		},
		Labels: map[string]string{
			"app":                       "coding-agent-platform",
			"coding-agent-platform.user": fmt.Sprintf("%d", userID),
		},
	}, &container.HostConfig{
		Binds: []string{fmt.Sprintf("%s:/workspace", absPath)},
		Resources: container.Resources{
			Memory:   2 * 1024 * 1024 * 1024,
			NanoCPUs: 2e9,
		},
		RestartPolicy: container.RestartPolicy{Name: "no"},
	}, &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			s.cfg.DockerNetwork: {},
		},
	}, nil, rt.ContainerName)
	if err != nil {
		return s.fail(rt, fmt.Errorf("create container: %w", err))
	}
	if err := s.docker.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return s.fail(rt, fmt.Errorf("start container: %w", err))
	}

	// wait for MCP
	base := fmt.Sprintf("http://%s:8765/mcp", rt.ContainerName)
	// when API runs on host, use localhost published port fallback via docker inspect + bridge IP
	endpoint := s.resolveEndpoint(ctx, resp.ID, rt.ContainerName)
	_ = base
	ready := false
	var lastErr error
	for i := 0; i < 30; i++ {
		pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		lastErr = s.mcp.Ping(pingCtx, endpoint, token)
		cancel()
		if lastErr == nil {
			ready = true
			break
		}
		time.Sleep(time.Second)
	}
	now := time.Now()
	updates := map[string]any{
		"container_id":   resp.ID,
		"last_active_at": now,
	}
	if ready {
		updates["status"] = models.RuntimeRunning
		updates["last_error"] = ""
	} else {
		updates["status"] = models.RuntimeError
		if lastErr != nil {
			updates["last_error"] = lastErr.Error()
		} else {
			updates["last_error"] = "mcp not ready"
		}
	}
	_ = s.db.Model(rt).Updates(updates).Error
	return s.Status(userID)
}

func (s *Service) Stop(userID uint) error {
	rt, err := s.GetOrCreate(userID)
	if err != nil {
		return err
	}
	if s.docker != nil {
		ctx := context.Background()
		_ = s.removeContainer(ctx, rt.ContainerName)
	}
	return s.db.Model(rt).Updates(map[string]any{
		"status":       models.RuntimeStopped,
		"container_id": "",
		"last_error":   "",
	}).Error
}

func (s *Service) EnsureRunning(userID uint) (*models.WorkspaceRuntime, string, string, error) {
	rt, err := s.GetOrCreate(userID)
	if err != nil {
		return nil, "", "", err
	}
	if rt.ActiveProjectID == nil {
		return nil, "", "", ErrNoActiveProject
	}
	if rt.Status != models.RuntimeRunning {
		if _, err := s.Start(userID); err != nil {
			return nil, "", "", err
		}
		rt, err = s.GetOrCreate(userID)
		if err != nil {
			return nil, "", "", err
		}
	}
	token, err := s.plainToken(rt)
	if err != nil {
		return nil, "", "", err
	}
	endpoint := s.mcpURL(rt)
	now := time.Now()
	_ = s.db.Model(rt).Update("last_active_at", now).Error
	return rt, endpoint, token, nil
}

func (s *Service) mcpURL(rt *models.WorkspaceRuntime) string {
	if s.docker == nil {
		return fmt.Sprintf("http://127.0.0.1:8765/mcp")
	}
	// Prefer container name on docker network when API also in compose.
	// For host-run API, resolve container IP.
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if rt.ContainerID != "" {
		return s.resolveEndpoint(ctx, rt.ContainerID, rt.ContainerName)
	}
	return fmt.Sprintf("http://%s:8765/mcp", rt.ContainerName)
}

func (s *Service) resolveEndpoint(ctx context.Context, containerID, name string) string {
	if s.docker == nil {
		return "http://127.0.0.1:8765/mcp"
	}
	info, err := s.docker.ContainerInspect(ctx, containerID)
	if err != nil {
		return fmt.Sprintf("http://%s:8765/mcp", name)
	}
	if info.NetworkSettings != nil {
		if nw, ok := info.NetworkSettings.Networks[s.cfg.DockerNetwork]; ok && nw != nil && nw.IPAddress != "" {
			return fmt.Sprintf("http://%s:8765/mcp", nw.IPAddress)
		}
		for _, nw := range info.NetworkSettings.Networks {
			if nw != nil && nw.IPAddress != "" {
				return fmt.Sprintf("http://%s:8765/mcp", nw.IPAddress)
			}
		}
	}
	return fmt.Sprintf("http://%s:8765/mcp", name)
}

func (s *Service) plainToken(rt *models.WorkspaceRuntime) (string, error) {
	return crypto.DecryptString(s.cfg.DataEncryptionKey, rt.MCPTokenEnc)
}

func (s *Service) fail(rt *models.WorkspaceRuntime, err error) (*StatusView, error) {
	_ = s.db.Model(rt).Updates(map[string]any{
		"status":     models.RuntimeError,
		"last_error": err.Error(),
	}).Error
	return nil, err
}

func (s *Service) ensureNetwork(ctx context.Context) error {
	args := filters.NewArgs()
	args.Add("name", s.cfg.DockerNetwork)
	list, err := s.docker.NetworkList(ctx, network.ListOptions{Filters: args})
	if err != nil {
		return err
	}
	for _, n := range list {
		if n.Name == s.cfg.DockerNetwork {
			return nil
		}
	}
	_, err = s.docker.NetworkCreate(ctx, s.cfg.DockerNetwork, network.CreateOptions{
		Driver: "bridge",
		Labels: map[string]string{"app": "coding-agent-platform"},
	})
	return err
}

func (s *Service) removeContainer(ctx context.Context, name string) error {
	timeout := 10
	_ = s.docker.ContainerStop(ctx, name, container.StopOptions{Timeout: &timeout})
	return s.docker.ContainerRemove(ctx, name, container.RemoveOptions{Force: true})
}

// ReapIdle stops runtimes idle longer than configured minutes.
func (s *Service) ReapIdle(ctx context.Context) error {
	if s.cfg.RuntimeIdleMinutes <= 0 {
		return nil
	}
	cutoff := time.Now().Add(-time.Duration(s.cfg.RuntimeIdleMinutes) * time.Minute)
	var items []models.WorkspaceRuntime
	if err := s.db.Where("status = ? AND last_active_at IS NOT NULL AND last_active_at < ?", models.RuntimeRunning, cutoff).Find(&items).Error; err != nil {
		return err
	}
	for _, rt := range items {
		_ = s.Stop(rt.UserID)
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
	}
	return nil
}
