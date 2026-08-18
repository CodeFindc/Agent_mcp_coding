#!/usr/bin/env python3
"""Deploy Coding Agent Platform on a remote host via Paramiko helpers.
This script is intended to be copied to the server and run locally there.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path("/data/Agent_mcp_coding")
DEPLOY = ROOT / "deploy"
API = ROOT / "services" / "api"
WEB = ROOT / "apps" / "web"


def run(cmd: str, timeout: int = 3600, check: bool = True) -> int:
    print(f"\n$ {cmd}", flush=True)
    p = subprocess.run(cmd, shell=True, timeout=timeout)
    print(f"[exit {p.returncode}]", flush=True)
    if check and p.returncode != 0:
        raise SystemExit(p.returncode)
    return p.returncode


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print("wrote", path)


def main() -> None:
    os.chdir(ROOT)

    write(
        API / "Dockerfile.runtime",
        """FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* || true
WORKDIR /app
COPY dist/api /app/api
ENV HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/app/api"]
""",
    )

    write(
        WEB / "Dockerfile.runtime",
        """FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
""",
    )

    write(
        DEPLOY / "docker-compose.prod.yml",
        """services:
  postgres:
    image: postgres:16-alpine
    container_name: cap-postgres
    environment:
      POSTGRES_USER: cap
      POSTGRES_PASSWORD: cap
      POSTGRES_DB: cap
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cap -d cap"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped
    networks:
      - cap-net

  api:
    image: cap-api:local
    container_name: cap-api
    environment:
      HTTP_ADDR: ":8080"
      DATABASE_URL: postgres://cap:cap@postgres:5432/cap?sslmode=disable
      DATA_ROOT: /data/Agent_mcp_coding/data/workspaces
      SESSION_SECRET: cap-prod-session-secret-change-me-2026
      DATA_ENCRYPTION_KEY: cap-prod-data-encryption-key-32b-ok!!
      CORS_ORIGINS: http://192.168.110.208:3000,http://localhost:3000
      WEB_ORIGIN: http://192.168.110.208:3000
      DEV_AUTH_ENABLED: "true"
      COOKIE_SECURE: "false"
      CODING_TOOLS_IMAGE: coding-tools-mcp:local
      DOCKER_NETWORK: agent-internal
      PERMISSION_MODE: trusted
      RUNTIME_IDLE_MINUTES: "30"
      MAX_RUNNING_RUNTIMES_PER_USER: "1"
      DEFAULT_OPENAI_BASE_URL: ${DEFAULT_OPENAI_BASE_URL:-https://api.openai.com/v1}
      DEFAULT_OPENAI_API_KEY: ${DEFAULT_OPENAI_API_KEY:-}
      DEFAULT_OPENAI_MODEL: ${DEFAULT_OPENAI_MODEL:-gpt-4o-mini}
    volumes:
      - /data/Agent_mcp_coding/data/workspaces:/data/Agent_mcp_coding/data/workspaces
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "8180:8080"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - cap-net
      - agent-internal

  web:
    image: cap-web:local
    container_name: cap-web
    environment:
      NEXT_PUBLIC_API_BASE: http://192.168.110.208:8180
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - cap-net

volumes:
  pgdata:

networks:
  cap-net:
    driver: bridge
  agent-internal:
    name: agent-internal
    external: true
""",
    )

    if not (ROOT / ".env").exists():
        write(
            ROOT / ".env",
            """DEFAULT_OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_OPENAI_API_KEY=
DEFAULT_OPENAI_MODEL=gpt-4o-mini
""",
        )

    run("docker network create agent-internal 2>/dev/null || true", check=False)
    run("mkdir -p /data/Agent_mcp_coding/data/workspaces /data/Agent_mcp_coding/services/api/dist")

    # Build API binary with goproxy.cn
    api_build = r"""
set -e
export GOPROXY=https://goproxy.cn,https://proxy.golang.com.cn,direct
export GOSUMDB=off
export CGO_ENABLED=0
export GOTOOLCHAIN=local
docker run --rm --network host \
  -e GOPROXY -e GOSUMDB -e CGO_ENABLED -e GOTOOLCHAIN=local \
  -v /data/Agent_mcp_coding/services/api:/src \
  -w /src \
  golang:1.26-bookworm \
  bash -lc 'export PATH=/usr/local/go/bin:$PATH; export GOTOOLCHAIN=local; go version; go mod tidy && go build -o /src/dist/api ./cmd/api && ls -la /src/dist/api'
cd /data/Agent_mcp_coding/services/api
docker build -f Dockerfile.runtime -t cap-api:local .
"""
    if run(api_build, timeout=1200, check=False) != 0:
        print("API build retry with socks proxy", flush=True)
        api_build_proxy = r"""
set -e
export GOPROXY=https://goproxy.cn,direct
export GOSUMDB=off
export CGO_ENABLED=0
export HTTP_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export HTTPS_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export ALL_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export NO_PROXY=localhost,127.0.0.1,192.168.110.0/24
docker run --rm --network host \
  -e GOPROXY -e GOSUMDB -e CGO_ENABLED -e GOTOOLCHAIN=local \
  -e HTTP_PROXY -e HTTPS_PROXY -e ALL_PROXY -e NO_PROXY \
  -e PATH=/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  -v /data/Agent_mcp_coding/services/api:/src \
  -w /src \
  golang:1.26-bookworm \
  bash -lc 'export PATH=/usr/local/go/bin:$PATH; export GOTOOLCHAIN=local; go version; go mod tidy && go build -o /src/dist/api ./cmd/api && ls -la /src/dist/api'
cd /data/Agent_mcp_coding/services/api
docker build -f Dockerfile.runtime -t cap-api:local .
"""
        run(api_build_proxy, timeout=1200)

    # Build web
    web_build = r"""
set -e
cd /data/Agent_mcp_coding/apps/web
docker run --rm --network host \
  -e NEXT_PUBLIC_API_BASE=http://192.168.110.208:8180 \
  -e npm_config_registry=https://registry.npmmirror.com \
  -v /data/Agent_mcp_coding/apps/web:/app \
  -w /app \
  node:22-bookworm-slim \
  bash -lc 'set -e
    apt-get update >/dev/null
    apt-get install -y --no-install-recommends ca-certificates python3 make g++ >/dev/null
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
    test -f .next/standalone/server.js
  '
cd /data/Agent_mcp_coding/apps/web
docker build -f Dockerfile.runtime -t cap-web:local .
"""
    if run(web_build, timeout=1800, check=False) != 0:
        print("WEB build retry with socks proxy", flush=True)
        web_build_proxy = r"""
set -e
cd /data/Agent_mcp_coding/apps/web
export HTTP_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export HTTPS_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export ALL_PROXY=socks5://admin:1qaz2wsx@192.168.110.60:7890
export NO_PROXY=localhost,127.0.0.1,192.168.110.0/24
docker run --rm --network host \
  -e NEXT_PUBLIC_API_BASE=http://192.168.110.208:8180 \
  -e npm_config_registry=https://registry.npmmirror.com \
  -e HTTP_PROXY -e HTTPS_PROXY -e ALL_PROXY -e NO_PROXY \
  -v /data/Agent_mcp_coding/apps/web:/app \
  -w /app \
  node:22-bookworm-slim \
  bash -lc 'set -e
    apt-get update >/dev/null
    apt-get install -y --no-install-recommends ca-certificates python3 make g++ >/dev/null
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npm run build
    test -f .next/standalone/server.js
  '
cd /data/Agent_mcp_coding/apps/web
docker build -f Dockerfile.runtime -t cap-web:local .
"""
        run(web_build_proxy, timeout=1800)

    # Ensure coding-tools image exists
    run(
        "docker image inspect coding-tools-mcp:local >/dev/null 2>&1 || "
        "(cd /data/coding-tools-mcp && docker build -f Dockerfile.slim -t coding-tools-mcp:local .)",
        timeout=1800,
    )

    run(
        "cd /data/Agent_mcp_coding/deploy && docker compose -f docker-compose.prod.yml --env-file ../.env up -d",
        timeout=300,
    )
    time.sleep(6)
    run("docker ps --filter name=cap- --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'", check=False)
    run("docker logs cap-api --tail 80", check=False)
    run("docker logs cap-web --tail 40", check=False)
    run(
        "curl -sS http://127.0.0.1:8180/healthz; echo; "
        "curl -sS http://127.0.0.1:8180/api/v1/auth/config; echo; "
        "curl -sS -o /dev/null -w 'web:%{http_code}\\n' http://127.0.0.1:3000/",
        check=False,
    )

    # Smoke test
    smoke = r"""
set -e
COOKIE=/tmp/cap-cookie.txt
rm -f "$COOKIE"
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","name":"Admin","admin":true}' \
  http://127.0.0.1:8180/api/v1/auth/dev-login
echo
curl -sS -c "$COOKIE" -b "$COOKIE" http://127.0.0.1:8180/api/v1/auth/me
echo
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"demo-project"}' http://127.0.0.1:8180/api/v1/projects
echo
PID=$(curl -sS -c "$COOKIE" -b "$COOKIE" http://127.0.0.1:8180/api/v1/projects | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')
echo "project=$PID"
curl -sS -c "$COOKIE" -b "$COOKIE" -X POST "http://127.0.0.1:8180/api/v1/projects/${PID}/runtime/start"
echo
sleep 5
curl -sS -c "$COOKIE" -b "$COOKIE" "http://127.0.0.1:8180/api/v1/projects/${PID}/runtime"
echo
curl -sS -c "$COOKIE" -b "$COOKIE" http://127.0.0.1:8180/api/v1/runtimes
echo
docker ps --filter name=ctm- --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
"""
    run(smoke, timeout=180, check=False)
    print("DEPLOY COMPLETE", flush=True)


if __name__ == "__main__":
    main()
