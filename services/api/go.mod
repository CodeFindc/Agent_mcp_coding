module github.com/coding-agent-platform/api

go 1.22.0

require (
	github.com/coreos/go-oidc/v3 v3.14.1
	github.com/docker/docker v27.1.1+incompatible
	github.com/docker/go-connections v0.5.0
	github.com/glebarez/sqlite v1.11.0
	github.com/go-chi/chi/v5 v5.2.1
	github.com/go-chi/cors v1.2.1
	github.com/pkg/errors v0.9.1
	golang.org/x/oauth2 v0.30.0
	gorm.io/driver/postgres v1.6.0
	gorm.io/gorm v1.30.0
)

replace github.com/pkg/errors => github.com/pkg/errors v0.9.1
