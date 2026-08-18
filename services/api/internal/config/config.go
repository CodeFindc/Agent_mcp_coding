package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddr            string
	DatabaseURL         string
	DataRoot            string
	SessionSecret       string
	DataEncryptionKey   string
	CORSOrigins         []string
	DevAuthEnabled      bool
	OIDCIssuer          string
	OIDCClientID        string
	OIDCClientSecret    string
	OIDCRedirectURL     string
	WebOrigin           string
	CodingToolsImage    string
	DockerNetwork       string
	PermissionMode      string
	RuntimeIdleMinutes  int
	MCPRequestTimeout   time.Duration
	ChatMaxRounds       int
	ChatMaxToolCalls    int
	DefaultOpenAIBase   string
	DefaultOpenAIKey    string
	DefaultOpenAIModel  string
	CookieSecure        bool
	CookieName          string
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:           env("HTTP_ADDR", ":8080"),
		DatabaseURL:        env("DATABASE_URL", "file:platform.db?cache=shared&_fk=1"),
		DataRoot:           env("DATA_ROOT", "./data/workspaces"),
		SessionSecret:      env("SESSION_SECRET", "dev-session-secret-change-me"),
		DataEncryptionKey:  env("DATA_ENCRYPTION_KEY", "dev-data-encryption-key-32b!!"),
		CORSOrigins:        splitCSV(env("CORS_ORIGINS", "http://localhost:3000")),
		DevAuthEnabled:     envBool("DEV_AUTH_ENABLED", true),
		OIDCIssuer:         env("OIDC_ISSUER", ""),
		OIDCClientID:       env("OIDC_CLIENT_ID", ""),
		OIDCClientSecret:   env("OIDC_CLIENT_SECRET", ""),
		OIDCRedirectURL:    env("OIDC_REDIRECT_URL", "http://localhost:8080/api/v1/auth/oidc/callback"),
		WebOrigin:          env("WEB_ORIGIN", "http://localhost:3000"),
		CodingToolsImage:   env("CODING_TOOLS_IMAGE", "coding-tools-mcp:local"),
		DockerNetwork:      env("DOCKER_NETWORK", "agent-internal"),
		PermissionMode:     env("PERMISSION_MODE", "trusted"),
		RuntimeIdleMinutes: envInt("RUNTIME_IDLE_MINUTES", 30),
		MCPRequestTimeout:  time.Duration(envInt("MCP_REQUEST_TIMEOUT_MS", 120000)) * time.Millisecond,
		ChatMaxRounds:      envInt("CHAT_MAX_ROUNDS", 12),
		ChatMaxToolCalls:   envInt("CHAT_MAX_TOOL_CALLS", 32),
		DefaultOpenAIBase:  env("DEFAULT_OPENAI_BASE_URL", "https://api.openai.com/v1"),
		DefaultOpenAIKey:   env("DEFAULT_OPENAI_API_KEY", ""),
		DefaultOpenAIModel: env("DEFAULT_OPENAI_MODEL", "gpt-4o-mini"),
		CookieSecure:       envBool("COOKIE_SECURE", false),
		CookieName:         env("COOKIE_NAME", "cap_session"),
	}
	if len(cfg.DataEncryptionKey) < 32 {
		return Config{}, fmt.Errorf("DATA_ENCRYPTION_KEY must be at least 32 bytes")
	}
	if cfg.SessionSecret == "" {
		return Config{}, fmt.Errorf("SESSION_SECRET is required")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}

func envInt(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
