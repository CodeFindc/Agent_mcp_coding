# Coding Agent Platform

独立的多用户编码 Agent 控制台：**不依赖 DEEIX**。

- OIDC / Dev 登录
- 每用户独立项目目录（持久化）
- **每用户一个** `coding-tools-mcp` 容器；容器内多项目 Runtime（按 slug 隔离）
- OpenAI 兼容模型 + 工具循环（MCP tools + `_meta` 传 project slug）
- Go API + Next.js 前端

## 架构

```text
Browser (Next.js :3000)
   │ cookie session
   ▼
API (Go :8080)
   ├─ projects / auth / admin
   ├─ chat agent loop (OpenAI-compatible)
   └─ Docker → ctm-u{userId} (coding-tools-mcp multi-project)
                 volume: DATA_ROOT/users/{id}/projects → /projects
                 env: CODING_TOOLS_MCP_PROJECTS_ROOT=/projects
                 tools/call _meta: coding-tools-mcp/project = slug
                 （不 publish 宿主端口；Docker 网 agent-internal 内访问）
```

同一用户多个项目共享一个容器，进程内按目录隔离：

```text
User A ── ctm-u{A}
            ├─ /projects/proj-a  → Runtime A
            ├─ /projects/proj-b  → Runtime B
            └─ MCP 每次调用带 slug 选择 Runtime
```

空闲回收按**用户 runtime** 计时（`RUNTIME_IDLE_MINUTES`）。每用户最多 1 个 coding-tools 容器。

## 快速开始（本机开发）

### 0. 前置

- Go 1.22+
- Node 20+
- Docker Desktop（用于用户工作区容器）
- 已构建的 coding-tools 镜像

### 1. 构建 coding-tools-mcp 镜像

```bash
docker build -t coding-tools-mcp:local D:/dev/coding-tools-mcp
```

### 2. 启动 API

**PowerShell（推荐，Windows）：**

```powershell
cd D:\dev\coding-agent-platform
$env:DEFAULT_OPENAI_API_KEY="sk-..."   # 或之后在管理页配置
.\scripts\dev-api.ps1
```

**bash：**

```bash
cd D:/dev/coding-agent-platform
export DEFAULT_OPENAI_API_KEY=sk-...
./scripts/dev-api.sh
```

脚本会 `go mod tidy` 后启动 API。

默认：

- API: http://localhost:8080
- SQLite: `data/platform.db`（由 `DATABASE_URL` 决定）
- 工作区目录: `data/workspaces`

### 3. 启动 Web

**PowerShell：**

```powershell
cd D:\dev\coding-agent-platform
.\scripts\dev-web.ps1
```

**bash：**

```bash
./scripts/dev-web.sh
```

打开 http://localhost:3000 → **Dev Login**（首个用户自动成为 admin）。

### 4. 使用流程

1. 创建多个项目  
2. 点「启动工作区」（起用户容器 `ctm-u…`，挂载全部 projects 父目录）  
3. 在对应项目下对话；API 将 project slug 传给 MCP，工具只读写该项目目录  
4. 可同时在另一项目对话（同一容器、另一 Runtime）  
5. Admin 页配置模型渠道（可选）

## Docker Compose

```bash
cd D:/dev/coding-agent-platform
docker build -t coding-tools-mcp:local D:/dev/coding-tools-mcp
export DEFAULT_OPENAI_API_KEY=sk-...
docker compose -f deploy/docker-compose.yml up --build
```

- Web: http://localhost:3000  
- API: http://localhost:8080  
- Postgres: localhost:5432  

> API 容器挂载了 docker.sock，用于为每个 **用户** 创建 coding-tools 容器。  
> Windows 上请确保 Docker Desktop 允许该挂载。

## OIDC

在 `.env` 中设置：

```env
DEV_AUTH_ENABLED=false
OIDC_ISSUER=https://your-idp/realms/xxx
OIDC_CLIENT_ID=coding-agent-platform
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URL=http://localhost:8080/api/v1/auth/oidc/callback
```

IdP 回调地址必须指向 API 的 `/api/v1/auth/oidc/callback`。登录成功后会重定向到 `WEB_ORIGIN`。

## 关键环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `MAX_RUNNING_RUNTIMES_PER_USER` | `3` | 每用户同时 running 的项目容器上限 |
| `RUNTIME_IDLE_MINUTES` | `30` | 项目 runtime 空闲后自动停止 |
| `CODING_TOOLS_IMAGE` | `coding-tools-mcp:local` | 工作区镜像 |
| `DOCKER_NETWORK` | `agent-internal` | 用户容器所在 Docker 网络 |
| `PERMISSION_MODE` | `trusted` | 传入 coding-tools 的权限模式 |

完整列表见 `.env.example`。

## API 一览

| Method | Path | 说明 |
|--------|------|------|
| GET | `/healthz` | 健康检查 |
| GET | `/api/v1/auth/config` | 登录方式 |
| POST | `/api/v1/auth/dev-login` | 开发登录 |
| GET | `/api/v1/auth/oidc/login` | OIDC 跳转 |
| GET | `/api/v1/auth/me` | 当前用户 |
| GET/POST/DELETE | `/api/v1/projects` | 项目列表 / 创建 / 删除 |
| GET | `/api/v1/projects/{id}/runtime` | 该项目 runtime 状态 |
| POST | `/api/v1/projects/{id}/runtime/start` | 仅启动该项目容器 |
| POST | `/api/v1/projects/{id}/runtime/stop` | 仅停止该项目容器 |
| POST | `/api/v1/projects/{id}/activate` | start 的兼容别名 |
| GET | `/api/v1/runtimes` | 当前用户所有 runtime 摘要（running/limit） |
| POST | `/api/v1/chat/send` | SSE 对话 + 工具循环（EnsureRunning 当前项目） |
| * | `/api/v1/admin/*` | 模型渠道 / 用户 / 平台信息 |

## 安全说明

- 浏览器只访问平台 API，不持有容器 MCP token  
- 用户容器默认不映射公网端口，仅 Docker 网络内可达  
- 项目路径限制在 `DATA_ROOT` 下；每容器只挂一个项目目录  
- 生产请关闭 `DEV_AUTH_ENABLED`，轮换 `SESSION_SECRET` / `DATA_ENCRYPTION_KEY`  
- `PERMISSION_MODE` 建议 `safe` 或 `trusted`，不要默认 `dangerous`

## 目录结构

```text
coding-agent-platform/
  apps/web/                 Next.js UI
  services/api/             Go API
  deploy/docker-compose.yml
  data/workspaces/          用户项目持久化
  docs/
  README.md
```

## 与 coding-tools-mcp 的关系

平台使用支持 **multi-project** 的 coding-tools-mcp 镜像：  
`CODING_TOOLS_MCP_PROJECTS_ROOT=/projects`，每次 MCP 调用通过  
`params._meta["coding-tools-mcp/project"]`（及可选 Header `X-Coding-Tools-Project`）选择 slug。  
详见 coding-tools 仓库 `docs/multi-project.md`。

多租户边界仍是 **每用户一容器**；同用户项目之间是路径级隔离，共享进程与 bearer token。

## 已知限制（MVP）

- 同用户项目共享容器与 token（非多租户安全边界）  
- Chat 完成调用暂为非 token 级流式（SSE 推送轮次/工具/完整回复）  
- 单机 Docker；未做 K8s  
- 无计费 / 无组织级 RBAC  

## 许可证

与部署环境自行约定；本仓库脚手架默认按内部项目使用。若对外开源请补充 LICENSE。
