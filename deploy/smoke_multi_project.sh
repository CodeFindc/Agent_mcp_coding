#!/usr/bin/env bash
set -euo pipefail

docker ps -aq --filter name=ctm- | xargs -r docker rm -f || true

COOKIE=/tmp/cap-cookie.txt
rm -f "$COOKIE"

curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","name":"Admin","admin":true}' \
  http://127.0.0.1:8180/api/v1/auth/dev-login >/tmp/cap-login.json
cat /tmp/cap-login.json
echo

curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"alpha-proj"}' http://127.0.0.1:8180/api/v1/projects >/tmp/p1.json
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"beta-proj"}' http://127.0.0.1:8180/api/v1/projects >/tmp/p2.json
cat /tmp/p1.json
echo
cat /tmp/p2.json
echo

ID2=$(python3 -c 'import json; print(json.load(open("/tmp/p2.json"))["id"])')

curl -sS -c "$COOKIE" -b "$COOKIE" -X POST http://127.0.0.1:8180/api/v1/runtime/start >/tmp/rt.json
cat /tmp/rt.json
echo

curl -sS -c "$COOKIE" -b "$COOKIE" -X POST "http://127.0.0.1:8180/api/v1/projects/${ID2}/runtime/start"
echo

docker ps --filter name=ctm- --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
COUNT=$(docker ps --format '{{.Names}}' | awk '$1=="ctm-u1"{c++} END{print c+0}')
echo "user_container_count=$COUNT"
test "$COUNT" -eq 1

mkdir -p /data/Agent_mcp_coding/data/workspaces/users/1/projects/alpha-proj
mkdir -p /data/Agent_mcp_coding/data/workspaces/users/1/projects/beta-proj
printf 'secret-alpha\n' >/data/Agent_mcp_coding/data/workspaces/users/1/projects/alpha-proj/marker.txt
printf 'secret-beta\n' >/data/Agent_mcp_coding/data/workspaces/users/1/projects/beta-proj/marker.txt

CIP=$(docker inspect ctm-u1 --format '{{json .NetworkSettings.Networks}}' | python3 -c 'import json,sys; n=json.load(sys.stdin); print((n.get("agent-internal") or list(n.values())[0])["IPAddress"])')
TOK=$(docker inspect ctm-u1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^CODING_TOOLS_MCP_AUTH_TOKEN=//p' | head -n1)
echo "cip=$CIP tok_len=${#TOK}"

curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  "http://${CIP}:8765/mcp"
echo

RA=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: alpha-proj' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"marker.txt"},"_meta":{"coding-tools-mcp/project":"alpha-proj"}}}' \
  "http://${CIP}:8765/mcp")
echo "$RA"
echo "$RA" | grep -q secret-alpha

RB=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: beta-proj' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"marker.txt"},"_meta":{"coding-tools-mcp/project":"beta-proj"}}}' \
  "http://${CIP}:8765/mcp")
echo "$RB"
echo "$RB" | grep -q secret-beta

RC=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: alpha-proj' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"../beta-proj/marker.txt"},"_meta":{"coding-tools-mcp/project":"alpha-proj"}}}' \
  "http://${CIP}:8765/mcp")
echo "$RC"
echo "$RC" | grep -vq secret-beta

curl -sS -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:3000/
echo SMOKE_OK
