// Package skills discovers and loads SKILL.md packages for the platform agent.
// Skills are prompt/procedure packs, not MCP tools. Execution still goes through coding-tools-mcp.
package skills

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

const (
	// Relative path under a project root.
	ProjectSkillsRel = ".agents/skills"
	// Max SKILL.md size when loading full body.
	DefaultMaxSkillBytes = 64 * 1024
	// Max description length kept in catalog entries.
	MaxDescriptionRunes = 280
)

var (
	ErrNotFound = errors.New("skill not found")
	ErrDisabled = errors.New("skill disabled for model invocation")

	// namePattern: lowercase slug, optional nested path segments with /
	namePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,63}(/[a-z0-9][a-z0-9._-]{0,63})*$`)
)

// Scope identifies where a skill was loaded from.
type Scope string

const (
	ScopeBundled Scope = "bundled"
	ScopeUser    Scope = "user"
	ScopeProject Scope = "project"
)

// Meta is the catalog entry shown to the model (no full body).
type Meta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Scope       Scope  `json:"scope"`
	// RelDir is the skill directory relative to its skills root (for debugging).
	RelDir string `json:"relDir,omitempty"`
	// DisableModelInvocation hides the skill from automatic catalog/tools when true.
	DisableModelInvocation bool `json:"disableModelInvocation,omitempty"`
}

// Skill is a fully loaded skill package.
type Skill struct {
	Meta
	// Body is markdown after frontmatter.
	Body string `json:"body"`
	// Path is the absolute path to SKILL.md (host).
	Path string `json:"path,omitempty"`
}

// ListOptions controls discovery.
type ListOptions struct {
	// ProjectRoot is the absolute host path of the project workspace (optional).
	ProjectRoot string
	// UserID enables user-scoped skills under DataRoot/users/{id}/skills.
	UserID uint
	// DataRoot is the platform DATA_ROOT (for user + optional global skills).
	DataRoot string
	// BundledDir is an optional extra skills root (highest priority after project when merging by name: project > user > bundled).
	BundledDir string
	// IncludeDisabled includes skills with disable-model-invocation in List results.
	IncludeDisabled bool
	// MaxBytes caps SKILL.md read size (default DefaultMaxSkillBytes).
	MaxBytes int
}

// Service discovers skills from disk. It never executes skill scripts.
type Service struct {
	maxBytes int
}

func NewService(maxBytes int) *Service {
	if maxBytes <= 0 {
		maxBytes = DefaultMaxSkillBytes
	}
	return &Service{maxBytes: maxBytes}
}

// List returns a de-duplicated catalog. Priority when names collide: project > user > bundled.
func (s *Service) List(opts ListOptions) ([]Meta, error) {
	maxBytes := opts.MaxBytes
	if maxBytes <= 0 {
		maxBytes = s.maxBytes
	}

	// Lower priority first so higher can overwrite.
	merged := map[string]Meta{}
	order := make([]string, 0)

	type root struct {
		scope Scope
		dir   string
	}
	// Apply low → high priority so later scopes overwrite: bundled → user → project.
	var roots []root
	if d := strings.TrimSpace(opts.BundledDir); d != "" {
		roots = append(roots, root{ScopeBundled, d})
	}
	if opts.DataRoot != "" {
		roots = append(roots, root{ScopeBundled, filepath.Join(opts.DataRoot, "skills")})
	}
	if opts.DataRoot != "" && opts.UserID > 0 {
		roots = append(roots, root{ScopeUser, filepath.Join(opts.DataRoot, fmt.Sprintf("users/%d/skills", opts.UserID))})
	}
	if pr := strings.TrimSpace(opts.ProjectRoot); pr != "" {
		roots = append(roots, root{ScopeProject, filepath.Join(pr, ProjectSkillsRel)})
	}

	for _, r := range roots {
		entries, err := scanSkillsRoot(r.dir, r.scope, maxBytes)
		if err != nil {
			return nil, err
		}
		for _, m := range entries {
			if !opts.IncludeDisabled && m.DisableModelInvocation {
				continue
			}
			if _, exists := merged[m.Name]; !exists {
				order = append(order, m.Name)
			}
			merged[m.Name] = m
		}
	}

	// Stable-ish: sort by name for prompt determinism; keep scope from merge.
	names := make([]string, 0, len(merged))
	for name := range merged {
		names = append(names, name)
	}
	sort.Strings(names)
	out := make([]Meta, 0, len(names))
	for _, name := range names {
		out = append(out, merged[name])
	}
	_ = order
	return out, nil
}

// Load returns full skill body by name using the same merge priority as List.
func (s *Service) Load(name string, opts ListOptions) (*Skill, error) {
	name = normalizeSkillName(name)
	if name == "" || !namePattern.MatchString(name) {
		return nil, fmt.Errorf("invalid skill name")
	}
	maxBytes := opts.MaxBytes
	if maxBytes <= 0 {
		maxBytes = s.maxBytes
	}

	// Search high priority first.
	candidates := make([]struct {
		scope Scope
		dir   string
	}, 0, 4)
	if pr := strings.TrimSpace(opts.ProjectRoot); pr != "" {
		candidates = append(candidates, struct {
			scope Scope
			dir   string
		}{ScopeProject, filepath.Join(pr, ProjectSkillsRel)})
	}
	if opts.DataRoot != "" && opts.UserID > 0 {
		candidates = append(candidates, struct {
			scope Scope
			dir   string
		}{ScopeUser, filepath.Join(opts.DataRoot, fmt.Sprintf("users/%d/skills", opts.UserID))})
	}
	if d := strings.TrimSpace(opts.BundledDir); d != "" {
		candidates = append(candidates, struct {
			scope Scope
			dir   string
		}{ScopeBundled, d})
	}
	if opts.DataRoot != "" {
		candidates = append(candidates, struct {
			scope Scope
			dir   string
		}{ScopeBundled, filepath.Join(opts.DataRoot, "skills")})
	}

	for _, c := range candidates {
		sk, err := loadSkillAt(c.dir, name, c.scope, maxBytes)
		if err == nil {
			if sk.DisableModelInvocation {
				return nil, ErrDisabled
			}
			return sk, nil
		}
		if !errors.Is(err, ErrNotFound) {
			return nil, err
		}
	}
	return nil, ErrNotFound
}

// CatalogPrompt returns a short markdown section for the system prompt.
func CatalogPrompt(items []Meta) string {
	if len(items) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("Available skills (load with load_skill when relevant; do not guess procedures):\n")
	for _, m := range items {
		desc := strings.TrimSpace(m.Description)
		if desc == "" {
			desc = "(no description)"
		}
		b.WriteString(fmt.Sprintf("- %s [%s]: %s\n", m.Name, m.Scope, desc))
	}
	b.WriteString("Use list_skills to refresh the catalog. Use load_skill with the skill name before following its instructions.")
	return b.String()
}

// ListJSON is a tool-result helper.
func ListJSON(items []Meta) string {
	type row struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Scope       Scope  `json:"scope"`
	}
	rows := make([]row, 0, len(items))
	for _, m := range items {
		rows = append(rows, row{Name: m.Name, Description: m.Description, Scope: m.Scope})
	}
	raw, _ := json.MarshalIndent(map[string]any{"skills": rows, "count": len(rows)}, "", "  ")
	return string(raw)
}

// LoadJSON is a tool-result helper.
func LoadJSON(sk *Skill) string {
	raw, _ := json.MarshalIndent(map[string]any{
		"name":        sk.Name,
		"description": sk.Description,
		"scope":       sk.Scope,
		"body":        sk.Body,
	}, "", "  ")
	return string(raw)
}

func scanSkillsRoot(root string, scope Scope, maxBytes int) ([]Meta, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	if !st.IsDir() {
		return nil, nil
	}

	var out []Meta
	// Depth: skills root / <name>/SKILL.md or skills root / <group>/<name>/SKILL.md (max 2 levels of dirs).
	err = filepath.WalkDir(abs, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			if os.IsNotExist(walkErr) {
				return nil
			}
			return walkErr
		}
		rel, relErr := filepath.Rel(abs, path)
		if relErr != nil {
			return nil
		}
		if rel == "." {
			return nil
		}
		// Jail: reject escapes (should not happen with WalkDir).
		if strings.HasPrefix(rel, "..") {
			return filepath.SkipDir
		}
		parts := splitPath(rel)
		if d.IsDir() {
			// Skip hidden dirs except we already are under .agents
			base := d.Name()
			if strings.HasPrefix(base, ".") && base != "." {
				return filepath.SkipDir
			}
			if len(parts) > 2 {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.EqualFold(d.Name(), "SKILL.md") {
			return nil
		}
		// SKILL.md must live in a subdir: name/SKILL.md or group/name/SKILL.md
		if len(parts) < 2 || len(parts) > 3 {
			return nil
		}
		dirRel := filepath.Dir(rel)
		meta, parseErr := readSkillMeta(path, dirRel, scope, maxBytes)
		if parseErr != nil {
			// Skip broken skills rather than failing the whole catalog.
			return nil
		}
		out = append(out, meta)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func loadSkillAt(root, name string, scope Scope, maxBytes int) (*Skill, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	// name may contain /
	relDir := filepath.FromSlash(name)
	skillPath := filepath.Join(absRoot, relDir, "SKILL.md")
	// Path jail
	clean, err := filepath.Abs(skillPath)
	if err != nil {
		return nil, err
	}
	rel, err := filepath.Rel(absRoot, clean)
	if err != nil || strings.HasPrefix(rel, "..") || filepath.IsAbs(rel) {
		return nil, ErrNotFound
	}
	raw, err := readFileLimited(clean, maxBytes)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	fm, body, err := parseFrontmatter(string(raw))
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	metaName := firstNonEmpty(fm["name"], filepath.Base(relDir))
	metaName = normalizeSkillName(metaName)
	if metaName == "" {
		metaName = normalizeSkillName(name)
	}
	// Allow frontmatter name to differ from folder; prefer request name for lookup stability when folder matches.
	if normalizeSkillName(name) != "" {
		// Keep folder-based identity as the load key the model uses (directory name path).
		metaName = normalizeSkillName(name)
		if n := normalizeSkillName(fm["name"]); n != "" {
			// If frontmatter name is set and folder is single segment equal ignore; still expose folder path as name for load_skill.
			_ = n
		}
	}
	desc := strings.TrimSpace(fm["description"])
	desc = truncateRunes(desc, MaxDescriptionRunes)
	dis := parseBool(fm["disable-model-invocation"]) || parseBool(fm["disable_model_invocation"])
	return &Skill{
		Meta: Meta{
			Name:                   metaName,
			Description:            desc,
			Scope:                  scope,
			RelDir:                 filepath.ToSlash(relDir),
			DisableModelInvocation: dis,
		},
		Body: strings.TrimSpace(body),
		Path: clean,
	}, nil
}

func readSkillMeta(skillPath, dirRel string, scope Scope, maxBytes int) (Meta, error) {
	raw, err := readFileLimited(skillPath, maxBytes)
	if err != nil {
		return Meta{}, err
	}
	fm, _, err := parseFrontmatter(string(raw))
	if err != nil {
		return Meta{}, err
	}
	// Prefer directory relative path as stable load key (supports group/name).
	dirName := filepath.ToSlash(dirRel)
	name := normalizeSkillName(dirName)
	if name == "" {
		name = normalizeSkillName(fm["name"])
	}
	if name == "" || !namePattern.MatchString(name) {
		return Meta{}, fmt.Errorf("invalid name")
	}
	desc := truncateRunes(strings.TrimSpace(fm["description"]), MaxDescriptionRunes)
	dis := parseBool(fm["disable-model-invocation"]) || parseBool(fm["disable_model_invocation"])
	return Meta{
		Name:                   name,
		Description:            desc,
		Scope:                  scope,
		RelDir:                 dirName,
		DisableModelInvocation: dis,
	}, nil
}

func readFileLimited(path string, maxBytes int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	if maxBytes <= 0 {
		maxBytes = DefaultMaxSkillBytes
	}
	// Read maxBytes+1 to detect overflow; still return capped content.
	buf := make([]byte, maxBytes+1)
	n, err := f.Read(buf)
	if err != nil && !errors.Is(err, io.EOF) {
		if n == 0 {
			return nil, err
		}
	}
	if n > maxBytes {
		return buf[:maxBytes], nil
	}
	return buf[:n], nil
}

// parseFrontmatter parses a simple YAML-like frontmatter block between --- lines.
// Only flat string keys are supported (no nested YAML).
func parseFrontmatter(content string) (map[string]string, string, error) {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.TrimPrefix(content, "\ufeff")
	if !strings.HasPrefix(content, "---\n") && content != "---" && !strings.HasPrefix(content, "---\r") {
		// No frontmatter: entire file is body; name must come from directory.
		return map[string]string{}, strings.TrimSpace(content), nil
	}
	rest := strings.TrimPrefix(content, "---\n")
	rest = strings.TrimPrefix(rest, "---\r\n")
	end := strings.Index(rest, "\n---\n")
	if end < 0 {
		// allow closing --- at EOF
		if strings.HasSuffix(rest, "\n---") {
			end = len(rest) - len("\n---")
			fmText := rest[:end]
			return parseFMLines(fmText), "", nil
		}
		// malformed: treat as body
		return map[string]string{}, strings.TrimSpace(content), nil
	}
	fmText := rest[:end]
	body := rest[end+len("\n---\n"):]
	return parseFMLines(fmText), body, nil
}

func parseFMLines(text string) map[string]string {
	out := map[string]string{}
	lines := strings.Split(text, "\n")
	var currentKey string
	var currentVal strings.Builder
	flush := func() {
		if currentKey == "" {
			return
		}
		out[currentKey] = strings.TrimSpace(currentVal.String())
		currentKey = ""
		currentVal.Reset()
	}
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			if currentKey != "" {
				currentVal.WriteByte('\n')
			}
			continue
		}
		// continuation / multiline: indented line
		if currentKey != "" && (strings.HasPrefix(line, "  ") || strings.HasPrefix(line, "\t")) {
			if currentVal.Len() > 0 {
				currentVal.WriteByte('\n')
			}
			currentVal.WriteString(strings.TrimSpace(line))
			continue
		}
		// key: value
		if i := strings.IndexByte(line, ':'); i > 0 {
			flush()
			key := strings.TrimSpace(line[:i])
			val := strings.TrimSpace(line[i+1:])
			// strip simple quotes
			val = unquote(val)
			currentKey = strings.ToLower(key)
			currentVal.WriteString(val)
			continue
		}
		// ignore unknown
	}
	flush()
	return out
}

func unquote(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

func parseBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func normalizeSkillName(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.ReplaceAll(s, "\\", "/")
	s = strings.Trim(s, "/")
	// collapse duplicate slashes
	for strings.Contains(s, "//") {
		s = strings.ReplaceAll(s, "//", "/")
	}
	return s
}

func truncateRunes(s string, max int) string {
	if max <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max-1]) + "…"
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func splitPath(rel string) []string {
	rel = filepath.ToSlash(rel)
	parts := strings.Split(rel, "/")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p == "" || p == "." {
			continue
		}
		out = append(out, p)
	}
	return out
}

// ValidName reports whether name is a legal skill id.
func ValidName(name string) bool {
	n := normalizeSkillName(name)
	return n != "" && namePattern.MatchString(n) && isPrintableName(n)
}

func isPrintableName(s string) bool {
	for _, r := range s {
		if r == '/' || r == '-' || r == '_' || r == '.' {
			continue
		}
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}
