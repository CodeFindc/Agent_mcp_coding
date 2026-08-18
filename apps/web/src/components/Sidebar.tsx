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
      className={`h-full flex flex-col bg-[#0b0d14] border-r border-slate-800/80 transition-all duration-300 z-30 select-none ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand & collapse */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 shrink-0">
            <span className="material-symbols-outlined text-[18px]">terminal</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-sm tracking-tight text-slate-100 block truncate">
                Coding Agent
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5">
                AI Workspace Platform
              </span>
            </div>
          )}
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {collapsed ? "menu_open" : "menu"}
            </span>
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-3 border-b border-slate-800/60 shrink-0 space-y-2">
          {/* New Chat Button */}
          <button
            onClick={() => onCreateThread()}
            disabled={!selectedProjectId || busy}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>新建会话</span>
          </button>

          {/* Toggle File Tree Button (Similar to Zhipu / CodeGeeX) */}
          {selectedProjectId && onToggleFiles && (
            <button
              onClick={onToggleFiles}
              className={`w-full flex items-center justify-between py-1.5 px-3 rounded-xl border text-xs font-medium transition ${
                isFileTreeOpen
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800"
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
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                项目 / Workspace
              </span>
              <button
                onClick={() => setShowNewProj(!showNewProj)}
                className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
                title="创建项目"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 mb-2">
              <button
                onClick={() => setShowNewProj(!showNewProj)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
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
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-500"
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
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition group ${
                      isSelected
                        ? "bg-slate-800 text-white font-medium shadow-sm border border-slate-700"
                        : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[16px] ${
                          isSelected ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"
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
                            isRunning ? "bg-emerald-400" : "bg-slate-500"
                          }`}
                          title={isRunning ? "工作区运行中" : "工作区空闲"}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
              {!projects.length && (
                <div className="text-[11px] text-slate-500 px-2 py-1">暂无项目</div>
              )}
            </div>
          ) : (
            <div className="space-y-1 flex flex-col items-center">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  title={p.name}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs transition ${
                    p.id === selectedProjectId
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/40"
                      : "text-slate-400 hover:bg-slate-800"
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
              <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
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
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2 transition ${
                      isSelected
                        ? "bg-slate-800/90 text-slate-100 font-medium"
                        : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] text-slate-500 shrink-0">
                      chat_bubble
                    </span>
                    <span className="truncate">{t.title || "新会话"}</span>
                  </button>
                );
              })}
              {!threads.length && (
                <div className="text-[11px] text-slate-500 px-2 py-1">暂无会话历史</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              <button
                onClick={() => onCreateThread()}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="新建会话"
              >
                <span className="material-symbols-outlined text-[18px]">add_comment</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User info footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center text-xs font-semibold shrink-0">
                {user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">
                  {user.name || user.email}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                  title="管理后台"
                >
                  <span className="material-symbols-outlined text-[16px]">settings</span>
                </Link>
              )}
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
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
