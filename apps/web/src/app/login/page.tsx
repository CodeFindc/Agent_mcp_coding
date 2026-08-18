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
    <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-[#121520]/90 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
          <span className="material-symbols-outlined text-[22px]">terminal</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-100 tracking-tight">Coding Agent Platform</h1>
          <p className="text-xs text-slate-400">云端智能编程工作台</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">欢迎登录</h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          每个账号配备专属沙箱容器与项目隔离环境，开箱即用。
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      {devEnabled ? (
        <form onSubmit={onDevLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">邮箱账号</label>
            <input
              className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">用户名</label>
            <input
              className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="开发者昵称"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition duration-150 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>登录中…</span>
              </>
            ) : (
              <span>进入工作区 (Dev Login)</span>
            )}
          </button>
        </form>
      ) : null}

      {oidcEnabled ? (
        <a
          className="mt-3 block w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-center font-medium text-xs border border-slate-700 transition"
          href={`${api.base}/api/v1/auth/oidc/login`}
        >
          使用 OIDC 单点登录
        </a>
      ) : null}

      {!devEnabled && !oidcEnabled ? (
        <p className="text-xs text-slate-400 text-center py-4">
          未启用任何登录方式，请在服务端环境变量中配置 DEV_AUTH_ENABLED 或 OIDC 参数。
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen w-screen flex items-center justify-center p-4 bg-[#0a0b10]">
      <Suspense
        fallback={
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>加载中…</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
