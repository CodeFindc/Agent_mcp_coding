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
      <main className="min-h-screen flex items-center justify-center">
        <span className="muted text-sm">加载中…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="mac-window w-full max-w-5xl p-8 space-y-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="t-light t-close" />
            <div className="t-light t-min" />
            <div className="t-light t-max" />
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold">管理</h1>
            <p className="muted text-sm mt-1">模型渠道、用户与平台参数</p>
          </div>
          <Link className="btn" href="/">
            返回工作区
          </Link>
        </div>

        {error ? (
          <div className="rounded-xl border border-[rgba(255,107,122,0.35)] bg-[rgba(255,107,122,0.1)] px-3 py-2 text-sm text-[var(--error)]">
            {error}
          </div>
        ) : null}

        <section className="glass-pane p-5 space-y-4">
          <h2 className="font-medium">模型渠道（OpenAI 兼容）</h2>
          <form onSubmit={onCreate} className="grid md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="input"
              placeholder="Base URL"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
            <input
              className="input"
              placeholder="API Key"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
            <input
              className="input"
              placeholder="Default model"
              value={form.defaultModel}
              onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
            />
            <button className="btn btn-primary md:col-span-2" type="submit">
              添加渠道
            </button>
          </form>
          <div className="space-y-2">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 hover:bg-white/[0.07] transition"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs muted">
                    {p.baseUrl} · {p.defaultModel} · key={p.hasApiKey ? "已配置" : "无"}
                  </div>
                </div>
                <button
                  className="btn btn-danger text-xs"
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
              <p className="muted text-sm">尚未配置渠道，也可使用环境变量 DEFAULT_OPENAI_*。</p>
            ) : null}
          </div>
        </section>

        <section className="glass-pane p-5 space-y-3">
          <h2 className="font-medium">用户</h2>
          {users.map((u) => (
            <div
              key={u.id}
              className="flex justify-between text-sm border-b border-white/10 py-2.5"
            >
              <span>
                #{u.id} {u.name} &lt;{u.email}&gt;
              </span>
              <span className="badge primary">{u.role}</span>
            </div>
          ))}
        </section>

        <section className="glass-pane p-5">
          <h2 className="font-medium mb-3">平台信息</h2>
          <pre className="tool-result text-xs muted overflow-auto">
            {JSON.stringify(platform, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
