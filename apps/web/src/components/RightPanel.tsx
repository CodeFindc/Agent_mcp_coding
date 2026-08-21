"use client";

import type { ReactNode } from "react";
import type { Project, RuntimeStatus } from "@/lib/api";

type Props = {
  project: Project | null;
  runtime: RuntimeStatus | null;
  modelLabel: string;
  isOpen: boolean;
  onClose: () => void;
};

export function RightPanel({ project, runtime, modelLabel, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-white/[0.08] bg-[rgba(10,13,22,0.8)] backdrop-blur-2xl flex flex-col h-full z-20 select-none animate-in slide-in-from-right-4 duration-200 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06] shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/80">
          <span className="material-symbols-outlined text-[17px] text-blue-400">
            space_dashboard
          </span>
          <span>工作区概览</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition"
          title="关闭面板"
        >
          <span className="material-symbols-outlined text-[17px]">close</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* Runtime Card */}
        <section className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.035)] backdrop-blur-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-cyan-400">memory</span>
              运行态容器
            </span>
            <StatusBadge runtime={runtime} />
          </div>

          <div className="space-y-2 text-xs">
            <InfoRow label="容器名" value={runtime?.containerName || "—"} mono />
            <InfoRow label="MCP 状态" value={runtime?.mcpReady ? "已连接 (Ready)" : "未挂载"} />
            <InfoRow
              label="最近活动"
              value={
                runtime?.lastActiveAt
                  ? new Date(runtime.lastActiveAt).toLocaleTimeString()
                  : "—"
              }
            />
          </div>
        </section>

        {/* Project Card */}
        <section className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.035)] backdrop-blur-xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-blue-400">folder</span>
              当前项目
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <InfoRow label="名称" value={project?.name || "未选择"} />
            <InfoRow label="Slug" value={project?.slug || "—"} mono />
            <InfoRow label="容器内路径" value={project?.slug ? `/projects/${project.slug}` : "—"} mono />
          </div>
        </section>

        {/* Model Card */}
        <section className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.035)] backdrop-blur-xl p-4 space-y-3 shadow-sm">
          <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-purple-400">
              psychology
            </span>
            AI 模型通道
          </span>

          <div className="space-y-2 text-xs">
            <InfoRow label="接入模型" value={modelLabel} />
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[11px] text-white/50 leading-relaxed">
              支持在「管理后台」灵活切换模型渠道与 API Key，对话时自动通过 MCP 代理执行容器操作。
            </div>
          </div>
        </section>

        {/* Multi-tenant Architecture Tip */}
        <section className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/20 text-[11px] text-white/60 leading-relaxed space-y-1.5 backdrop-blur-sm">
          <div className="font-medium text-blue-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            用户级容器隔离机制
          </div>
          <div>
            每位开发者独享一个 Linux 运行容器，所有代码和工具进程在容器内隔离执行。多个项目按 slug 划分独立工作区。
          </div>
        </section>
      </div>
    </aside>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className={`text-right text-white/80 break-all font-medium ${mono ? "font-mono text-[11px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ runtime }: { runtime: RuntimeStatus | null }) {
  if (!runtime) return <span className="text-[11px] text-white/40">未知</span>;
  if (runtime.status === "running" && runtime.mcpReady)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-400/25 font-medium shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        运行中
      </span>
    );
  if (runtime.status === "running")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-400/25 font-medium shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        容器就绪
      </span>
    );
  if (runtime.status === "starting")
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/25 font-medium shadow-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        启动中
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/[0.08] font-medium">
      已停止
    </span>
  );
}
