"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { MessageBubble, UiMsg } from "@/components/MessageBubble";
import { RightPanel } from "@/components/RightPanel";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import {
  api,
  ChatMessage,
  ChatThread,
  Project,
  RuntimeStatus,
  RuntimeSummary,
  sendChat,
  User,
} from "@/lib/api";

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
  const [statusText, setStatusText] = useState("");
  const [modelLabel, setModelLabel] = useState("模型");

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const userRuntimeStatus = useMemo(() => {
    if (selectedRuntime) return selectedRuntime;
    return runtimeSummary?.runtimes?.[0] || null;
  }, [selectedRuntime, runtimeSummary]);

  const refreshRuntimes = useCallback(async () => {
    const summary = await api.listRuntimes();
    setRuntimeSummary(summary);
    if (summary.runtimes?.[0]) {
      setSelectedRuntime(summary.runtimes[0]);
    }
    return summary;
  }, []);

  const refreshSelectedRuntime = useCallback(async () => {
    const st = await api.userRuntime();
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
      try {
        const cfg = await api.authConfig();
        if (cfg.defaultModel) setModelLabel(cfg.defaultModel);
      } catch {
        /* model label is cosmetic */
      }
    })();
  }, [loadProjects, refreshRuntimes, router]);

  useEffect(() => {
    if (!selectedProjectId) {
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
        await refreshSelectedRuntime();
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

  async function createProject(name: string) {
    setBusy(true);
    setError("");
    try {
      const p = await api.createProject(name);
      await loadProjects();
      setSelectedProjectId(p.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function newThread() {
    if (!selectedProjectId) return;
    setBusy(true);
    setError("");
    try {
      const t = await api.createThread(selectedProjectId);
      const list = await api.listThreads(selectedProjectId);
      setThreads(list);
      setThreadId(t.id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startSelected() {
    setBusy(true);
    setError("");
    setStatusText("正在启动用户工作区容器…");
    try {
      const st = await api.startUserRuntime();
      setSelectedRuntime(st);
      await refreshRuntimes();
      setStatusText(
        st.mcpReady
          ? "用户容器已就绪（多项目共享同一容器，按 slug 隔离）"
          : `状态: ${st.status}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function stopSelected() {
    setBusy(true);
    setError("");
    try {
      const st = await api.stopUserRuntime();
      setSelectedRuntime(st);
      await refreshRuntimes();
      setStatusText("已停止用户工作区容器");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
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
        (ev) => {
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
      await refreshSelectedRuntime();
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
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="muted text-sm">加载中…</span>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="mac-window w-full h-[calc(100dvh-2rem)] max-w-[1600px] max-h-[900px] flex">
        <Sidebar
          user={user}
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onCreateProject={createProject}
          threads={threads}
          threadId={threadId}
          onSelectThread={setThreadId}
          onCreateThread={newThread}
          runtime={userRuntimeStatus}
          busy={busy}
          onLogout={logout}
          isAdmin={user.role === "admin"}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            projectName={selectedProject?.name}
            projectSlug={selectedProject?.slug}
            runtime={userRuntimeStatus}
            busy={busy}
            onStart={startSelected}
            onStop={stopSelected}
            isAdmin={user.role === "admin"}
            user={user}
          />

          <div className="flex-1 flex overflow-hidden min-h-0">
            <main className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
                {error ? (
                  <div className="rounded-xl border border-[rgba(255,107,122,0.35)] bg-[rgba(255,107,122,0.1)] px-3 py-2 text-sm text-[var(--error)]">
                    {error}
                  </div>
                ) : null}
                {messages.map((m, idx) => (
                  <MessageBubble key={idx} msg={m} />
                ))}
                {!messages.length ? (
                  <div className="glass-pane p-6 muted text-sm leading-7">
                    在左侧选择或创建项目，即可开始对话。
                    <br />
                    每位用户一个 coding-tools 容器；多个项目共享该容器，在进程内按项目 slug
                    隔离。
                    <br />
                    对话会自动 EnsureRunning 用户容器，并通过 MCP _meta 传入当前项目 slug。
                  </div>
                ) : null}
              </div>
              {statusText ? (
                <div className="px-5 pb-1 text-xs muted flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] animate-pulse">
                    keep
                  </span>
                  {statusText}
                </div>
              ) : null}
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={onSend}
                disabled={!selectedProjectId}
                busy={busy}
                placeholder={
                  selectedProject ? `在「${selectedProject.name}」中提问…` : "请先选择项目"
                }
                modelLabel={modelLabel}
              />
            </main>

            <RightPanel
              project={selectedProject}
              runtime={userRuntimeStatus}
              modelLabel={modelLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function dbToUi(msgs: ChatMessage[]): UiMsg[] {
  const out: UiMsg[] = [];
  for (const m of msgs) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ kind: m.role, content: m.content });
    } else if (m.role === "tool") {
      out.push({ kind: "tool", tool: m.name || "tool", result: m.content });
    }
  }
  return out;
}
