# Coding Agent Platform

独立的多用户编码 Agent 云端工作台与协作平台：**不依赖 DEEIX**。

- ⚡ **对齐智谱清言 / OpenAI Codex / Cursor 的现代化沉浸式工作台**
- 🧠 **大模型深度思考过程 (Reasoning / 思维链)**：流式推送与独立折叠面板
- 🛠️ **`coding-tools-mcp` 专业级工具可视化**：专属黑底终端控制台、文件 Diff 差异对比、目录检索
- 📂 **项目目录文件树 (File Explorer)**：多级展开折叠、模糊搜索过滤、多彩文件类型图标
- 🔍 **Monaco 代码预览与 Git 变更 Diff**：VS Code 级代码高亮、Minimap、Git Status 与双栏 DiffEditor
- 📦 **每用户专属沙箱容器**：多项目按 slug 在容器内隔离执行
- 🇨🇳 **全链路国内构建加速 (CN Acceleration)**：内置 `apt`、`pip`、`goproxy`、`npm` 国内镜像源
- 🔐 **企业级认证与管理**：OIDC / Dev 单点登录、多渠道大模型配置 (OpenAI 兼容)、用户权限管控

---

## 系统架构

```text
Browser (Next.js :3000 - Edge-to-Edge IDE Layout)
   │ 
   │  REST / SSE (Cookie Session)
   ▼
API Gateway (Go :8080)
   ├─ Auth / OIDC / Dev Login
   ├─ Project Files / Git Status / Git Diff
   ├─ Chat Agent Loop & Reasoning Extractor
   └─ Docker Runtime Engine → ctm-u{userId} (coding-tools-mcp)
                  volume: DATA_ROOT/users/{id}/projects → /projects
                  env: CODING_TOOLS_MCP_PROJECTS_ROOT=/projects
                  tools/call _meta: coding-tools-mcp/project = slug
                  （容器不暴露宿主端口，仅内部 Docker 网络访问）
```

### 多项目容器共享架构

同一用户多个项目共享一个专属 coding-tools 沙箱容器，进程内按目录严格隔离：

```text
User A ── ctm-u{A} (独立 Linux 沙箱容器)
            ├─ /projects/proj-a  → Runtime A (isolated workspace)
            ├─ /projects/proj-b  → Runtime B (isolated workspace)
            └─ 每次 MCP 工具调用携带 slug 自动切换工作区根目录
```

---

## 界面布局概览

```
+------------------+-------------------+----------------------------+-----------------------------+
| Col 1: 侧边导航   | Col 2: 文件树抽屉  | Col 3: 核心提问/对话舞台    | Col 4: 最右侧代码预览/Diff  |
| - 项目列表/切换   | - 递归目录树       | - 消息卡片                 | - Monaco Editor 代码预览    |
| - [查看文件] 按钮  | - 文件模糊搜索    | - 思考链折叠卡片           | - Monaco DiffEditor 对比   |
| - 会话历史管理    | - Git 变更文件列表 | - coding-tools-mcp 工具卡片 | - 全屏/复制/只读模式        |
| - 用户/管理后台   | - 实时一键刷新    | - 悬浮智能提问控制台       | - 工作区运行态与 MCP 概览   |
+------------------+-------------------+----------------------------+-----------------------------+
```

---

## 快速开始（本机开发）

### 0. 前置环境

- Go 1.22+
- Node.js 20+
- Docker Desktop（用于创建沙箱容器）
- 已构建的 `coding-tools-mcp` 镜像

### 1. 构建 coding-tools-mcp 镜像

```bash
docker build -t coding-tools-mcp:local D:/dev/coding-tools-mcp
```

### 2. 启动 API 服务

**PowerShell（Windows 推荐）：**

```powershell
cd D:\dev\coding-agent-platform
$env:DEFAULT_OPENAI_API_KEY="sk-..."   # 或在管理后台可视化添加
.\scripts\dev-api.ps1
```

**Bash (Linux / macOS)：**

```bash
cd D:/dev/coding-agent-platform
export DEFAULT_OPENAI_API_KEY=sk-...
./scripts/dev-api.sh
```

默认配置：
- API 服务: `http://localhost:8080`
- 数据库: SQLite `data/platform.db`
- 工作区路径: `data/workspaces`
- GoProxy: 自动使用 `https://goproxy.cn,direct` 加速

### 3. 启动 Web 前端

**PowerShell：**

```powershell
cd D:\dev\coding-agent-platform
.\scripts\dev-web.ps1
```

**Bash：**

```bash
./scripts/dev-web.sh
```

