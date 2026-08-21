"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Provider, User } from "@/lib/api";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [platform, setPlatform] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "default",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4o-mini",
  });

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        if (me.role !== "admin") {
          router.replace("/");
          return;
        }
        setUser(me);
        setProviders(await api.listProviders());
        setUsers(await api.listUsers());
        setPlatform(await api.platform());
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.createProvider(form);
      setForm((f) => ({ ...f, apiKey: "" }));
      setProviders(await api.listProviders());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!user) {
    return (
      <main className="h-screen w-screen flex flex-col items-center justify-center bg-[#06070a] text-white/50 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">加载管理后台…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent text-white/95 p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* macOS Window Title Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/25 border border-white/20">
              <span className="material-symbols-outlined text-[22px]">admin_panel_settings</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">系统管理后台</h1>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-medium">
                  macOS Settings
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">配置模型服务、渠道与查看平台沙箱状态</p>
            </div>
          </div>
          <Link
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/90 text-xs font-medium border border-white/[0.1] transition active:scale-[0.98] shadow-sm backdrop-blur-md"
            href="/"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>返回工作区</span>
          </Link>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center gap-2 shadow-lg">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        {/* Model Providers */}
        <section className="rounded-3xl border border-white/[0.08] bg-[rgba(16,20,34,0.7)] backdrop-blur-2xl p-6 space-y-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">psychology</span>
            模型渠道配置（OpenAI 兼容规范）
          </h2>

          <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">渠道名称</label>
              <input
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                placeholder="例如: zhipu-ai 或 gpt-4o"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">Base URL</label>
              <input
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                placeholder="https://open.bigmodel.cn/api/paas/v4"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">API Key</label>
              <input
                type="password"
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-white/60 mb-1">默认模型标识</label>
              <input
                className="w-full glass-input rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none"
                placeholder="glm-4-plus / gpt-4o"
                value={form.defaultModel}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              />
            </div>
            <button
              className="sm:col-span-2 py-2.5 px-4 rounded-xl bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium text-xs transition duration-150 shadow-lg shadow-blue-500/25 border border-white/20 active:scale-[0.99] cursor-pointer"
              type="submit"
            >
              保存并添加渠道
            </button>
          </form>

          <div className="space-y-2 pt-3 border-t border-white/[0.06]">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition"
              >
                <div>
                  <div className="font-semibold text-xs text-white/90">{p.name}</div>
                  <div className="text-[11px] text-white/50 mt-0.5 font-mono">
                    {p.baseUrl} &bull; {p.defaultModel} &bull; key: {p.hasApiKey ? "已配置" : "无"}
                  </div>
                </div>
                <button
                  className="px-3 py-1 rounded-lg text-xs text-rose-300 hover:bg-rose-500/20 transition border border-rose-500/30 active:scale-95"
                  onClick={async () => {
                    await api.deleteProvider(p.id);
                    setProviders(await api.listProviders());
                  }}
                >
                  删除
                </button>
              </div>
            ))}
            {!providers.length ? (
              <p className="text-xs text-white/40">
                尚未配置自定义渠道，当前使用默认环境变量中的模型配置。
              </p>
            ) : null}
          </div>
        </section>

        {/* Users */}
        <section className="rounded-3xl border border-white/[0.08] bg-[rgba(16,20,34,0.7)] backdrop-blur-2xl p-6 space-y-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-cyan-400">group</span>
            平台用户管理
          </h2>
          <div className="divide-y divide-white/[0.06]">
            {users.map((u) => (
              <div key={u.id} className="flex justify-between items-center text-xs py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-[10px] text-blue-300 font-bold shadow-sm">
                    {u.name?.slice(0, 1) || "U"}
                  </div>
                  <span className="text-white/90">
                    {u.name} <span className="text-white/40 font-mono">&lt;{u.email}&gt;</span>
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-400/30">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Info */}
        <section className="rounded-3xl border border-white/[0.08] bg-[rgba(16,20,34,0.7)] backdrop-blur-2xl p-6 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <h2 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">dns</span>
            平台底层沙箱与运行环境参数
          </h2>
          <pre className="font-mono text-[11px] text-white/60 bg-[rgba(4,6,12,0.85)] p-4 rounded-2xl border border-white/[0.08] overflow-auto max-h-48 shadow-inner">
            {JSON.stringify(platform, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
