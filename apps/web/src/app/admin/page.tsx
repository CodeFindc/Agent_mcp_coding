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
      <main className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0b10] text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">加载管理后台…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0b10] text-slate-100 p-4 sm:p-8 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100">管理后台</h1>
              <p className="text-xs text-slate-400">配置模型服务、渠道与查看平台状态</p>
            </div>
          </div>
          <Link
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            href="/"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>返回工作区</span>
          </Link>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        ) : null}

        {/* Model Providers */}
        <section className="rounded-2xl border border-slate-800 bg-[#121520] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">psychology</span>
            模型渠道（OpenAI 兼容规范）
          </h2>

          <form onSubmit={onCreate} className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">渠道名称</label>
              <input
                className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="例如: zhipu-ai 或 gpt-4o"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Base URL</label>
              <input
                className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="https://open.bigmodel.cn/api/paas/v4"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">API Key</label>
              <input
                type="password"
                className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">默认模型标识</label>
              <input
                className="w-full bg-[#0a0b10] border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="glm-4-plus / gpt-4o"
                value={form.defaultModel}
                onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
              />
            </div>
            <button
              className="sm:col-span-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition duration-150 shadow-md shadow-blue-500/20"
              type="submit"
            >
              保存并添加渠道
            </button>
          </form>

          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 px-3.5 py-2.5 hover:bg-slate-900 transition"
              >
                <div>
                  <div className="font-semibold text-xs text-slate-200">{p.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {p.baseUrl} &bull; {p.defaultModel} &bull; key: {p.hasApiKey ? "已配置" : "无"}
                  </div>
                </div>
                <button
                  className="px-2.5 py-1 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition border border-rose-500/20"
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
              <p className="text-xs text-slate-500">
                尚未配置自定义渠道，当前使用默认环境变量中的模型配置。
              </p>
            ) : null}
          </div>
        </section>

        {/* Users */}
        <section className="rounded-2xl border border-slate-800 bg-[#121520] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-cyan-400">group</span>
            平台用户
          </h2>
          <div className="divide-y divide-slate-800">
            {users.map((u) => (
              <div key={u.id} className="flex justify-between items-center text-xs py-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-blue-400 font-bold">
                    {u.name?.slice(0, 1) || "U"}
                  </div>
                  <span className="text-slate-200">
                    {u.name} <span className="text-slate-500">&lt;{u.email}&gt;</span>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Info */}
        <section className="rounded-2xl border border-slate-800 bg-[#121520] p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">dns</span>
            平台底层参数
          </h2>
          <pre className="font-mono text-[11px] text-slate-400 bg-[#0a0b10] p-3 rounded-xl border border-slate-800 overflow-auto max-h-48">
            {JSON.stringify(platform, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
