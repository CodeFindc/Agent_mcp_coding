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
    <div className="w-full max-w-md p-8 rounded-3xl border border-white/[0.12] bg-[rgba(16,20,34,0.75)] backdrop-blur-3xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] relative overflow-hidden">
      {/* Top Window Dots */}
      <div className="flex items-center gap-1.5 mb-6">
        <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] inline-block" />
        <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] inline-block" />
        <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] inline-block" />
      </div>

      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white font-bold text-lg shadow-xl shadow-blue-500/25 border border-white/20">
          <span className="material-symbols-outlined text-[24px]">terminal</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Coding Agent Platform</h1>
          <p className="text-xs text-white/50">macOS 智能编程工作台</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">欢迎登录工作区</h2>
        <p className="text-xs text-white/50 mt-1 leading-relaxed">
          每个账号配备专属沙箱容器与项目隔离环境，开箱即用。
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      {devEnabled ? (
        <form onSubmit={onDevLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">邮箱账号</label>
            <input
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">用户名</label>
            <input
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="开发者昵称"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium text-xs transition duration-150 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-white/20 active:scale-[0.99]"
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
          className="mt-3 block w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-center font-medium text-xs border border-white/[0.1] transition shadow-sm active:scale-[0.99]"
          href={`${api.base}/api/v1/auth/oidc/login`}
        >
          使用 OIDC 单点登录
        </a>
      ) : null}

      {!devEnabled && !oidcEnabled ? (
        <p className="text-xs text-white/40 text-center py-4">
          未启用任何登录方式，请在服务端环境变量中配置 DEV_AUTH_ENABLED 或 OIDC 参数。
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen w-screen flex items-center justify-center p-4 bg-[#06070a] relative">
      <Suspense
        fallback={
          <div className="text-xs text-white/50 flex items-center gap-2">
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
