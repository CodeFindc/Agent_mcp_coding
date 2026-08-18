"use client";

import Link from "next/link";
import type { RuntimeStatus, User } from "@/lib/api";

type Props = {
  projectName?: string;
  projectSlug?: string;
  runtime: RuntimeStatus | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  isAdmin: boolean;
  user: User;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  isFileTreeOpen?: boolean;
  onToggleFileTree?: () => void;
};

export function TopBar({
  projectName,
  projectSlug,
  runtime,
  busy,
  onStart,
  onStop,
  isAdmin,
  user,
  showRightPanel,
  onToggleRightPanel,
  onToggleSidebar,
  isSidebarCollapsed,
  isFileTreeOpen,
  onToggleFileTree,
}: Props) {
  const isRunning = runtime?.status === "running";
  const isMcpReady = runtime?.mcpReady;

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-[#0d0f17]/90 backdrop-blur-md border-b border-slate-800/80 z-20">
      {/* Left: Breadcrumbs & status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition mr-1 lg:hidden"
            title="切换侧边栏"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSidebarCollapsed ? "menu_open" : "menu"}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-300 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-blue-400 shrink-0">
            inventory_2
          </span>
          <span className="font-medium truncate max-w-[160px]">
            {projectName || "未选择项目"}
          </span>

          {projectSlug && (
            <>
              <span className="text-slate-600">/</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-mono text-[11px] text-slate-400">
                {projectSlug}
              </span>
            </>
          )}

          {/* Quick Files button beside project */}
          {projectName && onToggleFileTree && (
            <button
              onClick={onToggleFileTree}
              className={`ml-1 px-2 py-0.5 rounded-lg text-xs flex items-center gap-1 font-medium transition ${
                isFileTreeOpen
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "bg-slate-800/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/50"
              }`}
              title="展开项目文件树"
            >
              <span className="material-symbols-outlined text-[14px]">folder_open</span>
              <span>查看文件</span>
            </button>
          )}
        </div>

        {/* Runtime Status Pill */}
        <div className="hidden sm:flex items-center ml-2">
          {runtime ? (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                isRunning && isMcpReady
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : isRunning
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                    : runtime.status === "starting"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-slate-800/80 text-slate-400 border-slate-700/50"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning && isMcpReady
                    ? "bg-emerald-400 animate-pulse"
                    : isRunning
                      ? "bg-cyan-400 animate-pulse"
                      : runtime.status === "starting"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-slate-500"
                }`}
              />
              <span>
                {isRunning && isMcpReady
                  ? "MCP 就绪"
                  : isRunning
                    ? "容器运行中"
                    : runtime.status === "starting"
                      ? "启动中…"
                      : "工作区已停止"}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <button
            onClick={onStop}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition disabled:opacity-50"
            title="停止容器"
          >
            <span className="material-symbols-outlined text-[14px]">stop_circle</span>
            <span className="hidden sm:inline">停止工作区</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600/15 text-blue-400 border border-blue-500/30 hover:bg-blue-600/25 transition disabled:opacity-50"
            title="启动工作区容器"
          >
            <span className="material-symbols-outlined text-[14px]">play_circle</span>
            <span className="hidden sm:inline">启动工作区</span>
          </button>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
            title="平台管理后台"
          >
            <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
            <span>管理</span>
          </Link>
        )}

        <div className="w-px h-4 bg-slate-800 mx-1" />

        {/* User avatar chip */}
        <div
          className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center text-[11px] font-bold"
          title={user.name || user.email}
        >
          {user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
        </div>

        {/* Toggle Right Overview Panel button */}
        <button
          onClick={onToggleRightPanel}
          className={`p-1.5 rounded-lg text-xs transition flex items-center justify-center ${
            showRightPanel
              ? "bg-slate-800 text-blue-400 border border-slate-700"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
          title={showRightPanel ? "关闭工作区概览" : "打开工作区概览"}
        >
          <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
        </button>
      </div>
    </header>
  );
}
