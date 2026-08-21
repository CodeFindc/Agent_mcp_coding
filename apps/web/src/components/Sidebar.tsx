"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { ChatThread, Project, RuntimeStatus, User } from "@/lib/api";

type Props = {
  user: User;
  projects: Project[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  onCreateProject: (name: string) => Promise<void> | void;
  threads: ChatThread[];
  threadId: number | null;
  onSelectThread: (id: number) => void;
  onCreateThread: () => Promise<void> | void;
  runtime: RuntimeStatus | null;
  busy: boolean;
  onLogout: () => void;
  isAdmin: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleFiles?: () => void;
  isFileTreeOpen?: boolean;
};

export function Sidebar({
  user,
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  threads,
  threadId,
  onSelectThread,
  onCreateThread,
  runtime,
  busy,
  onLogout,
  isAdmin,
  collapsed = false,
  onToggleCollapse,
  onToggleFiles,
  isFileTreeOpen = false,
}: Props) {
  const [showNewProj, setShowNewProj] = useState(false);
  const [name, setName] = useState("");

  function submitProj(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void onCreateProject(name.trim());
    setName("");
    setShowNewProj(false);
  }

  const isRunning = runtime?.status === "running" && runtime.mcpReady;

  return (
    <aside
      className={`h-full flex flex-col bg-[rgba(10,13,22,0.65)] backdrop-blur-2xl border-r border-white/[0.07] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] transition-all duration-300 z-30 select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* macOS Window Controls & App Brand */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {!collapsed ? (
            <div className="flex items-center gap-1.5 pl-0.5">
              <span className="mac-dot mac-dot-close" title="关闭" />
              <span className="mac-dot mac-dot-min" title="最小化" />
              <span className="mac-dot mac-dot-zoom" title="最大化" />
            </div>
          ) : null}

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0 border border-white/20">
              <span className="material-symbols-outlined text-[16px]">terminal</span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-semibold text-xs tracking-tight text-white/95 block truncate">
                  Coding Agent
                </span>
                <span className="text-[10px] text-white/40 block -mt-0.5 font-medium tracking-wide">
                  macOS Workspace
                </span>
              </div>
            )}
          </div>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition"
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <span className="material-symbols-outlined text-[17px]">
              {collapsed ? "menu_open" : "menu"}
            </span>
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-3 border-b border-white/[0.06] shrink-0 space-y-2">
          {/* New Chat Button */}
          <button
            onClick={() => onCreateThread()}
            disabled={!selectedProjectId || busy}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/30 text-blue-300 hover:text-blue-200 transition text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>新建会话</span>
          </button>

          {/* Toggle File Tree Button */}
          {selectedProjectId && onToggleFiles && (
            <button
              onClick={onToggleFiles}
              className={`w-full flex items-center justify-between py-1.5 px-3 rounded-xl border text-xs font-medium transition active:scale-[0.98] ${
                isFileTreeOpen
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/35 shadow-sm"
                  : "bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.07] border-white/[0.06]"
              }`}
              title="展开/收起项目目录文件树"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-cyan-400">
                  folder_open
                </span>
                <span>查看项目文件</span>
              </div>
              <span className="material-symbols-outlined text-[14px]">
                {isFileTreeOpen ? "chevron_left" : "chevron_right"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Main scrollable section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 min-h-0">
        {/* Project section */}
        <div>
          {!collapsed ? (
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-white/40 tracking-wider uppercase">
                项目 / Workspace
              </span>
              <button
                onClick={() => setShowNewProj(!showNewProj)}
                className="text-white/40 hover:text-white p-0.5 rounded transition"
                title="创建项目"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 mb-2">
              <button
                onClick={() => setShowNewProj(!showNewProj)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition"
                title="创建项目"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
              {onToggleFiles && (
                <button
                  onClick={onToggleFiles}
                  className={`p-2 rounded-lg transition ${
                    isFileTreeOpen
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-white/50 hover:text-white hover:bg-white/[0.08]"
                  }`}
                  title="查看文件"
                >
                  <span className="material-symbols-outlined text-[18px]">folder_open</span>
                </button>
              )}
            </div>
          )}

          {showNewProj && !collapsed && (
            <form onSubmit={submitProj} className="mb-2 px-1">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="项目名称…"
                  className="flex-1 glass-input rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/40 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
                >
                  确定
                </button>
              </div>
            </form>
          )}

          {!collapsed ? (
            <div className="space-y-1">
              {projects.map((p) => {
                const isSelected = p.id === selectedProjectId;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all group ${
                      isSelected
                        ? "bg-white/[0.1] text-white font-medium shadow-sm border border-white/[0.12] backdrop-blur-md"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white/90 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          isSelected ? "text-blue-400" : "text-white/40 group-hover:text-white/60"
                        }`}
                      >
                        {isSelected ? "folder_open" : "folder"}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isRunning ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-white/30"
                          }`}
                          title={isRunning ? "工作区运行中" : "工作区空闲"}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
              {!projects.length && (
                <div className="text-[11px] text-white/30 px-2 py-1">暂无项目</div>
              )}
            </div>
          ) : (
            <div className="space-y-1 flex flex-col items-center">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  title={p.name}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-medium transition ${
                    p.id === selectedProjectId
                      ? "bg-blue-500/25 text-blue-300 border border-blue-400/40 shadow-sm"
                      : "text-white/50 hover:bg-white/[0.08]"
                  }`}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Threads section */}
        <div>
          {!collapsed ? (
            <div className="px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-white/40 tracking-wider uppercase">
                会话历史
              </span>
            </div>
          ) : null}

          {!collapsed ? (
            <div className="space-y-0.5">
              {threads.map((t) => {
                const isSelected = t.id === threadId;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectThread(t.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all ${
                      isSelected
                        ? "bg-white/[0.08] text-white font-medium border border-white/[0.06]"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/80 border border-transparent"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] text-white/40 shrink-0">
                      chat_bubble
                    </span>
                    <span className="truncate">{t.title || "新会话"}</span>
                  </button>
                );
              })}
              {!threads.length && (
                <div className="text-[11px] text-white/30 px-2 py-1">暂无会话历史</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <button
                onClick={() => onCreateThread()}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition"
                title="新建会话"
              >
                <span className="material-symbols-outlined text-[18px]">add_comment</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User info footer */}
      <div className="p-3 border-t border-white/[0.06] bg-black/20 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/[0.12] text-blue-300 flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm">
                {user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white/90 truncate">
                  {user.name || user.email}
                </div>
                <div className="text-[10px] text-white/40 truncate">{user.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition"
                  title="管理后台"
                >
                  <span className="material-symbols-outlined text-[16px]">settings</span>
                </Link>
              )}
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition"
                title="退出登录"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="退出登录"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
