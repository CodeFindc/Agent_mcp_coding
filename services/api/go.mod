module github.com/coding-agent-platform/api

go 1.22

require (
	github.com/coreos/go-oidc/v3 v3.14.1
	github.com/docker/docker v28.2.2+incompatible
	github.com/glebarez/sqlite v1.11.0
	github.com/go-chi/chi/v5 v5.2.1
	github.com/go-chi/cors v1.2.1
	golang.org/x/oauth2 v0.30.0
	gorm.io/driver/postgres v1.6.0
	gorm.io/gorm v1.30.0
)

// Run from services/api:
//   go mod tidy
// This will fill indirect requires for your Go toolchain.
