package projects

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"

	"github.com/coding-agent-platform/api/internal/models"
	"gorm.io/gorm"
)

var execCommand = exec.Command

var (
	ErrNotFound = errors.New("project not found")
	ErrDenied   = errors.New("forbidden")
)

var slugCleaner = regexp.MustCompile(`[^a-z0-9]+`)

// RuntimeCleaner stops/removes project containers when a project is deleted.
type RuntimeCleaner interface {
	DeleteForProject(userID, projectID uint) error
}

type Service struct {
	db       *gorm.DB
	dataRoot string
	runtime  RuntimeCleaner
}

func NewService(db *gorm.DB, dataRoot string) *Service {
	return &Service{db: db, dataRoot: dataRoot}
}

func (s *Service) SetRuntimeCleaner(r RuntimeCleaner) {
	s.runtime = r
}

type CreateInput struct {
	Name string `json:"name"`
}

func (s *Service) List(userID uint) ([]models.Project, error) {
	var items []models.Project
	err := s.db.Where("user_id = ?", userID).Order("id desc").Find(&items).Error
	return items, err
}

func (s *Service) Get(userID, projectID uint) (*models.Project, error) {
	var p models.Project
	if err := s.db.First(&p, projectID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if p.UserID != userID {
		return nil, ErrDenied
	}
	return &p, nil
}

func (s *Service) Create(userID uint, input CreateInput) (*models.Project, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	slug := slugify(name)
	if slug == "" {
		slug = fmt.Sprintf("project-%d", userID)
	}

	// ensure unique slug per user
	base := slug
	for i := 0; i < 50; i++ {
		var count int64
		q := s.db.Model(&models.Project{}).Where("user_id = ? AND slug = ?", userID, slug)
		if err := q.Count(&count).Error; err != nil {
			return nil, err
		}
		if count == 0 {
			break
		}
		slug = fmt.Sprintf("%s-%d", base, i+2)
	}

	diskPath := filepath.Join(s.dataRoot, fmt.Sprintf("users/%d/projects/%s", userID, slug))
	if err := os.MkdirAll(diskPath, 0o755); err != nil {
		return nil, fmt.Errorf("create project dir: %w", err)
	}
	// starter file
	readme := filepath.Join(diskPath, "README.md")
	if _, err := os.Stat(readme); errors.Is(err, os.ErrNotExist) {
		_ = os.WriteFile(readme, []byte(fmt.Sprintf("# %s\n\nYour coding workspace.\n", name)), 0o644)
	}

	p := models.Project{
		UserID:   userID,
		Name:     name,
		Slug:     slug,
		DiskPath: diskPath,
	}
	if err := s.db.Create(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Service) Delete(userID, projectID uint) error {
	p, err := s.Get(userID, projectID)
	if err != nil {
		return err
	}
	if s.runtime != nil {
		_ = s.runtime.DeleteForProject(userID, projectID)
	}
	if err := s.db.Delete(&models.Project{}, p.ID).Error; err != nil {
		return err
	}
	// keep files by default for safety; operator can purge DATA_ROOT
	return nil
}

func (s *Service) AbsolutePath(p *models.Project) (string, error) {
	abs, err := filepath.Abs(p.DiskPath)
	if err != nil {
		return "", err
	}
	root, err := filepath.Abs(s.dataRoot)
	if err != nil {
		return "", err
	}
	rel, err := filepath.Rel(root, abs)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("project path escapes data root")
	}
	return abs, nil
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if r == ' ' || r == '-' || r == '_' {
			b.WriteByte('-')
		}
	}
	out := slugCleaner.ReplaceAllString(b.String(), "-")
	out = strings.Trim(out, "-")
	if len(out) > 48 {
		out = out[:48]
		out = strings.Trim(out, "-")
	}
	return out
}

type FileNode struct {
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	IsDir     bool       `json:"isDir"`
	Size      int64      `json:"size"`
	ModTime   string     `json:"modTime"`
	Extension string     `json:"extension,omitempty"`
	Children  []FileNode `json:"children,omitempty"`
}

var ignoredDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"__pycache__":  true,
	".next":        true,
	"dist":         true,
	"build":        true,
	".vscode":      true,
	".idea":        true,
}

func (s *Service) ListTree(userID, projectID uint) ([]FileNode, error) {
	p, err := s.Get(userID, projectID)
	if err != nil {
		return nil, err
	}
	diskPath, err := s.AbsolutePath(p)
	if err != nil {
		return nil, err
	}

	var walk func(dir string, rel string) ([]FileNode, error)
	walk = func(dir string, rel string) ([]FileNode, error) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return nil, err
		}
		var nodes []FileNode
		for _, e := range entries {
			name := e.Name()
			if ignoredDirs[name] {
				continue
			}
			childRel := filepath.Join(rel, name)
			childRel = filepath.ToSlash(childRel)
			fullPath := filepath.Join(dir, name)

			info, err := e.Info()
			if err != nil {
				continue
			}

			node := FileNode{
				Name:    name,
				Path:    childRel,
				IsDir:   e.IsDir(),
				Size:    info.Size(),
				ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
			}
			if !e.IsDir() {
				node.Extension = strings.TrimPrefix(filepath.Ext(name), ".")
			} else {
				children, _ := walk(fullPath, childRel)
				node.Children = children
			}
			nodes = append(nodes, node)
		}
		return nodes, nil
	}

	return walk(diskPath, "")
}

