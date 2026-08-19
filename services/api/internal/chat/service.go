package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/crypto"
	"github.com/coding-agent-platform/api/internal/llm"
	"github.com/coding-agent-platform/api/internal/mcp"
	"github.com/coding-agent-platform/api/internal/models"
	"github.com/coding-agent-platform/api/internal/projects"
	"github.com/coding-agent-platform/api/internal/runtime"
	"github.com/coding-agent-platform/api/internal/skills"
	"gorm.io/gorm"
)

// Matches /skill or /group/skill at start or after whitespace.
var slashSkillRE = regexp.MustCompile(`(?:^|[\s])/(?:@)?([a-zA-Z0-9][a-zA-Z0-9._-]*(?:/[a-zA-Z0-9][a-zA-Z0-9._-]*)?)`)

var ErrNotFound = errors.New("not found")

type Service struct {
	db       *gorm.DB
	cfg      config.Config
	projects *projects.Service
	runtime  *runtime.Service
	mcp      *mcp.Client
	llm      *llm.Client
	skills   *skills.Service
}

func NewService(db *gorm.DB, cfg config.Config, projectsSvc *projects.Service, runtimeSvc *runtime.Service) *Service {
	return &Service{
		db:       db,
		cfg:      cfg,
		projects: projectsSvc,
		runtime:  runtimeSvc,
		mcp:      mcp.NewClient(cfg.MCPRequestTimeout),
		llm:      llm.NewClient(),
		skills:   skills.NewService(0),
	}
}

type Event struct {
	Type      string `json:"type"`
	Content   string `json:"content,omitempty"`
	Tool      string `json:"tool,omitempty"`
	Args      string `json:"args,omitempty"`
	Result    string `json:"result,omitempty"`
	Error     string `json:"error,omitempty"`
	ThreadID  uint   `json:"threadId,omitempty"`
	MessageID uint   `json:"messageId,omitempty"`
}

func (s *Service) ListThreads(userID, projectID uint) ([]models.ChatThread, error) {
	if _, err := s.projects.Get(userID, projectID); err != nil {
		return nil, err
	}
	var items []models.ChatThread
	err := s.db.Where("user_id = ? AND project_id = ?", userID, projectID).Order("id desc").Find(&items).Error
	return items, err
}

