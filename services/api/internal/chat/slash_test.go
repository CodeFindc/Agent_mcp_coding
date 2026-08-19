package chat

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/coding-agent-platform/api/internal/skills"
)

func TestExpandSlashSkills(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, skills.ProjectSkillsRel, "pr-review")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := "---\nname: pr-review\ndescription: review\n---\n# Review steps\nDo the review.\n"
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	svc := skills.NewService(0)
	opts := skills.ListOptions{ProjectRoot: root}

	out := expandSlashSkills("/pr-review please check my branch", svc, opts)
	if !strings.Contains(out, "Review steps") || !strings.Contains(out, "please check") {
		t.Fatalf("expanded=%q", out)
	}

	// unknown slash stays plain
	plain := expandSlashSkills("/no-such-skill hi", svc, opts)
	if plain != "/no-such-skill hi" {
		t.Fatalf("plain=%q", plain)
	}
}
