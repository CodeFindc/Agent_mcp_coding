$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\services\api"

$env:GOPROXY = if ($env:GOPROXY) { $env:GOPROXY } else { "https://goproxy.cn,direct" }
$env:HTTP_ADDR = if ($env:HTTP_ADDR) { $env:HTTP_ADDR } else { ":8080" }
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "file:$Root\data\platform.db?cache=shared&_fk=1" }
$env:DATA_ROOT = if ($env:DATA_ROOT) { $env:DATA_ROOT } else { "$Root\data\workspaces" }
$env:SESSION_SECRET = if ($env:SESSION_SECRET) { $env:SESSION_SECRET } else { "dev-session-secret-change-me-please" }
$env:DATA_ENCRYPTION_KEY = if ($env:DATA_ENCRYPTION_KEY) { $env:DATA_ENCRYPTION_KEY } else { "dev-data-encryption-key-32b-min!!" }
$env:CORS_ORIGINS = if ($env:CORS_ORIGINS) { $env:CORS_ORIGINS } else { "http://localhost:3000" }
$env:WEB_ORIGIN = if ($env:WEB_ORIGIN) { $env:WEB_ORIGIN } else { "http://localhost:3000" }
$env:DEV_AUTH_ENABLED = if ($env:DEV_AUTH_ENABLED) { $env:DEV_AUTH_ENABLED } else { "true" }
$env:CODING_TOOLS_IMAGE = if ($env:CODING_TOOLS_IMAGE) { $env:CODING_TOOLS_IMAGE } else { "coding-tools-mcp:local" }
$env:DOCKER_NETWORK = if ($env:DOCKER_NETWORK) { $env:DOCKER_NETWORK } else { "agent-internal" }
$env:PERMISSION_MODE = if ($env:PERMISSION_MODE) { $env:PERMISSION_MODE } else { "trusted" }
$env:DEFAULT_OPENAI_BASE_URL = if ($env:DEFAULT_OPENAI_BASE_URL) { $env:DEFAULT_OPENAI_BASE_URL } else { "https://api.openai.com/v1" }
$env:DEFAULT_OPENAI_MODEL = if ($env:DEFAULT_OPENAI_MODEL) { $env:DEFAULT_OPENAI_MODEL } else { "gpt-4o-mini" }

go mod tidy
go run ./cmd/api
