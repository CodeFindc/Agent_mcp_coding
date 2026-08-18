package admin

import (
	"fmt"
	"strings"

	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/crypto"
	"github.com/coding-agent-platform/api/internal/models"
	"gorm.io/gorm"
)

type Service struct {
	db  *gorm.DB
	cfg config.Config
}

func NewService(db *gorm.DB, cfg config.Config) *Service {
	return &Service{db: db, cfg: cfg}
}

type ProviderInput struct {
	Name         string `json:"name"`
	BaseURL      string `json:"baseUrl"`
	APIKey       string `json:"apiKey"`
	DefaultModel string `json:"defaultModel"`
	Enabled      *bool  `json:"enabled"`
}

type ProviderView struct {
	ID           uint   `json:"id"`
	Name         string `json:"name"`
	BaseURL      string `json:"baseUrl"`
	DefaultModel string `json:"defaultModel"`
	Enabled      bool   `json:"enabled"`
	HasAPIKey    bool   `json:"hasApiKey"`
}

func (s *Service) ListProviders() ([]ProviderView, error) {
	var items []models.ModelProvider
	if err := s.db.Order("id asc").Find(&items).Error; err != nil {
		return nil, err
	}
	out := make([]ProviderView, 0, len(items))
	for _, p := range items {
		out = append(out, ProviderView{
			ID:           p.ID,
			Name:         p.Name,
			BaseURL:      p.BaseURL,
			DefaultModel: p.DefaultModel,
			Enabled:      p.Enabled,
			HasAPIKey:    p.APIKeyEnc != "",
		})
	}
	return out, nil
}

func (s *Service) CreateProvider(input ProviderInput) (*ProviderView, error) {
	name := strings.TrimSpace(input.Name)
	base := strings.TrimSpace(input.BaseURL)
	model := strings.TrimSpace(input.DefaultModel)
	if name == "" || base == "" || model == "" {
		return nil, fmt.Errorf("name, baseUrl, defaultModel are required")
	}
	enc, err := crypto.EncryptString(s.cfg.DataEncryptionKey, strings.TrimSpace(input.APIKey))
	if err != nil {
		return nil, err
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	p := models.ModelProvider{
		Name:         name,
		BaseURL:      strings.TrimRight(base, "/"),
		APIKeyEnc:    enc,
		DefaultModel: model,
		Enabled:      enabled,
	}
	if err := s.db.Create(&p).Error; err != nil {
		return nil, err
	}
	return &ProviderView{ID: p.ID, Name: p.Name, BaseURL: p.BaseURL, DefaultModel: p.DefaultModel, Enabled: p.Enabled, HasAPIKey: p.APIKeyEnc != ""}, nil
}

func (s *Service) UpdateProvider(id uint, input ProviderInput) (*ProviderView, error) {
	var p models.ModelProvider
	if err := s.db.First(&p, id).Error; err != nil {
		return nil, err
	}
	updates := map[string]any{}
	if v := strings.TrimSpace(input.Name); v != "" {
		updates["name"] = v
	}
	if v := strings.TrimSpace(input.BaseURL); v != "" {
		updates["base_url"] = strings.TrimRight(v, "/")
	}
	if v := strings.TrimSpace(input.DefaultModel); v != "" {
		updates["default_model"] = v
	}
	if input.Enabled != nil {
		updates["enabled"] = *input.Enabled
	}
	if strings.TrimSpace(input.APIKey) != "" {
		enc, err := crypto.EncryptString(s.cfg.DataEncryptionKey, strings.TrimSpace(input.APIKey))
		if err != nil {
			return nil, err
		}
		updates["api_key_enc"] = enc
	}
	if len(updates) > 0 {
		if err := s.db.Model(&p).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	_ = s.db.First(&p, id)
	return &ProviderView{ID: p.ID, Name: p.Name, BaseURL: p.BaseURL, DefaultModel: p.DefaultModel, Enabled: p.Enabled, HasAPIKey: p.APIKeyEnc != ""}, nil
}

func (s *Service) DeleteProvider(id uint) error {
	return s.db.Delete(&models.ModelProvider{}, id).Error
}

func (s *Service) ListUsers() ([]models.User, error) {
	var users []models.User
	err := s.db.Order("id asc").Find(&users).Error
	return users, err
}

type PlatformInfo struct {
	CodingToolsImage   string `json:"codingToolsImage"`
	DockerNetwork      string `json:"dockerNetwork"`
	PermissionMode     string `json:"permissionMode"`
	RuntimeIdleMinutes int    `json:"runtimeIdleMinutes"`
	DevAuthEnabled     bool   `json:"devAuthEnabled"`
	OIDCEnabled        bool   `json:"oidcEnabled"`
	DataRoot           string `json:"dataRoot"`
}

func (s *Service) PlatformInfo(oidcEnabled bool) PlatformInfo {
	return PlatformInfo{
		CodingToolsImage:   s.cfg.CodingToolsImage,
		DockerNetwork:      s.cfg.DockerNetwork,
		PermissionMode:     s.cfg.PermissionMode,
		RuntimeIdleMinutes: s.cfg.RuntimeIdleMinutes,
		DevAuthEnabled:     s.cfg.DevAuthEnabled,
		OIDCEnabled:        oidcEnabled,
		DataRoot:           s.cfg.DataRoot,
	}
}
