package projects

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"

	"github.com/coding-agent-platform/api/internal/models"
	"gorm.io/gorm"
)

var (
	ErrNotFound = errors.New("project not found")
	ErrDenied   = errors.New("forbidden")
)

var slugCleaner = regexp.MustCompile(`[^a-z0-9]+`)

type Service struct {
	db       *gorm.DB
	dataRoot string
}

func NewService(db *gorm.DB, dataRoot string) *Service {
	return &Service{db: db, dataRoot: dataRoot}
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
