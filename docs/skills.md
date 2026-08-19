# Agent Skills (SKILL.md)

Platform agents can load **skill packages** — markdown playbooks with YAML frontmatter. Skills are **not** MCP tools: coding execution still goes through `coding-tools-mcp`. Skills only inject procedures into the model context when loaded.

## Layout

| Scope | Path | Priority |
|-------|------|----------|
| Project | `{project}/.agents/skills/<name>/SKILL.md` | Highest |
| User | `{DATA_ROOT}/users/{uid}/skills/<name>/SKILL.md` | Medium |
| Global | `{DATA_ROOT}/skills/<name>/SKILL.md` | Lowest |

Nested names are allowed one level deep, e.g. `.agents/skills/docs/api-style/SKILL.md` → name `docs/api-style`.

Same name: **project overrides user overrides global**.

## SKILL.md format

```markdown
---
name: pr-review
description: Short trigger text for the model catalog (when to use this skill)
disable-model-invocation: false
---

# Title

Step-by-step instructions. Reference real MCP tool names:
`list_dir`, `read_file`, `search_text`, `apply_patch`, `exec_command`, `git_status`, …
```

- `description` appears in the system-prompt catalog (keep it concise).
- Full body is loaded only via the `load_skill` tool (token control).
- `disable-model-invocation: true` hides the skill from the model catalog and blocks `load_skill`.

## How the agent uses skills

1. On each chat turn the API scans skills and appends a **catalog** (name + description) to the system prompt.
2. Meta-tools (handled in the Go API, not MCP):
   - `list_skills` — refresh catalog JSON
   - `load_skill` — load full markdown body by `name`
3. After `load_skill`, the model should follow the skill text and call MCP tools as needed.
4. **Slash commands**: type `/pr-review …` in chat (UI autocomplete on `/`). The API preloads up to 3 matching skill bodies into the model user message for that turn (history still stores the original text).

## HTTP API

- `GET /api/v1/projects/{id}/skills` — catalog
- `GET /api/v1/projects/{id}/skills/*` — full skill (`*` = name, e.g. `pr-review` or `docs/api-style`)

## Example

Repository example (committed):

```text
docs/examples/skills/pr-review/SKILL.md
```

Global skills are loaded from `{DATA_ROOT}/skills`. For local dev with `DATA_ROOT=./data/workspaces`:

```bash
mkdir -p data/workspaces/skills
cp -r docs/examples/skills/pr-review data/workspaces/skills/
```

Or put project skills in:

```text
{project}/.agents/skills/pr-review/SKILL.md
# e.g. data/workspaces/users/{id}/projects/{slug}/.agents/skills/pr-review/SKILL.md
```

## Security

- Skill bodies are untrusted text for the model; the API process **does not execute** skill scripts.
- Paths are jailed to each skills root.
- File size is capped (default 64 KiB per `SKILL.md`).