func (s *Service) CreateThread(userID, projectID uint, title string) (*models.ChatThread, error) {
	if _, err := s.projects.Get(userID, projectID); err != nil {
		return nil, err
	}
	if strings.TrimSpace(title) == "" {
		title = "New chat"
	}
	t := models.ChatThread{UserID: userID, ProjectID: projectID, Title: title}
	if err := s.db.Create(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Service) GetThread(userID, threadID uint) (*models.ChatThread, error) {
	var t models.ChatThread
	if err := s.db.First(&t, threadID).Error; err != nil {
		return nil, ErrNotFound
	}
	if t.UserID != userID {
		return nil, projects.ErrDenied
	}
	return &t, nil
}

func (s *Service) ListMessages(userID, threadID uint) ([]models.ChatMessage, error) {
	if _, err := s.GetThread(userID, threadID); err != nil {
		return nil, err
	}
	var items []models.ChatMessage
	err := s.db.Where("thread_id = ?", threadID).Order("id asc").Find(&items).Error
	return items, err
}

// ListSkills returns the skill catalog for a project (HTTP / UI).
func (s *Service) ListSkills(userID, projectID uint) ([]skills.Meta, error) {
	opts, err := s.skillOpts(userID, projectID)
	if err != nil {
		return nil, err
	}
	return s.skills.List(opts)
}

// GetSkill loads one skill body for a project (HTTP / UI).
func (s *Service) GetSkill(userID, projectID uint, name string) (*skills.Skill, error) {
	opts, err := s.skillOpts(userID, projectID)
	if err != nil {
		return nil, err
	}
	return s.skills.Load(name, opts)
}

func (s *Service) skillOpts(userID, projectID uint) (skills.ListOptions, error) {
	project, err := s.projects.Get(userID, projectID)
	if err != nil {
		return skills.ListOptions{}, err
	}
	root, err := s.projects.AbsolutePath(project)
	if err != nil {
		return skills.ListOptions{}, err
	}
	return skills.ListOptions{
		ProjectRoot: root,
		UserID:      userID,
		DataRoot:    s.cfg.DataRoot,
	}, nil
}

type SendInput struct {
	ThreadID  uint   `json:"threadId"`
	ProjectID uint   `json:"projectId"`
	Content   string `json:"content"`
}

func (s *Service) Send(ctx context.Context, userID uint, input SendInput, emit func(Event)) error {
	content := strings.TrimSpace(input.Content)
	if content == "" {
		return fmt.Errorf("content is required")
	}

	var thread *models.ChatThread
	var err error
	if input.ThreadID == 0 {
		title := content
		if len(title) > 48 {
			title = title[:48]
		}
		thread, err = s.CreateThread(userID, input.ProjectID, title)
		if err != nil {
			return err
		}
		emit(Event{Type: "thread", ThreadID: thread.ID})
	} else {
		thread, err = s.GetThread(userID, input.ThreadID)
		if err != nil {
			return err
		}
	}

	project, err := s.projects.Get(userID, thread.ProjectID)
	if err != nil {
		return err
	}

	// Persist the raw user text; slash skill bodies are injected only into the model context.
	userMsg := models.ChatMessage{ThreadID: thread.ID, Role: "user", Content: content}
	if err := s.db.Create(&userMsg).Error; err != nil {
		return err
	}
	emit(Event{Type: "user_message", MessageID: userMsg.ID, Content: content, ThreadID: thread.ID})

	// One container per user; project slug selects the in-process Runtime.
	_, endpoint, token, err := s.runtime.EnsureRunning(userID)
	if err != nil {
		emit(Event{Type: "error", Error: err.Error()})
		return err
	}

	tools, err := s.mcp.ListTools(ctx, endpoint, token, project.Slug)
	if err != nil {
		emit(Event{Type: "error", Error: "mcp tools/list: " + err.Error()})
		return err
	}
	llmTools := mcpToolsToLLM(tools)
	llmTools = append(llmTools, skillToolsToLLM()...)

	skillOpts, err := s.skillOpts(userID, project.ID)
	if err != nil {
		emit(Event{Type: "error", Error: "skills: " + err.Error()})
		return err
	}
	skillCatalog, _ := s.skills.List(skillOpts)

	// Expand leading /skill-name mentions into loaded skill bodies for this turn only.
	modelUserContent := expandSlashSkills(content, s.skills, skillOpts)

	provider, apiKey, err := s.activeProvider()
	if err != nil {
		emit(Event{Type: "error", Error: err.Error()})
		return err
	}

	history, err := s.ListMessages(userID, thread.ID)
	if err != nil {
		return err
	}
	messages := []llm.Message{{
		Role:    "system",
		Content: buildSystemPrompt(project.Name, project.Slug, skillCatalog),
	}}
	// History already includes the just-saved user message; replace its content for the model if slash-expanded.
	llmHistory := dbMessagesToLLM(history)
	if len(llmHistory) > 0 && llmHistory[len(llmHistory)-1].Role == "user" {
		llmHistory[len(llmHistory)-1].Content = modelUserContent
	}
	messages = append(messages, llmHistory...)

	toolCallsUsed := 0
	for round := 0; round < s.cfg.ChatMaxRounds; round++ {
		emit(Event{Type: "model_round", Content: fmt.Sprintf("%d", round+1)})
		msg, finish, err := s.llm.ChatStream(ctx, provider.BaseURL, apiKey, llm.ChatRequest{
			Model:    provider.DefaultModel,
			Messages: messages,
			Tools:    llmTools,
		}, llm.StreamCallbacks{
			OnReasoningChunk: func(token string) {
				emit(Event{Type: "assistant_reasoning", Content: token, ThreadID: thread.ID})
			},
			OnContentChunk: func(token string) {
				emit(Event{Type: "assistant_delta", Content: token, ThreadID: thread.ID})
			},
		})
		if err != nil {
			emit(Event{Type: "error", Error: err.Error()})
			return err
		}

		if len(msg.ToolCalls) > 0 {
			toolJSON, _ := json.Marshal(msg.ToolCalls)
			assistant := models.ChatMessage{
				ThreadID:         thread.ID,
				Role:             "assistant",
				Content:          msg.Content,
				ReasoningContent: msg.ReasoningContent,
				ToolCallsJSON:    string(toolJSON),
			}
			_ = s.db.Create(&assistant).Error
			messages = append(messages, msg)

			for _, tc := range msg.ToolCalls {
				if toolCallsUsed >= s.cfg.ChatMaxToolCalls {
					emit(Event{Type: "error", Error: "tool call limit reached"})
					return fmt.Errorf("tool call limit")
				}
				toolCallsUsed++
				args := map[string]any{}
				_ = json.Unmarshal([]byte(tc.Function.Arguments), &args)
				emit(Event{Type: "tool_start", Tool: tc.Function.Name, Args: tc.Function.Arguments, ThreadID: thread.ID})

				var result string
				var callErr error
				if skills.IsPlatformTool(tc.Function.Name) {
					result, callErr = s.runSkillTool(tc.Function.Name, args, skillOpts)
				} else {
					result, callErr = s.mcp.CallTool(ctx, endpoint, token, project.Slug, tc.Function.Name, args)
				}
				if callErr != nil {
					result = callErr.Error()
				}
				// truncate huge tool outputs for model context
				resultForModel := result
				if len(resultForModel) > 24000 {
					resultForModel = resultForModel[:24000] + "\n…[truncated]"
				}
				emit(Event{Type: "tool_result", Tool: tc.Function.Name, Result: truncate(result, 8000), ThreadID: thread.ID})
				toolMsg := models.ChatMessage{
					ThreadID:   thread.ID,
					Role:       "tool",
					Content:    resultForModel,
					ToolCallID: tc.ID,
					Name:       tc.Function.Name,
				}
				_ = s.db.Create(&toolMsg).Error
				messages = append(messages, llm.Message{
					Role:       "tool",
					Content:    resultForModel,
					ToolCallID: tc.ID,
					Name:       tc.Function.Name,
				})
			}
			continue
		}

		// final assistant text
		assistant := models.ChatMessage{
			ThreadID:         thread.ID,
			Role:             "assistant",
			Content:          msg.Content,
			ReasoningContent: msg.ReasoningContent,
		}
		if err := s.db.Create(&assistant).Error; err != nil {
			return err
		}
		emit(Event{Type: "done", ThreadID: thread.ID, MessageID: assistant.ID, Content: finish})
		_ = s.db.Model(thread).Update("updated_at", time.Now())
		return nil
	}
	emit(Event{Type: "error", Error: "max model rounds reached"})
	return fmt.Errorf("max rounds")
}

func (s *Service) runSkillTool(name string, args map[string]any, opts skills.ListOptions) (string, error) {
	switch name {
	case skills.ToolListSkills:
		items, err := s.skills.List(opts)
		if err != nil {
			return "", err
		}
		return skills.ListJSON(items), nil
	case skills.ToolLoadSkill:
		raw, _ := args["name"].(string)
		sk, err := s.skills.Load(raw, opts)
		if err != nil {
			return "", err
		}
		return skills.LoadJSON(sk), nil
	default:
		return "", fmt.Errorf("unknown skill tool %q", name)
	}
}

// expandSlashSkills loads skills referenced as /name at the start of tokens.
// Unknown names are left unchanged. Loaded bodies are appended after the user text.
func expandSlashSkills(content string, svc *skills.Service, opts skills.ListOptions) string {
	if svc == nil || strings.TrimSpace(content) == "" {
		return content
	}
	matches := slashSkillRE.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return content
	}
	seen := map[string]struct{}{}
	var loaded []string
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		name := strings.TrimSpace(m[1])
		name = strings.Trim(name, "/")
		if name == "" {
			continue
		}
		// Trim trailing punctuation commonly attached in prose.
		name = strings.TrimRight(name, ".,;:!?）)]}")
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		sk, err := svc.Load(name, opts)
		if err != nil {
			continue
		}
		seen[key] = struct{}{}
		loaded = append(loaded, fmt.Sprintf("### Skill: %s (%s)\n\n%s", sk.Name, sk.Scope, sk.Body))
		// Cap preloaded skills per message.
		if len(loaded) >= 3 {
			break
		}
	}
	if len(loaded) == 0 {
		return content
	}
	var b strings.Builder
	b.WriteString(content)
	b.WriteString("\n\n---\nSkills loaded via slash command (follow these instructions):\n\n")
	b.WriteString(strings.Join(loaded, "\n\n"))
	return b.String()
}

