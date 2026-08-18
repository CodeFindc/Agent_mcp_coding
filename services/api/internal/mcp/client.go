package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

const protocolVersion = "2025-06-18"

type Client struct {
	httpClient *http.Client
	nextID     atomic.Int64
}

type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	InputSchema json.RawMessage `json:"inputSchema,omitempty"`
}

func NewClient(timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	return &Client{
		httpClient: &http.Client{Timeout: timeout},
	}
}

func (c *Client) ListTools(ctx context.Context, baseURL, authToken string) ([]Tool, error) {
	session, err := c.initialize(ctx, baseURL, authToken)
	if err != nil {
		return nil, err
	}
	raw, err := c.rpc(ctx, baseURL, authToken, session, "tools/list", map[string]any{})
	if err != nil {
		return nil, err
	}
	var payload struct {
		Tools []Tool `json:"tools"`
	}
	if err = json.Unmarshal(raw, &payload); err != nil {
		return nil, err
	}
	return payload.Tools, nil
}

func (c *Client) CallTool(ctx context.Context, baseURL, authToken, name string, arguments map[string]any) (string, error) {
	if arguments == nil {
		arguments = map[string]any{}
	}
	session, err := c.initialize(ctx, baseURL, authToken)
	if err != nil {
		return "", err
	}
	raw, err := c.rpc(ctx, baseURL, authToken, session, "tools/call", map[string]any{
		"name":      name,
		"arguments": arguments,
	})
	if err != nil {
		return "", err
	}
	return normalizeToolResult(raw)
}

func (c *Client) Ping(ctx context.Context, baseURL, authToken string) error {
	_, err := c.initialize(ctx, baseURL, authToken)
	return err
}

func (c *Client) initialize(ctx context.Context, baseURL, authToken string) (string, error) {
	params := map[string]any{
		"protocolVersion": protocolVersion,
		"capabilities":    map[string]any{},
		"clientInfo": map[string]any{
			"name":    "coding-agent-platform",
			"version": "0.1.0",
		},
	}
	_, sessionID, err := c.rpcWithSession(ctx, baseURL, authToken, "", "initialize", params, false)
	if err != nil {
		return "", err
	}
	_, _, err = c.rpcWithSession(ctx, baseURL, authToken, sessionID, "notifications/initialized", nil, true)
	if err != nil {
		return "", err
	}
	return sessionID, nil
}

func (c *Client) rpc(ctx context.Context, baseURL, authToken, sessionID, method string, params any) (json.RawMessage, error) {
	result, _, err := c.rpcWithSession(ctx, baseURL, authToken, sessionID, method, params, false)
	return result, err
}

func (c *Client) rpcWithSession(
	ctx context.Context,
	baseURL, authToken, sessionID, method string,
	params any,
	notification bool,
) (json.RawMessage, string, error) {
	endpoint := strings.TrimSpace(baseURL)
	if endpoint == "" {
		return nil, sessionID, fmt.Errorf("mcp base url empty")
	}
	payload := map[string]any{
		"jsonrpc": "2.0",
		"method":  method,
	}
	if params != nil {
		payload["params"] = params
	}
	if !notification {
		payload["id"] = c.nextID.Add(1)
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, sessionID, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, sessionID, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	if token := strings.TrimSpace(authToken); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if sessionID != "" {
		req.Header.Set("Mcp-Session-Id", sessionID)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, sessionID, err
	}
	defer resp.Body.Close()
	if next := strings.TrimSpace(resp.Header.Get("Mcp-Session-Id")); next != "" {
		sessionID = next
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, sessionID, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, sessionID, fmt.Errorf("mcp status %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}
	if notification {
		return nil, sessionID, nil
	}
	result, err := parseRPCResponse(resp.Header.Get("Content-Type"), raw)
	return result, sessionID, err
}

func parseRPCResponse(contentType string, body []byte) (json.RawMessage, error) {
	payload := strings.TrimSpace(string(body))
	if payload == "" {
		return nil, fmt.Errorf("empty mcp response")
	}
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if strings.EqualFold(mediaType, "text/event-stream") {
		payload = extractSSEData(payload)
		if payload == "" {
			return nil, fmt.Errorf("empty sse payload")
		}
	}
	var response struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		return nil, err
	}
	if response.Error != nil {
		return nil, fmt.Errorf("mcp error %d: %s", response.Error.Code, response.Error.Message)
	}
	if len(response.Result) == 0 {
		return json.RawMessage(`{}`), nil
	}
	return response.Result, nil
}

func extractSSEData(payload string) string {
	reader := bufio.NewReader(strings.NewReader(payload))
	var dataLines []string
	for {
		line, err := reader.ReadString('\n')
		if err != nil && len(line) == 0 {
			break
		}
		line = strings.TrimRight(line, "\r\n")
		if line == "" {
			if len(dataLines) > 0 {
				break
			}
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		dataLines = append(dataLines, data)
	}
	return strings.TrimSpace(strings.Join(dataLines, "\n"))
}

func normalizeToolResult(raw json.RawMessage) (string, error) {
	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return string(raw), nil
	}
	var parts []string
	for _, c := range parsed.Content {
		if strings.TrimSpace(c.Text) != "" {
			parts = append(parts, c.Text)
		}
	}
	out := strings.Join(parts, "\n")
	if out == "" {
		out = string(raw)
	}
	if parsed.IsError {
		return out, fmt.Errorf("tool error: %s", out)
	}
	return out, nil
}
