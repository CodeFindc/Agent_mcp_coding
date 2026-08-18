package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Client struct {
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{httpClient: &http.Client{Timeout: 0}}
}

type Message struct {
	Role             string     `json:"role"`
	Content          string     `json:"content,omitempty"`
	ReasoningContent string     `json:"reasoning_content,omitempty"`
	Name             string     `json:"name,omitempty"`
	ToolCallID       string     `json:"tool_call_id,omitempty"`
	ToolCalls        []ToolCall `json:"tool_calls,omitempty"`
}

type ToolCall struct {
	ID       string       `json:"id"`
	Type     string       `json:"type"`
	Function FunctionCall `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ToolDefinition struct {
	Type     string             `json:"type"`
	Function ToolFunctionSchema `json:"function"`
}

type ToolFunctionSchema struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
}

type ChatRequest struct {
	Model    string           `json:"model"`
	Messages []Message        `json:"messages"`
	Tools    []ToolDefinition `json:"tools,omitempty"`
	Stream   bool             `json:"stream"`
}

type RawChoiceMessage struct {
	Role             string          `json:"role"`
	Content          any             `json:"content,omitempty"`
	ReasoningContent string          `json:"reasoning_content,omitempty"`
	Reasoning        string          `json:"reasoning,omitempty"`
	Thought          string          `json:"thought,omitempty"`
	Thoughts         string          `json:"thoughts,omitempty"`
	Name             string          `json:"name,omitempty"`
	ToolCallID       string          `json:"tool_call_id,omitempty"`
	ToolCalls        []ToolCall      `json:"tool_calls,omitempty"`
}

type ChatResponse struct {
	Choices []struct {
		Message      RawChoiceMessage `json:"message"`
		FinishReason string           `json:"finish_reason"`
	} `json:"choices"`
}

type StreamDelta struct {
	Content          string
	ToolCalls        []ToolCall
	FinishReason     string
	RawToolCallIndex map[int]ToolCall
}

func (c *Client) Chat(ctx context.Context, baseURL, apiKey string, req ChatRequest) (*ChatResponse, error) {
	req.Stream = false
	var out ChatResponse
	if err := c.doJSON(ctx, baseURL, apiKey, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

var (
	thinkTagRegex    = regexp.MustCompile(`(?is)<think>(.*?)</think>`)
	thoughtTagRegex  = regexp.MustCompile(`(?is)<thought>(.*?)</thought>`)
	thinkingTagRegex = regexp.MustCompile(`(?is)\[Thinking\](.*?)\[/Thinking\]`)
)

// ChatComplete calls completion for reliability in tool loops, extracts reasoning
// and synthesizes content for the SSE layer.
func (c *Client) ChatComplete(ctx context.Context, baseURL, apiKey string, req ChatRequest) (Message, string, error) {
	resp, err := c.Chat(ctx, baseURL, apiKey, req)
	if err != nil {
		return Message{}, "", err
	}
	if len(resp.Choices) == 0 {
		return Message{}, "", fmt.Errorf("empty choices from model")
	}
	ch := resp.Choices[0]
	msg := sanitizeChoiceMessage(ch.Message)

	return msg, ch.FinishReason, nil
}

func sanitizeChoiceMessage(raw RawChoiceMessage) Message {
	var contentStr string
	var extractedReasoning string

	// Extract reasoning from various provider fields
	if raw.ReasoningContent != "" {
		extractedReasoning = strings.TrimSpace(raw.ReasoningContent)
	} else if raw.Reasoning != "" {
		extractedReasoning = strings.TrimSpace(raw.Reasoning)
	} else if raw.Thought != "" {
		extractedReasoning = strings.TrimSpace(raw.Thought)
	} else if raw.Thoughts != "" {
		extractedReasoning = strings.TrimSpace(raw.Thoughts)
	}

	// Parse Content (could be string or array of parts)
	switch v := raw.Content.(type) {
	case string:
		contentStr = v
	case []any:
		var sb strings.Builder
		for _, part := range v {
			if m, ok := part.(map[string]any); ok {
				if t, ok := m["type"].(string); ok {
					if t == "text" {
						if txt, ok := m["text"].(string); ok {
							sb.WriteString(txt)
						}
					} else if t == "thinking" || t == "thought" {
						if th, ok := m["thinking"].(string); ok && extractedReasoning == "" {
							extractedReasoning = th
						} else if th, ok := m["thought"].(string); ok && extractedReasoning == "" {
							extractedReasoning = th
						}
					}
				}
			}
		}
		contentStr = sb.String()
	default:
		if raw.Content != nil {
			contentStr = fmt.Sprintf("%v", raw.Content)
		}
	}

	// Extract tags like <think>...</think>, <thought>...</thought> from contentStr if reasoning is not yet set
	if extractedReasoning == "" {
		if m := thinkTagRegex.FindStringSubmatch(contentStr); len(m) > 1 {
			extractedReasoning = strings.TrimSpace(m[1])
			contentStr = strings.TrimSpace(thinkTagRegex.ReplaceAllString(contentStr, ""))
		} else if m := thoughtTagRegex.FindStringSubmatch(contentStr); len(m) > 1 {
			extractedReasoning = strings.TrimSpace(m[1])
			contentStr = strings.TrimSpace(thoughtTagRegex.ReplaceAllString(contentStr, ""))
		} else if m := thinkingTagRegex.FindStringSubmatch(contentStr); len(m) > 1 {
			extractedReasoning = strings.TrimSpace(m[1])
			contentStr = strings.TrimSpace(thinkingTagRegex.ReplaceAllString(contentStr, ""))
		} else {
			// Handle unclosed <think> tag
			lower := strings.ToLower(contentStr)
			if idx := strings.Index(lower, "<think>"); idx != -1 {
				extractedReasoning = strings.TrimSpace(contentStr[idx+7:])
				contentStr = strings.TrimSpace(contentStr[:idx])
			}
		}
	}

	return Message{
		Role:             raw.Role,
		Content:          contentStr,
		ReasoningContent: extractedReasoning,
		Name:             raw.Name,
		ToolCallID:       raw.ToolCallID,
		ToolCalls:        raw.ToolCalls,
	}
}

func (c *Client) doJSON(ctx context.Context, baseURL, apiKey string, reqBody any, out any) error {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"
	raw, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("llm status %d: %s", resp.StatusCode, truncate(string(body), 800))
	}
	return json.Unmarshal(body, out)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func NewHTTPClientWithTimeout(d time.Duration) *http.Client {
	return &http.Client{Timeout: d}
}
