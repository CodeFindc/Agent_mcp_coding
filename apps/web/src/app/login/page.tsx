"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("dev@localhost");
  const [name, setName] = useState("Dev User");
  const [devEnabled, setDevEnabled] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [error, setError] = useState(params.get("error") || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .authConfig()
      .then((c) => {
        setDevEnabled(c.devAuthEnabled);
        setOidcEnabled(c.oidcEnabled);
      })
      .catch((e) => setError(String(e.message || e)));
    api
      .me()
      .then(() => router.replace("/"))
      .catch(() => undefined);
  }, [router]);

  async function onDevLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.devLogin(email, name);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mac-window w-full max-w-md p-10">
      <div className="absolute top-5 left-6 flex items-center gap-2">
        <span className="t-light t-close" />
        <span className="t-light t-min" />
        <span className="t-light t-max" />
      </div>
      <div className="mb-8 mt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent)] flex items-center justify-center text-white font-bold text-xl shadow-sm">
            C
          </div>
          <div>
            <div className="text-sm muted">Coding Agent Platform</div>
            <div className="text-[11px] muted opacity-70">一用户一容器 · 多项目并行</div>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">登录工作区</h1>
        <p className="muted mt-2 text-sm leading-6">
          每用户独立 coding-tools 容器与项目目录。开发环境可用 Dev Login；生产请配置 OIDC。
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[rgba(255,107,122,0.35)] bg-[rgba(255,107,122,0.1)] px-3 py-2 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      {devEnabled ? (
        <form onSubmit={onDevLogin} className="space-y-3">
          <label className="block text-sm">
            <span className="muted">Email</span>
            <input
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="muted">Name</span>
            <input
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={loading} type="submit">
            {loading ? "登录中…" : "Dev Login"}
          </button>
        </form>
      ) : null}

      {oidcEnabled ? (
        <a
          className="btn btn-primary mt-3 block w-full text-center"
          href={`${api.base}/api/v1/auth/oidc/login`}
        >
          使用 OIDC 登录
        </a>
      ) : null}

      {!devEnabled && !oidcEnabled ? (
        <p className="muted text-sm">未启用任何登录方式。请配置 DEV_AUTH_ENABLED 或 OIDC_。</p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Suspense fallback={<div className="muted">加载登录页…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
