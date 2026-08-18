#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/services/api"
export HTTP_ADDR="${HTTP_ADDR:-:8080}"
export DATABASE_URL="${DATABASE_URL:-file:$ROOT/data/platform.db?cache=shared&_fk=1}"
export DATA_ROOT="${DATA_ROOT:-$ROOT/data/workspaces}"
export SESSION_SECRET="${SESSION_SECRET:-dev-session-secret-change-me-please}"
export DATA_ENCRYPTION_KEY="${DATA_ENCRYPTION_KEY:-dev-data-encryption-key-32b-min!!}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:3000}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
export DEV_AUTH_ENABLED="${DEV_AUTH_ENABLED:-true}"
export CODING_TOOLS_IMAGE="${CODING_TOOLS_IMAGE:-coding-tools-mcp:local}"
export DOCKER_NETWORK="${DOCKER_NETWORK:-agent-internal}"
export PERMISSION_MODE="${PERMISSION_MODE:-trusted}"
export DEFAULT_OPENAI_BASE_URL="${DEFAULT_OPENAI_BASE_URL:-https://api.openai.com/v1}"
export DEFAULT_OPENAI_API_KEY="${DEFAULT_OPENAI_API_KEY:-}"
export DEFAULT_OPENAI_MODEL="${DEFAULT_OPENAI_MODEL:-gpt-4o-mini}"
go mod tidy
go run ./cmd/api
