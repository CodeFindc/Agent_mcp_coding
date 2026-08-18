.PHONY: api web tidy dev-api dev-web image-tools compose-up

api:
	cd services/api && go run ./cmd/api

web:
	cd apps/web && NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev

tidy:
	cd services/api && go get github.com/glebarez/sqlite@v1.11.0 && go mod tidy

image-tools:
	docker build -t coding-tools-mcp:local ../coding-tools-mcp

compose-up:
	docker compose -f deploy/docker-compose.yml up --build