访问 `http://localhost:3000`，点击 **Dev Login** 即可一键登录（首个用户自动获得 admin 权限）。

---

## Docker Compose 一键部署

仓库内置国内镜像源加速配置，可直接一键启动全套服务：

```bash
cd D:/dev/coding-agent-platform
docker build -t coding-tools-mcp:local D:/dev/coding-tools-mcp
export DEFAULT_OPENAI_API_KEY=sk-...
docker compose -f deploy/docker-compose.yml up --build
```

- Web 控制台: `http://localhost:3000`
- API 接口: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

---

## OIDC 单点登录配置

在 `.env` 中配置企业 IdP 参数：

```env
DEV_AUTH_ENABLED=false
OIDC_ISSUER=https://your-idp/realms/xxx
OIDC_CLIENT_ID=coding-agent-platform
OIDC_CLIENT_SECRET=your-secret
OIDC_REDIRECT_URL=http://localhost:8080/api/v1/auth/oidc/callback
```

登录成功后将自动重定向回前端工作台。

---

## API 路由一览

| 请求方法 | 路由路径 | 说明 |
|:---|:---|:---|
| GET | `/healthz` | 服务健康检查 |
| GET | `/api/v1/auth/config` | 获取认证与模型配置 |
| POST | `/api/v1/auth/dev-login` | 开发环境快速登录 |
| GET | `/api/v1/auth/oidc/login` | OIDC 单点登录跳转 |
| GET | `/api/v1/auth/me` | 获取当前登录用户信息 |
| GET/POST/DELETE | `/api/v1/projects` | 项目列表 / 创建 / 删除 |
| GET | `/api/v1/projects/{id}/files` | **[NEW]** 递归获取项目目录树 |
| GET | `/api/v1/projects/{id}/file?path=...` | **[NEW]** 读取指定文件内容 |
| GET | `/api/v1/projects/{id}/git/status` | **[NEW]** 获取工作区 Git 状态与变更文件列表 |
| GET | `/api/v1/projects/{id}/git/diff?path=...` | **[NEW]** 获取特定文件 Git Diff 差异对比 |
| GET | `/api/v1/runtime` | 用户容器运行态监控 |
| POST | `/api/v1/runtime/start` | 启动当前用户沙箱容器 |
| POST | `/api/v1/runtime/stop` | 停止当前用户沙箱容器 |
| GET | `/api/v1/projects/{id}/threads` | 项目会话列表 |
| POST | `/api/v1/projects/{id}/threads` | 创建新会话 |
| GET | `/api/v1/threads/{id}/messages` | 获取历史消息（含思考链与工具调用参数） |
| POST | `/api/v1/chat/send` | **SSE 流式对话**（支持思考链推送与 MCP 工具调用循环） |
| * | `/api/v1/admin/*` | 模型渠道管理 / 用户列表 / 平台底层参数 |

---

## 目录结构

```text
coding-agent-platform/
  apps/web/                 Next.js 15 全屏现代 Web IDE 控制台
    ├── src/components/
    │   ├── FileTreeDrawer.tsx     # 智谱风格文件树与 Git 变更抽屉
    │   ├── FilePreviewPanel.tsx   # Monaco 代码高亮与 DiffEditor 差异对比
    │   ├── ThinkingProcess.tsx    # 深度思维链/思考过程折叠卡片
    │   ├── ToolCallCard.tsx       # coding-tools-mcp 结构化终端与工具卡片
    │   ├── MessageBubble.tsx      # 消息流与气泡容器
    │   ├── Sidebar.tsx            # 左侧项目与会话导航
    │   ├── TopBar.tsx             # 顶部面包屑与状态监控
    │   └── ChatInput.tsx          # 悬浮智能提问控制台
  services/api/             Go API Gateway 与 Agent 调度引擎
    ├── cmd/api/            API 入口
    ├── internal/
    │   ├── chat/           Agent 思考与工具循环调度引擎
    │   ├── llm/            OpenAI 兼容协议与思维链解析器
    │   ├── mcp/            MCP JSON-RPC Client 与项目隔离代理
    │   ├── projects/       项目管理、文件树遍历与 Git Diff
    │   ├── runtime/        Docker 用户沙箱容器生命周期管理
    │   └── models/         GORM 数据库模型定义
  deploy/                   Docker Compose 与部署配置
  data/workspaces/          用户项目数据持久化目录
  scripts/                  本地开发快捷启动脚本（内置国内镜像加速）
  README.md
```

---

## 许可证

内部使用与部署，遵循项目约定协议。
