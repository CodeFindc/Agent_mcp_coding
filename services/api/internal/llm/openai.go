package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	openai "github.com/sashabaranov/go-openai"
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

type StreamCallbacks struct {
	OnReasoningChunk func(chunk string)
	OnContentChunk   func(chunk string)
}

func (c *Client) getOpenAIClient(baseURL, apiKey string) *openai.Client {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		cleanBase := strings.TrimRight(baseURL, "/")
		if !strings.HasSuffix(cleanBase, "/v1") && !strings.Contains(cleanBase, "/v1/") {
			cleanBase += "/v1"
		}
		config.BaseURL = cleanBase
	}
	if c.httpClient != nil {
		config.HTTPClient = c.httpClient
	}
	return openai.NewClientWithConfig(config)
}

// ChatStream initiates real-time token-by-token streaming via sashabaranov/go-openai,
// invokes stream callbacks, handles <think> tags, and accumulates ToolCalls.
func (c *Client) ChatStream(
	ctx context.Context,
	baseURL, apiKey string,
	req ChatRequest,
	cb StreamCallbacks,
) (Message, string, error) {
	client := c.getOpenAIClient(baseURL, apiKey)

	oaiMsgs := make([]openai.ChatCompletionMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		msg := openai.ChatCompletionMessage{
			Role:       m.Role,
			Content:    m.Content,
			Name:       m.Name,
			ToolCallID: m.ToolCallID,
		}
		if len(m.ToolCalls) > 0 {
			tcs := make([]openai.ToolCall, 0, len(m.ToolCalls))
			for _, tc := range m.ToolCalls {
				tcs = append(tcs, openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolType(tc.Type),
					Function: openai.FunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				})
			}
			msg.ToolCalls = tcs
		}
		oaiMsgs = append(oaiMsgs, msg)
	}

	var oaiTools []openai.Tool
	if len(req.Tools) > 0 {
		oaiTools = make([]openai.Tool, 0, len(req.Tools))
		for _, t := range req.Tools {
			oaiTools = append(oaiTools, openai.Tool{
				Type: openai.ToolTypeFunction,
				Function: &openai.FunctionDefinition{
					Name:        t.Function.Name,
					Description: t.Function.Description,
					Parameters:  t.Function.Parameters,
				},
			})
		}
	}

	oaiReq := openai.ChatCompletionRequest{
		Model:    req.Model,
		Messages: oaiMsgs,
		Tools:    oaiTools,
		Stream:   true,
	}

	stream, err := client.CreateChatCompletionStream(ctx, oaiReq)
	if err != nil {
		return Message{}, "", fmt.Errorf("create chat stream: %w", err)
	}
	defer stream.Close()

	var finishReason string
	var contentBuilder strings.Builder
	var reasoningBuilder strings.Builder
	toolCallsMap := make(map[int]*ToolCall)

	inThinkTag := false
	var pendingBuffer string

	for {
		response, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return Message{}, "", fmt.Errorf("stream recv: %w", err)
		}

		if len(response.Choices) == 0 {
			continue
		}

		choice := response.Choices[0]
		if choice.FinishReason != "" {
			finishReason = string(choice.FinishReason)
		}

		// 1. Tool Call Delta accumulation
		for _, tc := range choice.Delta.ToolCalls {
			idx := 0
			if tc.Index != nil {
				idx = *tc.Index
			}
			existing, ok := toolCallsMap[idx]
			if !ok {
				toolCallsMap[idx] = &ToolCall{
					ID:   tc.ID,
					Type: string(tc.Type),
					Function: FunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				}
			} else {
				if tc.ID != "" {
					existing.ID = tc.ID
				}
				if tc.Type != "" {
					existing.Type = string(tc.Type)
				}
				if tc.Function.Name != "" {
					existing.Function.Name += tc.Function.Name
				}
				if tc.Function.Arguments != "" {
					existing.Function.Arguments += tc.Function.Arguments
				}
			}
		}

		// 2. Reasoning Content streaming (DeepSeek Reasoner / DeepSeek-R1 / OpenAI reasoning)
		if choice.Delta.ReasoningContent != "" {
			reasoningBuilder.WriteString(choice.Delta.ReasoningContent)
			if cb.OnReasoningChunk != nil {
				cb.OnReasoningChunk(choice.Delta.ReasoningContent)
			}
		}

		// 3. Content & <think> tag streaming
		textChunk := choice.Delta.Content
		if textChunk == "" {
			continue
		}

		pendingBuffer += textChunk

		// Stream tokens processing <think> ... </think> or regular text
		for len(pendingBuffer) > 0 {
			if !inThinkTag {
				lower := strings.ToLower(pendingBuffer)
				startIdx := strings.Index(lower, "<think>")
				if startIdx != -1 {
					// Text before <think> is normal content
					before := pendingBuffer[:startIdx]
					if before != "" {
						contentBuilder.WriteString(before)
						if cb.OnContentChunk != nil {
							cb.OnContentChunk(before)
						}
					}
					pendingBuffer = pendingBuffer[startIdx+7:]
					inThinkTag = true
				} else if strings.Contains(lower, "<thin") || strings.Contains(lower, "<") {
					// Might be part of <think> tag arriving across chunks, hold back prefix if at end
					if strings.HasSuffix(lower, "<") || strings.HasSuffix(lower, "<t") ||
						strings.HasSuffix(lower, "<th") || strings.HasSuffix(lower, "<thi") ||
						strings.HasSuffix(lower, "<thin") || strings.HasSuffix(lower, "<think") {
						break
					}
					// Normal text chunk
					contentBuilder.WriteString(pendingBuffer)
					if cb.OnContentChunk != nil {
						cb.OnContentChunk(pendingBuffer)
					}
					pendingBuffer = ""
				} else {
					contentBuilder.WriteString(pendingBuffer)
					if cb.OnContentChunk != nil {
						cb.OnContentChunk(pendingBuffer)
					}
					pendingBuffer = ""
				}
			} else {
				// We are inside <think> tag
				lower := strings.ToLower(pendingBuffer)
				endIdx := strings.Index(lower, "</think>")
				if endIdx != -1 {
					thinkText := pendingBuffer[:endIdx]
					if thinkText != "" {
						reasoningBuilder.WriteString(thinkText)
						if cb.OnReasoningChunk != nil {
							cb.OnReasoningChunk(thinkText)
						}
					}
					pendingBuffer = pendingBuffer[endIdx+8:]
					inThinkTag = false
				} else if strings.Contains(lower, "</") || strings.Contains(lower, "<") {
					if strings.HasSuffix(lower, "<") || strings.HasSuffix(lower, "</") ||
						strings.HasSuffix(lower, "</t") || strings.HasSuffix(lower, "</th") ||
						strings.HasSuffix(lower, "</thi") || strings.HasSuffix(lower, "</thin") ||
						strings.HasSuffix(lower, "</think") {
						break
					}
					reasoningBuilder.WriteString(pendingBuffer)
					if cb.OnReasoningChunk != nil {
						cb.OnReasoningChunk(pendingBuffer)
					}
					pendingBuffer = ""
				} else {
					reasoningBuilder.WriteString(pendingBuffer)
					if cb.OnReasoningChunk != nil {
						cb.OnReasoningChunk(pendingBuffer)
					}
					pendingBuffer = ""
				}
			}
		}
	}

	// Flush any remaining pendingBuffer
	if len(pendingBuffer) > 0 {
		if inThinkTag {
			reasoningBuilder.WriteString(pendingBuffer)
			if cb.OnReasoningChunk != nil {
				cb.OnReasoningChunk(pendingBuffer)
			}
		} else {
			contentBuilder.WriteString(pendingBuffer)
			if cb.OnContentChunk != nil {
				cb.OnContentChunk(pendingBuffer)
			}
		}
	}

	// Assemble tool calls in index order
	var finalToolCalls []ToolCall
	if len(toolCallsMap) > 0 {
		keys := make([]int, 0, len(toolCallsMap))
		for k := range toolCallsMap {
			keys = append(keys, k)
		}
		sort.Ints(keys)
		for _, k := range keys {
			finalToolCalls = append(finalToolCalls, *toolCallsMap[k])
		}
	}

	return Message{
		Role:             "assistant",
		Content:          strings.TrimSpace(contentBuilder.String()),
		ReasoningContent: strings.TrimSpace(reasoningBuilder.String()),
		ToolCalls:        finalToolCalls,
	}, finishReason, nil
}

func NewHTTPClientWithTimeout(d time.Duration) *http.Client {
	return &http.Client{Timeout: d}
}
