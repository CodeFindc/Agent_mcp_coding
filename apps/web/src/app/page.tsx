"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ChatEvent,
  ChatMessage,
  ChatThread,
  Project,
  RuntimeStatus,
  RuntimeSummary,
  User,
  sendChat,
} from "@/lib/api";

type UiMsg =
  | { kind: "user" | "assistant"; content: string }
  | { kind: "tool"; tool: string; args?: string; result?: string };

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runtimeSummary, setRuntimeSummary] = useState<RuntimeSummary | null>(null);
  const [selectedRuntime, setSelectedRuntime] = useState<RuntimeStatus | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [statusText, setStatusText] = useState("");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const runtimeByProject = useMemo(() => {
    const map = new Map<number, RuntimeStatus>();
    for (const r of runtimeSummary?.runtimes || []) {
      map.set(r.projectId, r);
    }
    return map;
  }, [runtimeSummary]);

  const refreshRuntimes = useCallback(async () => {
    const summary = await api.listRuntimes();
    setRuntimeSummary(summary);
    return summary;
  }, []);

  const refreshSelectedRuntime = useCallback(async (projectId: number) => {
    const st = await api.projectRuntime(projectId);
    setSelectedRuntime(st);
    return st;
  }, []);

  const loadProjects = useCallback(async () => {
    const items = await api.listProjects();
    setProjects(items);
    if (!selectedProjectId && items.length) {
      setSelectedProjectId(items[0].id);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setUser(me);
        await loadProjects();
        await refreshRuntimes();
      } catch {
        router.replace("/login");
      }
    })();
  }, [loadProjects, refreshRuntimes, router]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedRuntime(null);
      return;
    }
    (async () => {
      try {
        const list = await api.listThreads(selectedProjectId);
        setThreads(list);
        if (list.length) {
          setThreadId(list[0].id);
        } else {
          setThreadId(null);
          setMessages([]);
        }
        await refreshSelectedRuntime(selectedProjectId);
        await refreshRuntimes();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [selectedProjectId, refreshSelectedRuntime, refreshRuntimes]);

  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const list = await api.listMessages(threadId);
        setMessages(dbToUi(list));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [threadId]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const p = await api.createProject(newProjectName.trim());
      setNewProjectName("");
      await loadProjects();
      setSelectedProjectId(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startSelected() {
    if (!selectedProjectId) return;
    setBusy(true);
    setError("");
    setStatusText("正在启动该项目容器…");
    try {
      const st = await api.startProjectRuntime(selectedProjectId);
      setSelectedRuntime(st);
      await refreshRuntimes();
      setStatusText(st.mcpReady ? "工作区已就绪（其他项目容器不受影响）" : `状态: ${st.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function stopSelected() {
    if (!selectedProjectId) return;
    setBusy(true);
    setError("");
    try {
      const st = await api.stopProjectRuntime(selectedProjectId);
      setSelectedRuntime(st);
      await refreshRuntimes();
      setStatusText("已停止该项目容器");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (!selectedProjectId || !input.trim() || busy) return;
    const content = input.trim();
    setInput("");
    setBusy(true);
    setError("");
    setStatusText("思考中…");
    setMessages((prev) => [...prev, { kind: "user", content }]);

    let assistantBuf = "";
    try {
      await sendChat(
        {
          projectId: selectedProjectId,
          threadId: threadId || undefined,
          content,
        },
        (ev: ChatEvent) => {
          if (ev.type === "thread" && ev.threadId) {
            setThreadId(ev.threadId);
            api.listThreads(selectedProjectId).then(setThreads).catch(() => undefined);
          }
          if (ev.type === "assistant_delta" && ev.content) {
            assistantBuf += ev.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.kind === "assistant") {
                next[next.length - 1] = { kind: "assistant", content: assistantBuf };
              } else {
                next.push({ kind: "assistant", content: assistantBuf });
              }
              return next;
            });
          }
          if (ev.type === "tool_start") {
            setStatusText(`调用工具 ${ev.tool}…`);
            setMessages((prev) => [
              ...prev,
              { kind: "tool", tool: ev.tool || "tool", args: ev.args },
            ]);
          }
          if (ev.type === "tool_result") {
            setMessages((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i];
                if (m.kind === "tool" && m.tool === ev.tool && m.result === undefined) {
                  next[i] = { ...m, result: ev.result };
                  break;
                }
              }
              return next;
            });
            assistantBuf = "";
          }
          if (ev.type === "error") {
            setError(ev.error || "unknown error");
          }
          if (ev.type === "done") {
            setStatusText("完成");
          }
        },
      );
      await refreshSelectedRuntime(selectedProjectId);
      await refreshRuntimes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.logout();
    router.replace("/login");
  }

  if (!user) {
    return <main className="min-h-screen grid place-items-center muted">加载中…</main>;
  }

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr]">
      <header className="border-b border-[var(--border)] bg-black/20 backdrop-blur px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500" />
          <div>
            <div className="font-semibold tracking-tight">Coding Agent</div>
            <div className="text-xs muted">每项目独立容器 · 可并行运行</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="badge run">
            运行中 {runtimeSummary?.running ?? 0}/{runtimeSummary?.limit ?? "?"}
          </span>
          <RuntimeBadge runtime={selectedRuntime} />
          <span className="muted">{user.name || user.email}</span>
          {user.role === "admin" ? (
            <Link className="btn" href="/admin">
              管理
            </Link>
          ) : null}
          <button className="btn" onClick={logout}>
            退出
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[280px_220px_1fr] min-h-0">
        <aside className="border-r border-[var(--border)] p-4 space-y-4 overflow-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">项目</h2>
            <div className="flex gap-1">
              <button className="btn text-xs" disabled={busy || !selectedProjectId} onClick={startSelected}>
                启动
              </button>
              <button className="btn text-xs" disabled={busy || !selectedProjectId} onClick={stopSelected}>
                停止
              </button>
            </div>
          </div>
          <form onSubmit={createProject} className="flex gap-2">
            <input
              className="input"
              placeholder="新项目名"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              建
            </button>
          </form>
          <div className="space-y-2">
            {projects.map((p) => {
              const active = p.id === selectedProjectId;
              const rt = runtimeByProject.get(p.id);
              return (
                <button
                  key={p.id}
                  className={`w-full text-left card px-3 py-3 transition ${active ? "ring-1 ring-sky-400/50" : ""}`}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs muted mt-1">{p.slug}</div>
                  <div className="mt-2">
                    <ProjectRuntimeBadge runtime={rt} />
                  </div>
                </button>
              );
            })}
            {!projects.length ? <p className="muted text-sm">还没有项目，先创建一个。</p> : null}
          </div>
          {selectedProject ? (
            <div className="text-xs muted break-all space-y-1">
              <div>路径：{selectedProject.diskPath}</div>
              {selectedRuntime?.containerName ? <div>容器：{selectedRuntime.containerName}</div> : null}
            </div>
          ) : null}
        </aside>

        <aside className="border-r border-[var(--border)] p-4 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">会话</h2>
            <button
              className="btn text-xs"
              disabled={!selectedProjectId || busy}
              onClick={async () => {
                if (!selectedProjectId) return;
                const t = await api.createThread(selectedProjectId);
                const list = await api.listThreads(selectedProjectId);
                setThreads(list);
                setThreadId(t.id);
                setMessages([]);
              }}
            >
              新建
            </button>
          </div>
          <div className="space-y-2">
            {threads.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left rounded-xl px-3 py-2 border border-[var(--border)] ${
                  t.id === threadId ? "bg-[var(--panel-2)]" : "bg-transparent"
                }`}
                onClick={() => setThreadId(t.id)}
              >
                <div className="text-sm truncate">{t.title}</div>
              </button>
            ))}
            {!threads.length ? <p className="muted text-sm">发送第一条消息将自动创建会话。</p> : null}
          </div>
        </aside>

        <section className="min-h-0 grid grid-rows-[1fr_auto]">
          <div className="overflow-auto p-5 space-y-3">
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            ) : null}
            {statusText ? <div className="text-xs muted">{statusText}</div> : null}
            {messages.map((m, idx) => (
              <MessageBubble key={idx} msg={m} />
            ))}
            {!messages.length ? (
              <div className="card p-6 muted text-sm leading-7">
                每个项目可独立启动 coding-tools 容器，多个项目可同时 running。
                <br />
                对话只会 EnsureRunning 当前项目，不会停掉其他项目。
                <br />
                默认每用户最多并行 {runtimeSummary?.limit ?? 3} 个运行中工作区（MAX_RUNNING_RUNTIMES_PER_USER）。
              </div>
            ) : null}
          </div>
          <form onSubmit={onSend} className="border-t border-[var(--border)] p-4 flex gap-3">
            <textarea
              className="input min-h-[56px] max-h-40 resize-y"
              placeholder={selectedProject ? `在「${selectedProject.name}」中提问…` : "请先选择项目"}
              value={input}
              disabled={!selectedProjectId || busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend(e);
                }
              }}
            />
            <button className="btn btn-primary self-end" disabled={!selectedProjectId || busy || !input.trim()}>
              {busy ? "…" : "发送"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

function RuntimeBadge({ runtime }: { runtime: RuntimeStatus | null }) {
  if (!runtime) return <span className="badge">当前项目 -</span>;
  if (runtime.status === "running" && runtime.mcpReady) return <span className="badge ok">当前 MCP ready</span>;
  if (runtime.status === "running") return <span className="badge run">当前 running</span>;
  if (runtime.status === "error") return <span className="badge err">当前 error</span>;
  if (runtime.status === "starting") return <span className="badge run">当前 starting</span>;
  return <span className="badge">当前 stopped</span>;
}

function ProjectRuntimeBadge({ runtime }: { runtime?: RuntimeStatus }) {
  if (!runtime) return <span className="badge">stopped</span>;
  if (runtime.status === "running" && runtime.mcpReady) return <span className="badge ok">running</span>;
  if (runtime.status === "running") return <span className="badge run">running</span>;
  if (runtime.status === "error") return <span className="badge err">error</span>;
  if (runtime.status === "starting") return <span className="badge run">starting</span>;
  return <span className="badge">stopped</span>;
}

function MessageBubble({ msg }: { msg: UiMsg }) {
  if (msg.kind === "tool") {
    return (
      <div className="card px-4 py-3 text-sm">
        <div className="font-medium text-cyan-300">🛠 {msg.tool}</div>
        {msg.args ? <pre className="mt-2 text-xs muted overflow-auto">{msg.args}</pre> : null}
        {msg.result !== undefined ? (
          <pre className="mt-2 text-xs overflow-auto max-h-64 prose-chat">{msg.result}</pre>
        ) : (
          <div className="muted text-xs mt-2">执行中…</div>
        )}
      </div>
    );
  }
  const mine = msg.kind === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          mine ? "bg-sky-600/30 border border-sky-400/20" : "card"
        }`}
      >
        <div className="text-[11px] muted mb-1">{mine ? "你" : "助手"}</div>
        <div className="prose-chat">{msg.content}</div>
      </div>
    </div>
  );
}

function dbToUi(list: ChatMessage[]): UiMsg[] {
  const out: UiMsg[] = [];
  for (const m of list) {
    if (m.role === "user") out.push({ kind: "user", content: m.content });
    else if (m.role === "assistant") {
      if (m.content) out.push({ kind: "assistant", content: m.content });
    } else if (m.role === "tool") {
      out.push({ kind: "tool", tool: m.name || "tool", result: m.content });
    }
  }
  return out;
}
