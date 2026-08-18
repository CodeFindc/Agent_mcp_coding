# 本地开发细节

## Windows 注意

1. **Docker Desktop** 必须运行。  
2. 项目目录挂载：API 使用宿主机绝对路径 bind mount 到容器 `/workspace`。  
3. 若 API 跑在 **宿主机**（`go run`）而不是 compose：  
   - 通过容器 IP 访问 MCP（代码会 `ContainerInspect` 取 IP）  
   - 确保 Docker 网络 `agent-internal` 可创建  
4. 若 API 跑在 **compose 容器**内：  
   - 挂载 `docker.sock`  
   - 与用户容器同一 Docker engine  

## 多项目并行

- 容器名：`ctm-u{userId}-p{projectId}`（旧名 `ctm-u{userId}` 会在启动时尝试清理）  
- 平台 API **不**把 coding-tools 端口 publish 到宿主；多项目 ≠ 多宿主端口  
- 每用户 running 上限：`MAX_RUNNING_RUNTIMES_PER_USER`（默认 3）  
- 对话入口只 `EnsureRunning(user, project)`，不会停掉同用户其他项目容器  
- 前端：`GET /api/v1/runtimes` 显示 running/limit；项目列表上有 per-project 徽章  

## 仅验证 MCP（不经过平台）

```bash
docker network create agent-internal || true
docker run --rm -d --name ctm-test --network agent-internal \
  -e CODING_TOOLS_MCP_AUTH_MODE=bearer \
  -e CODING_TOOLS_MCP_AUTH_TOKEN=test-token \
  -e CODING_TOOLS_MCP_GENERATE_AUTH_TOKEN=0 \
  -e CODING_TOOLS_MCP_WORKSPACE=/workspace \
  -e CODING_TOOLS_MCP_HOST=0.0.0.0 \
  -v "D:/tmp/ws:/workspace" \
  -p 8765:8765 \
  coding-tools-mcp:local
```

然后用 curl 对 `http://127.0.0.1:8765/mcp` 发 initialize / tools/list。

## 环境变量权威来源

见仓库根目录 `.env.example`。