func buildSystemPrompt(projectName, projectSlug string, catalog []skills.Meta) string {
	var b strings.Builder
	b.WriteString("You are an expert AI Coding Agent equipped with MCP coding tools inside an isolated project workspace.\n")
	b.WriteString(fmt.Sprintf("Current Project: %s (slug: %s)\n", projectName, projectSlug))
	b.WriteString("GUIDELINES:\n")
	b.WriteString("1. Always think step-by-step before executing actions.\n")
	b.WriteString("2. PROACTIVELY invoke available MCP tools (list_dir, list_files, read_file, search_text, apply_patch, exec_command, git_status, git_diff, and related tools) to inspect the workspace, edit code, and run commands.\n")
	b.WriteString("3. Prefer apply_patch for file edits; use exec_command for builds/tests/shell. Keep edits precise and summarize actions after tool use.\n")
	b.WriteString("4. When a task matches an available skill description, call load_skill first and follow that skill's instructions.\n")
	if section := skills.CatalogPrompt(catalog); section != "" {
		b.WriteString("\n")
		b.WriteString(section)
		b.WriteString("\n")
	}
	return b.String()
}

func skillToolsToLLM() []llm.ToolDefinition {
	schemas := skills.MetaToolSchemas()
	out := make([]llm.ToolDefinition, 0, len(schemas))
	for _, t := range schemas {
		params := t.Parameters
		if len(params) == 0 {
			params = json.RawMessage(`{"type":"object","properties":{}}`)
		}
		out = append(out, llm.ToolDefinition{
			Type: "function",
			Function: llm.ToolFunctionSchema{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  params,
			},
		})
	}
	return out
}

