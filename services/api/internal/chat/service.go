package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/coding-agent-platform/api/internal/config"
	"github.com/coding-agent-platform/api/internal/crypto"
	"github.com/coding-agent-platform/api/internal/llm"
	"github.com/coding-agent-platform/api/internal/mcp"
	"github.com/coding-agent-platform/api/internal/models"
	"github.com/coding-agent-platform/api/internal/projects"
	"github.com/coding-agent-platform/api/internal/runtime"
	"gorm.io/gorm"
)

var ErrNotFound = errors.New("not found")

type Service struct {
	db       *gorm.DB
	cfg      config.Config
	projects *projects.Service
	runtime  *runtime.Service
	mcp      *mcp.Client
	llm      *llm.Client
}

func NewService(db *gorm.DB, cfg config.Config, projectsSvc *projects.Service, runtimeSvc *runtime.Service) *Service {
	return &Service{
		db:       db,
		cfg:      cfg,
		projects: projectsSvc,
		runtime:  runtimeSvc,
		mcp:      mcp.NewClient(cfg.MCPRequestTimeout),
		llm:      llm.NewClient(),
	}
}

type Event struct {
	Type    string `json:"type"`
	Content string `json:"content,omitempty"`
	Tool    string `json:"tool,omitempty"`
	Args    string `json:"args,omitempty"`
	Result  string `json:"result,omitempty"`
	Error   string `json:"error,omitempty"`
	ThreadID uint  `json:"threadId,omitempty"`
	MessageID uint `json:"messageId,omitempty"`
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

	userMsg := models.ChatMessage{ThreadID: thread.ID, Role: "user", Content: content}
	if err := s.db.Create(&userMsg).Error; err != nil {
		return err
	}
	emit(Event{Type: "user_message", MessageID: userMsg.ID, Content: content, ThreadID: thread.ID})

	// Ensure only this project's container is up; other projects keep running.
	_, endpoint, token, err := s.runtime.EnsureRunning(userID, project.ID)
	if err != nil {
		emit(Event{Type: "error", Error: err.Error()})
		return err
	}

	tools, err := s.mcp.ListTools(ctx, endpoint, token)
	if err != nil {
		emit(Event{Type: "error", Error: "mcp tools/list: " + err.Error()})
		return err
	}
	llmTools := mcpToolsToLLM(tools)

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
		Role: "system",
		Content: fmt.Sprintf(
			"You are a coding agent with MCP tools confined to the user workspace.\nProject: %s\nUse tools to inspect and modify files. Prefer small focused edits. Explain briefly after tool use.",
			project.Name,
		),
	}}
	messages = append(messages, dbMessagesToLLM(history)...)

	toolCallsUsed := 0
	for round := 0; round < s.cfg.ChatMaxRounds; round++ {
		emit(Event{Type: "model_round", Content: fmt.Sprintf("%d", round+1)})
		msg, finish, err := s.llm.ChatComplete(ctx, provider.BaseURL, apiKey, llm.ChatRequest{
			Model:    provider.DefaultModel,
			Messages: messages,
			Tools:    llmTools,
		})
		if err != nil {
			emit(Event{Type: "error", Error: err.Error()})
			return err
		}

		if len(msg.ToolCalls) > 0 {
			toolJSON, _ := json.Marshal(msg.ToolCalls)
			assistant := models.ChatMessage{
				ThreadID:      thread.ID,
				Role:          "assistant",
				Content:       msg.Content,
				ToolCallsJSON: string(toolJSON),
			}
			_ = s.db.Create(&assistant).Error
			if msg.Content != "" {
				emit(Event{Type: "assistant_delta", Content: msg.Content, ThreadID: thread.ID})
			}
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
				result, callErr := s.mcp.CallTool(ctx, endpoint, token, tc.Function.Name, args)
				if callErr != nil {
					result = callErr.Error()
				}
				// truncate huge tool outputs for model context
				resultForModel := result
				if len(resultForModel) > 24000 {
					resultForModel = resultForModel[:24000] + "\n…[truncated]"
				}
				emit(Event{Type: "tool_result", Tool: tc.Function.Name, Result: truncate(result, 4000), ThreadID: thread.ID})
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
		assistant := models.ChatMessage{ThreadID: thread.ID, Role: "assistant", Content: msg.Content}
		if err := s.db.Create(&assistant).Error; err != nil {
			return err
		}
		emit(Event{Type: "assistant_delta", Content: msg.Content, ThreadID: thread.ID, MessageID: assistant.ID})
		emit(Event{Type: "done", ThreadID: thread.ID, MessageID: assistant.ID, Content: finish})
		_ = s.db.Model(thread).Update("updated_at", time.Now())
		return nil
	}
	emit(Event{Type: "error", Error: "max model rounds reached"})
	return fmt.Errorf("max rounds")
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
		msg := llm.Message{Role: m.Role, Content: m.Content, Name: m.Name, ToolCallID: m.ToolCallID}
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
