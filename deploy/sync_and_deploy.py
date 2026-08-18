#!/usr/bin/env python3
"""Sync local repos to 192.168.110.208 and rebuild/deploy multi-project stack."""

from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

HOST = os.environ.get("CAP_DEPLOY_HOST", "192.168.110.208")
USER = os.environ.get("CAP_DEPLOY_USER", "root")
PASSWORD = os.environ.get("CAP_DEPLOY_PASSWORD", ";!Gfa2l8Jpfmv5t:")

SKIP_DIR_NAMES = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "__pycache__",
    ".venv",
    "venv",
    "data",
    ".zcode",
    ".turbo",
    "coverage",
    ".pytest_cache",
}


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> tuple[int, str, str]:
    print(f"\n$ {cmd}", flush=True)
    _stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out:
        sys.stdout.write(out if out.endswith("\n") else out + "\n")
        sys.stdout.flush()
    if err:
        sys.stdout.write(err if err.endswith("\n") else err + "\n")
        sys.stdout.flush()
    print(f"[exit {code}]", flush=True)
    return code, out, err


def should_skip(path: Path, root: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        return True
    for part in rel.parts:
        if part in SKIP_DIR_NAMES:
            return True
    if path.suffix in {".pyc", ".exe", ".dll"}:
        return True
    return False


def make_tar(local: Path) -> bytes:
    bio = io.BytesIO()
    with tarfile.open(fileobj=bio, mode="w:gz") as tar:
        for dirpath, dirnames, filenames in os.walk(local):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
            dp = Path(dirpath)
            for fn in filenames:
                fp = dp / fn
                if should_skip(fp, local):
                    continue
                arc = Path(local.name) / fp.relative_to(local)
                arcname = str(arc).replace("\\", "/")
                tar.add(str(fp), arcname=arcname)
    return bio.getvalue()


def upload_dir(client: paramiko.SSHClient, local: Path, remote: str) -> None:
    """Upload local directory contents so they land exactly at ``remote``."""
    print(f"upload {local} -> {remote}", flush=True)
    data = make_tar(local)
    print(f"  archive {len(data)} bytes", flush=True)
    sftp = client.open_sftp()
    remote_tar = f"/tmp/{local.name}-sync.tgz"
    with sftp.file(remote_tar, "wb") as handle:
        handle.write(data)
    sftp.close()
    parent = remote.rsplit("/", 1)[0] or "/"
    # tarball top-level dir is local.name; move into the desired remote path.
    staged = f"{parent}/{local.name}"
    code, _, _ = run(
        client,
        "set -e; "
        f"mkdir -p {parent}; "
        f"rm -rf {remote} {staged}; "
        f"tar -xzf {remote_tar} -C {parent}; "
        f"if [ '{staged}' != '{remote}' ]; then mv {staged} {remote}; fi; "
        f"rm -f {remote_tar}",
    )
    if code != 0:
        raise SystemExit(f"upload extract failed for {remote}")


def main() -> int:
    tools = Path(r"D:\dev\coding-tools-mcp")
    platform = Path(r"D:\dev\coding-agent-platform")
    client = connect()
    try:
        upload_dir(client, tools, "/data/coding-tools-mcp")
        upload_dir(client, platform, "/data/Agent_mcp_coding")
        run(
            client,
            "ls -la /data/coding-tools-mcp/coding_tools_mcp/project_registry.py "
            "/data/Agent_mcp_coding/services/api/internal/runtime/service.go",
        )

        # Rebuild coding-tools image
        code, _, _ = run(
            client,
            "cd /data/coding-tools-mcp && docker build -f Dockerfile.slim -t coding-tools-mcp:local .",
            timeout=1800,
        )
        if code != 0:
            return code

        # Stop legacy per-project containers
        run(
            client,
            "docker ps -aq --filter name=ctm-u | xargs -r docker rm -f; "
            "docker network create agent-internal 2>/dev/null || true",
            timeout=120,
        )

        # Drop DB volume so schema migrates cleanly (user-level runtime table)
        run(
            client,
            "cd /data/Agent_mcp_coding/deploy && "
            "docker compose -f docker-compose.prod.yml down 2>/dev/null || true; "
            "docker volume rm deploy_pgdata 2>/dev/null || true",
            timeout=180,
        )

        # Write/refresh compose via remote_deploy helpers already on disk, then build+up
        code, _, _ = run(
            client,
            "cd /data/Agent_mcp_coding && python3 deploy/remote_deploy.py",
            timeout=3600,
        )
        if code != 0:
            return code

        smoke = r"""
set -euo pipefail
COOKIE=/tmp/cap-cookie.txt
rm -f "$COOKIE"
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"email":"admin@local.test","name":"Admin","admin":true}' \
  http://127.0.0.1:8180/api/v1/auth/dev-login >/tmp/cap-login.json
cat /tmp/cap-login.json; echo
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"alpha-proj"}' http://127.0.0.1:8180/api/v1/projects >/tmp/p1.json
curl -sS -c "$COOKIE" -b "$COOKIE" -H 'Content-Type: application/json' \
  -d '{"name":"beta-proj"}' http://127.0.0.1:8180/api/v1/projects >/tmp/p2.json
cat /tmp/p1.json; echo; cat /tmp/p2.json; echo
ID2=$(python3 -c 'import json; print(json.load(open("/tmp/p2.json"))["id"])')
curl -sS -c "$COOKIE" -b "$COOKIE" -X POST http://127.0.0.1:8180/api/v1/runtime/start >/tmp/rt.json
cat /tmp/rt.json; echo
curl -sS -c "$COOKIE" -b "$COOKIE" -X POST "http://127.0.0.1:8180/api/v1/projects/${ID2}/runtime/start"; echo
docker ps --filter name=ctm- --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
COUNT=$(docker ps --format '{{.Names}}' | awk '$1=="ctm-u1"{c++} END{print c+0}')
echo "user_container_count=$COUNT"
test "$COUNT" -eq 1
mkdir -p /data/Agent_mcp_coding/data/workspaces/users/1/projects/alpha-proj
mkdir -p /data/Agent_mcp_coding/data/workspaces/users/1/projects/beta-proj
printf 'secret-alpha\n' > /data/Agent_mcp_coding/data/workspaces/users/1/projects/alpha-proj/marker.txt
printf 'secret-beta\n' > /data/Agent_mcp_coding/data/workspaces/users/1/projects/beta-proj/marker.txt
CIP=$(docker inspect ctm-u1 --format '{{json .NetworkSettings.Networks}}' | python3 -c 'import json,sys; n=json.load(sys.stdin); print((n.get("agent-internal") or list(n.values())[0])["IPAddress"])')
TOK=$(docker inspect ctm-u1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^CODING_TOOLS_MCP_AUTH_TOKEN=//p' | head -n1)
echo "cip=$CIP tok_len=${#TOK}"
curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  "http://$CIP:8765/mcp"; echo
RA=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: alpha-proj' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"marker.txt"},"_meta":{"coding-tools-mcp/project":"alpha-proj"}}}' \
  "http://$CIP:8765/mcp")
echo "$RA"
echo "$RA" | grep -q secret-alpha
RB=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: beta-proj' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"marker.txt"},"_meta":{"coding-tools-mcp/project":"beta-proj"}}}' \
  "http://$CIP:8765/mcp")
echo "$RB"
echo "$RB" | grep -q secret-beta
RC=$(curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' -H 'X-Coding-Tools-Project: alpha-proj' \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"read_file","arguments":{"path":"../beta-proj/marker.txt"},"_meta":{"coding-tools-mcp/project":"alpha-proj"}}}' \
  "http://$CIP:8765/mcp")
echo "$RC"
echo "$RC" | grep -vq secret-beta
curl -sS -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:3000/
echo SMOKE_OK
"""
        code, _, _ = run(client, smoke, timeout=300)
        return code
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
