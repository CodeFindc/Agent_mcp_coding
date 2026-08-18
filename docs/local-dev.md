# 本地开发细节

## Windows 注意

1. **Docker Desktop** 必须运行。  
2. 项目目录挂载：API 将宿主机 `DATA_ROOT/users/{uid}/projects` bind 到容器 `/projects`。  
3. 若 API 跑在 **宿主机**（`go run`）而不是 compose：  
   - 通过容器 IP 访问 MCP（代码会 `ContainerInspect` 取 IP）  
   - 确保 Docker 网络 `agent-internal` 可创建  
4. 若 API 跑在 **compose 容器**内：  
   - 挂载 `docker.sock`  
   - 与用户容器同一 Docker engine  
   - `DATA_ROOT` 必须是**宿主机绝对路径**，以便 bind mount 生效  

## 多项目（一用户一容器）

- 容器名：`ctm-u{userId}`（启动时会清理旧的 `ctm-u*-p*` 与误挂单项目路径的遗留容器）  
- 平台 API **不**把 coding-tools 端口 publish 到宿主  
- 环境：`CODING_TOOLS_MCP_PROJECTS_ROOT=/projects`  
- 对话入口 `EnsureRunning(user)`；MCP `ListTools` / `CallTool` 携带 project **slug**  
- 前端：用户级工作区徽章；`GET /api/v1/runtime` 与兼容的 `/projects/{id}/runtime/*`  

## 仅验证 MCP multi-project（不经过平台）

```bash
mkdir -p /tmp/projects/alpha /tmp/projects/beta
echo aaa > /tmp/projects/alpha/a.txt
echo bbb > /tmp/projects/beta/b.txt
docker network create agent-internal || true
docker run --rm -d --name ctm-test --network agent-internal \
  -e CODING_TOOLS_MCP_AUTH_MODE=bearer \
  -e CODING_TOOLS_MCP_AUTH_TOKEN=test-token \
  -e CODING_TOOLS_MCP_GENERATE_AUTH_TOKEN=0 \
  -e CODING_TOOLS_MCP_PROJECTS_ROOT=/projects \
  -e CODING_TOOLS_MCP_HOST=0.0.0.0 \
  -e CODING_TOOLS_MCP_PORT=8765 \
  -v "/tmp/projects:/projects" \
  -p 8765:8765 \
  coding-tools-mcp:local
```

`tools/call` 示例（注意 `_meta`）：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": { "path": "a.txt" },
    "_meta": { "coding-tools-mcp/project": "alpha" }
  }
}
```

## 环境变量权威来源

见仓库根目录 `.env.example`。
