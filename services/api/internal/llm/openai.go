package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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

type ChatResponse struct {
	Choices []struct {
		Message      Message `json:"message"`
		FinishReason string  `json:"finish_reason"`
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
	msg := ch.Message

	// If reasoning_content was not provided natively, check for <think>...</think> tags
	if msg.ReasoningContent == "" && strings.Contains(msg.Content, "<think>") {
		start := strings.Index(msg.Content, "<think>")
		end := strings.Index(msg.Content, "</think>")
		if start != -1 && end != -1 && end > start {
			msg.ReasoningContent = strings.TrimSpace(msg.Content[start+7 : end])
			after := strings.TrimSpace(msg.Content[end+8:])
			before := strings.TrimSpace(msg.Content[:start])
			if before != "" && after != "" {
				msg.Content = before + "\n" + after
			} else if after != "" {
				msg.Content = after
			} else {
				msg.Content = before
			}
		}
	}

	return msg, ch.FinishReason, nil
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

// Optional true SSE reader for future use.
func readSSELines(r io.Reader, fn func(data string) error) error {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			return nil
		}
		if err := fn(data); err != nil {
			return err
		}
	}
	return sc.Err()
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
