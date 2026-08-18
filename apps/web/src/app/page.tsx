"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STARTER_PROMPTS = [
  {
    title: "探索项目结构",
    desc: "分析工作区中的文件目录并总结项目架构",
    prompt: "请列出当前项目根目录的文件结构，并简要概括各目录的核心作用。",
    icon: "account_tree",
  },
  {
    title: "编写测试用例",
    desc: "为核心逻辑生成单元测试与边界用例",
    prompt: "请针对项目中的核心函数或 API 编写自动化测试脚本。",
    icon: "fact_check",
  },
  {
    title: "依赖与环境诊断",
    desc: "检查容器环境与 package.json / 依赖项",
    prompt: "请帮我检查当前项目的依赖配置，并测试环境是否正常。",
    icon: "build",
  },
  {
    title: "运行终端指令",
    desc: "在隔离容器中执行编译、构建或格式化",
    prompt: "请在项目目录下执行 build 构建命令，并查看输出日志。",
    icon: "terminal",
  },
];

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
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusText]);

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

  async function doSend(textToSend: string) {
    if (!selectedProjectId || !textToSend.trim() || busy) return;
    const content = textToSend.trim();
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
            setStatusText("");
          }
        },
      );
      await refreshSelectedRuntime();
      await refreshRuntimes();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setStatusText("");
    }
  }

  async function logout() {
    await api.logout();
    router.replace("/login");
  }

  if (!user) {
    return (
      <main className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0b10] text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs tracking-wider">正在加载工作区…</span>
      </main>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#0a0b10] text-slate-100">
      {/* Left Sidebar */}
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
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopBar
          projectName={selectedProject?.name}
          projectSlug={selectedProject?.slug}
          runtime={userRuntimeStatus}
          busy={busy}
          onStart={startSelected}
          onStop={stopSelected}
          isAdmin={user.role === "admin"}
          user={user}
          showRightPanel={showRightPanel}
          onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          isSidebarCollapsed={sidebarCollapsed}
        />

        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {/* Chat Stream & Interaction */}
          <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#090a0f]">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0">
              {error ? (
                <div className="w-full max-w-4xl mx-auto rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    <span>{error}</span>
                  </div>
                  <button
                    onClick={() => setError("")}
                    className="hover:text-white p-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              ) : null}

              {messages.length > 0 ? (
                messages.map((m, idx) => <MessageBubble key={idx} msg={m} />)
              ) : (
                /* Welcome Hero Screen */
                <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto px-4 text-center my-auto py-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-5">
                    <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
                    你好，{user.name || "开发者"}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
                    这是专为你配置的云端 AI 编程工作区。每个会话均配备专属沙箱与 MCP 工具链，为你提供自动化代码分析、构建与调试能力。
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                    {STARTER_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(item.prompt);
                        }}
                        className="p-3.5 rounded-xl border border-slate-800/90 bg-[#11141e]/70 hover:bg-[#161a27] hover:border-slate-700 transition-all text-left group shadow-sm flex items-start gap-3"
                      >
                        <span className="material-symbols-outlined text-[20px] text-blue-400 group-hover:text-cyan-400 transition mt-0.5">
                          {item.icon}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {item.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {statusText ? (
                <div className="w-full max-w-4xl mx-auto px-4 py-1.5 text-xs text-slate-400 flex items-center gap-2 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>{statusText}</span>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            {/* Floating Chat Input */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => doSend(input)}
              disabled={!selectedProjectId}
              busy={busy}
              placeholder={
                selectedProject
                  ? `在「${selectedProject.name}」中向 Coding Agent 提问…`
                  : "请先在左侧选择或创建项目"
              }
              modelLabel={modelLabel}
            />
          </main>

          {/* Right Inspect Drawer */}
          <RightPanel
            project={selectedProject}
            runtime={userRuntimeStatus}
            modelLabel={modelLabel}
            isOpen={showRightPanel}
            onClose={() => setShowRightPanel(false)}
          />
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
