#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

HOST = "192.168.110.208"
USER = "root"
PASSWORD = ";!Gfa2l8Jpfmv5t:"
LOCAL_SMOKE = Path(__file__).with_name("smoke_multi_project.sh")


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    try:
        sftp = client.open_sftp()
        sftp.put(str(LOCAL_SMOKE), "/tmp/cap-smoke.sh")
        sftp.close()
        _stdin, stdout, stderr = client.exec_command("bash /tmp/cap-smoke.sh", timeout=300)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        code = stdout.channel.recv_exit_status()
        sys.stdout.write(out)
        if err:
            sys.stdout.write(err)
        print(f"[exit {code}]", flush=True)
        return code
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
