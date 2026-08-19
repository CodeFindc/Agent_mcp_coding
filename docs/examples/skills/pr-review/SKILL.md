---
name: pr-review
description: Review local git changes like a PR — risk, style, tests, and summary. Use when the user asks for code review, PR review, or change feedback.
---

# PR / change review

Follow this procedure using MCP tools in the current project workspace.

## 1. Inspect the change set

1. Call `git_status` to see branch and dirty files.
2. Call `git_diff` (unstaged and staged as needed) for the full patch.
3. If history matters, use `git_log` / `git_show` on relevant commits.

## 2. Read only what you need

- Open the highest-risk hunks with `read_file` (do not dump entire large files).
- Use `search_text` for call sites of changed symbols when behavior may break.

## 3. Review checklist

Evaluate and report on:

- **Correctness**: logic bugs, edge cases, nil/error handling
- **Security**: injection, path traversal, secrets, authz
- **Tests**: missing coverage for new branches; suggest concrete cases
- **Style**: naming, duplication, API surface churn
- **Ops**: migrations, flags, backward compatibility

## 4. Output format

Write the review as:

1. **Summary** (2–4 sentences)
2. **Blocking issues** (if any) — must fix before merge
3. **Non-blocking suggestions**
4. **Test plan** — commands the author should run (`exec_command` only if the user wants you to run them)

Do not modify files unless the user explicitly asks you to apply fixes.
