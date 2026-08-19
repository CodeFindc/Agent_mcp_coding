package skills

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeSkill(t *testing.T, dir, name, content string) {
	t.Helper()
	p := filepath.Join(dir, filepath.FromSlash(name), "SKILL.md")
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestParseFrontmatter(t *testing.T) {
	fm, body, err := parseFrontmatter("---\nname: pr-review\ndescription: Review PRs\n---\n# Hello\n\nWorld\n")
	if err != nil {
		t.Fatal(err)
	}
	if fm["name"] != "pr-review" || fm["description"] != "Review PRs" {
		t.Fatalf("fm=%v", fm)
	}
	if !strings.Contains(body, "# Hello") {
		t.Fatalf("body=%q", body)
	}
}

func TestListAndLoadPriority(t *testing.T) {
	root := t.TempDir()
	dataRoot := filepath.Join(root, "data")
	project := filepath.Join(root, "proj")
	bundled := filepath.Join(root, "bundled")
	userSkills := filepath.Join(dataRoot, "users", "1", "skills")

	writeSkill(t, bundled, "demo", "---\nname: demo\ndescription: bundled demo\n---\nBUNDLED\n")
	writeSkill(t, userSkills, "demo", "---\nname: demo\ndescription: user demo\n---\nUSER\n")
	writeSkill(t, filepath.Join(project, ProjectSkillsRel), "demo", "---\nname: demo\ndescription: project demo\n---\nPROJECT\n")
	writeSkill(t, filepath.Join(project, ProjectSkillsRel), "other", "---\nname: other\ndescription: only project\n---\nOTHER\n")

	svc := NewService(0)
	opts := ListOptions{
		ProjectRoot: project,
		UserID:      1,
		DataRoot:    dataRoot,
		BundledDir:  bundled,
	}
	list, err := svc.List(opts)
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]Meta{}
	for _, m := range list {
		byName[m.Name] = m
	}
	if byName["demo"].Scope != ScopeProject || byName["demo"].Description != "project demo" {
		t.Fatalf("demo meta=%+v", byName["demo"])
	}
	if byName["other"].Scope != ScopeProject {
		t.Fatalf("other=%+v", byName["other"])
	}

	sk, err := svc.Load("demo", opts)
	if err != nil {
		t.Fatal(err)
	}
	if sk.Scope != ScopeProject || !strings.Contains(sk.Body, "PROJECT") {
		t.Fatalf("load=%+v body=%q", sk.Meta, sk.Body)
	}
}

func TestDisableModelInvocation(t *testing.T) {
	root := t.TempDir()
	project := filepath.Join(root, "proj")
	writeSkill(t, filepath.Join(project, ProjectSkillsRel), "secret", "---\nname: secret\ndescription: hidden\ndisable-model-invocation: true\n---\nNOPE\n")

	svc := NewService(0)
	opts := ListOptions{ProjectRoot: project}
	list, err := svc.List(opts)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 0 {
		t.Fatalf("expected empty catalog, got %+v", list)
	}
	_, err = svc.Load("secret", opts)
	if err != ErrDisabled {
		t.Fatalf("want ErrDisabled, got %v", err)
	}
}

func TestPathJail(t *testing.T) {
	svc := NewService(0)
	opts := ListOptions{ProjectRoot: t.TempDir()}
	_, err := svc.Load("../etc/passwd", opts)
	if err == nil {
		t.Fatal("expected error")
	}
	_, err = svc.Load("/abs", opts)
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestCatalogPrompt(t *testing.T) {
	s := CatalogPrompt([]Meta{{Name: "a", Description: "d", Scope: ScopeProject}})
	if !strings.Contains(s, "load_skill") || !strings.Contains(s, "a") {
		t.Fatalf("%s", s)
	}
	if CatalogPrompt(nil) != "" {
		t.Fatal("empty")
	}
}
