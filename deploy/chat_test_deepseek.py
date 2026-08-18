#!/usr/bin/env python3
import http.cookiejar
import json
import urllib.error
import urllib.request

base = "http://127.0.0.1:8180"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def req(path, body=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        base + path,
        data=data,
        method="POST" if body is not None else "GET",
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with opener.open(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


print(
    "login",
    req(
        "/api/v1/auth/dev-login",
        {"email": "admin@local.test", "name": "Admin", "admin": True},
        timeout=30,
    ),
)
for content in [
    "Reply with exactly: HELLO_DEEPSEEK",
    "\u8bf7\u53ea\u56de\u590d\u4e24\u4e2a\u5b57\uff1a\u6536\u5230",
]:
    s, body = req("/api/v1/chat/send", {"projectId": 1, "content": content}, timeout=300)
    print("chat", s, "content_len", len(content))
    print(body[:1500])
    print("---")
