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
    <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-[rgba(12,15,24,0.65)] backdrop-blur-2xl border-b border-white/[0.07] shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] z-20">
      {/* Left: Breadcrumbs & status */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition mr-1 lg:hidden"
            title="切换侧边栏"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSidebarCollapsed ? "menu_open" : "menu"}
            </span>
          </button>
        )}

        <div className="flex items-center gap-2 text-xs text-white/90 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-blue-400 shrink-0">
            inventory_2
          </span>
          <span className="font-medium truncate max-w-[180px]">
            {projectName || "未选择项目"}
          </span>

          {projectSlug && (
            <>
              <span className="text-white/20 font-light">/</span>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] font-mono text-[11px] text-white/70">
                {projectSlug}
              </span>
            </>
          )}

          {/* Quick Files button beside project */}
          {projectName && onToggleFileTree && (
            <button
              onClick={onToggleFileTree}
              className={`ml-1.5 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 font-medium transition active:scale-[0.98] ${
                isFileTreeOpen
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm"
                  : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]"
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
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-md transition-all ${
                isRunning && isMcpReady
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                  : isRunning
                    ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : runtime.status === "starting"
                      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      : "bg-white/[0.04] text-white/50 border-white/[0.08]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning && isMcpReady
                    ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                    : isRunning
                      ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                      : runtime.status === "starting"
                        ? "bg-amber-400 animate-pulse"
                        : "bg-white/30"
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
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 transition active:scale-[0.98] disabled:opacity-50 shadow-sm"
            title="停止容器"
          >
            <span className="material-symbols-outlined text-[15px]">stop_circle</span>
            <span className="hidden sm:inline">停止工作区</span>
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-400/30 hover:bg-blue-500/25 transition active:scale-[0.98] disabled:opacity-50 shadow-sm"
            title="启动工作区容器"
          >
            <span className="material-symbols-outlined text-[15px]">play_circle</span>
            <span className="hidden sm:inline">启动工作区</span>
          </button>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-white/[0.05] text-white/80 hover:text-white hover:bg-white/[0.09] transition border border-white/[0.08] active:scale-[0.98]"
            title="平台管理后台"
          >
            <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
            <span>管理</span>
          </Link>
        )}

        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* User avatar chip */}
        <div
          className="w-7 h-7 rounded-full bg-white/[0.08] border border-white/[0.12] text-blue-300 flex items-center justify-center text-[11px] font-bold shadow-sm"
          title={user.name || user.email}
        >
          {user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}
        </div>

        {/* Toggle Right Overview Panel button */}
        <button
          onClick={onToggleRightPanel}
          className={`p-1.5 rounded-xl text-xs transition flex items-center justify-center active:scale-[0.98] ${
            showRightPanel
              ? "bg-white/[0.12] text-blue-300 border border-white/[0.14] shadow-sm"
              : "text-white/50 hover:text-white hover:bg-white/[0.08]"
          }`}
          title={showRightPanel ? "关闭工作区概览" : "打开工作区概览"}
        >
          <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
        </button>
      </div>
    </header>
  );
}