func (s *Service) activeProvider() (*models.ModelProvider, string, error) {
	var p models.ModelProvider
	err := s.db.Where("enabled = ?", true).Order("id asc").First(&p).Error
	if err == nil {
		key, decErr := crypto.DecryptString(s.cfg.DataEncryptionKey, p.APIKeyEnc)
		if decErr != nil {
			return nil, "", decErr
		}
		return &p, key, nil
	}
	if s.cfg.DefaultOpenAIKey == "" {
		return nil, "", fmt.Errorf("no model provider configured; set DEFAULT_OPENAI_API_KEY or add one in admin")
	}
	return &models.ModelProvider{
		Name:         "env-default",
		BaseURL:      s.cfg.DefaultOpenAIBase,
		DefaultModel: s.cfg.DefaultOpenAIModel,
		Enabled:      true,
	}, s.cfg.DefaultOpenAIKey, nil
}

func mcpToolsToLLM(tools []mcp.Tool) []llm.ToolDefinition {
	out := make([]llm.ToolDefinition, 0, len(tools))
	for _, t := range tools {
		schema := t.InputSchema
		if len(schema) == 0 {
			schema = json.RawMessage(`{"type":"object","properties":{}}`)
		}
		out = append(out, llm.ToolDefinition{
			Type: "function",
			Function: llm.ToolFunctionSchema{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  schema,
			},
		})
	}
	return out
}

func dbMessagesToLLM(items []models.ChatMessage) []llm.Message {
	out := make([]llm.Message, 0, len(items))
	for _, m := range items {
		msg := llm.Message{
			Role:             m.Role,
			Content:          m.Content,
			ReasoningContent: m.ReasoningContent,
			Name:             m.Name,
			ToolCallID:       m.ToolCallID,
		}
		if m.ToolCallsJSON != "" {
			var tcs []llm.ToolCall
			if json.Unmarshal([]byte(m.ToolCallsJSON), &tcs) == nil {
				msg.ToolCalls = tcs
			}
		}
		out = append(out, msg)
	}
	return out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