func (s *Service) ReadFile(userID, projectID uint, relPath string) (string, error) {
	p, err := s.Get(userID, projectID)
	if err != nil {
		return "", err
	}
	diskPath, err := s.AbsolutePath(p)
	if err != nil {
		return "", err
	}

	cleanRel := filepath.Clean(filepath.FromSlash(relPath))
	if strings.HasPrefix(cleanRel, "..") || cleanRel == "." {
		return "", fmt.Errorf("invalid path traversal")
	}

	target := filepath.Join(diskPath, cleanRel)
	info, err := os.Stat(target)
	if err != nil {
		return "", err
	}
	if info.IsDir() {
		return "", fmt.Errorf("path is a directory")
	}
	if info.Size() > 5<<20 { // 5MB limit
		return "", fmt.Errorf("file is too large to preview (>5MB)")
	}

	data, err := os.ReadFile(target)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

type GitFileChange struct {
	Path   string `json:"path"`
	Status string `json:"status"` // "M", "A", "D", "?"
}

type GitStatusInfo struct {
	Branch  string          `json:"branch"`
	Clean   bool            `json:"clean"`
	Changes []GitFileChange `json:"changes"`
}

type GitDiffResult struct {
	Path       string `json:"path"`
	OldContent string `json:"oldContent"`
	NewContent string `json:"newContent"`
	DiffText   string `json:"diffText"`
}

func (s *Service) GetGitStatus(userID, projectID uint) (*GitStatusInfo, error) {
	p, err := s.Get(userID, projectID)
	if err != nil {
		return nil, err
	}
	diskPath, err := s.AbsolutePath(p)
	if err != nil {
		return nil, err
	}

	// Check if git is initialized in project dir
	gitDir := filepath.Join(diskPath, ".git")
	if _, err := os.Stat(gitDir); errors.Is(err, os.ErrNotExist) {
		return &GitStatusInfo{
			Branch:  "main",
			Clean:   true,
			Changes: []GitFileChange{},
		}, nil
	}

	// Run git status --porcelain=v1 -b
	cmd := execCommand("git", "-C", diskPath, "status", "--porcelain=v1", "-b")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return &GitStatusInfo{
			Branch:  "main",
			Clean:   true,
			Changes: []GitFileChange{},
		}, nil
	}

	lines := strings.Split(string(out), "\n")
	var branch = "main"
	var changes []GitFileChange

	for _, line := range lines {
		trimmed := strings.TrimRight(line, "\r\n")
		if strings.HasPrefix(trimmed, "## ") {
			b := strings.TrimPrefix(trimmed, "## ")
			if idx := strings.Index(b, "..."); idx != -1 {
				b = b[:idx]
			}
			branch = strings.TrimSpace(b)
			continue
		}
		if len(trimmed) < 4 {
			continue
		}
		statusCode := strings.TrimSpace(trimmed[:2])
		filePath := strings.TrimSpace(trimmed[3:])
		filePath = filepath.ToSlash(filePath)

		changes = append(changes, GitFileChange{
			Path:   filePath,
			Status: statusCode,
		})
	}

	return &GitStatusInfo{
		Branch:  branch,
		Clean:   len(changes) == 0,
		Changes: changes,
	}, nil
}

func (s *Service) GetGitDiff(userID, projectID uint, relPath string) (*GitDiffResult, error) {
	p, err := s.Get(userID, projectID)
	if err != nil {
		return nil, err
	}
	diskPath, err := s.AbsolutePath(p)
	if err != nil {
		return nil, err
	}

	cleanRel := filepath.Clean(filepath.FromSlash(relPath))
	target := filepath.Join(diskPath, cleanRel)

	var currentContent = ""
	if data, err := os.ReadFile(target); err == nil {
		currentContent = string(data)
	}

	// Read HEAD version via git show HEAD:relPath
	var oldContent = ""
	headPath := filepath.ToSlash(cleanRel)
	showCmd := execCommand("git", "-C", diskPath, "show", "HEAD:"+headPath)
	if oldData, err := showCmd.Output(); err == nil {
		oldContent = string(oldData)
	}

	// Get diff text via git diff
	diffCmd := execCommand("git", "-C", diskPath, "diff", "HEAD", "--", headPath)
	diffText, _ := diffCmd.CombinedOutput()

	return &GitDiffResult{
		Path:       headPath,
		OldContent: oldContent,
		NewContent: currentContent,
		DiffText:   string(diffText),
	}, nil
}
