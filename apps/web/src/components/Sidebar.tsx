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
}: Props) {
  const [name, setName] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    void onCreateProject(name.trim());
    setName("");
  }

  return (
    <nav className="w-[260px] shrink-0 h-full flex flex-col p-4 border-r border-white/10 bg-[rgba(19,19,19,0.65)] backdrop-blur-[30px] z-20">
      {/* window controls */}
      <div className="flex items-center gap-2 mb-8 pl-2">
        <span className="t-light t-close" />
        <span className="t-light t-min" />
        <span className="t-light t-max" />
      </div>

      {/* brand */}
      <div className="flex items-center space-x-3 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-strong)] to-[var(--accent)] flex items-center justify-center text-white font-bold text-lg shadow-sm">
          C
        </div>
        <div>
          <h1 className="font-semibold text-[15px] tracking-tight leading-tight">Coding Agent</h1>
          <span className="text-[11px] muted">Workspace v0.4</span>
        </div>
      </div>

      {/* nav */}
      <div className="space-y-1 mb-6">
        <div className="nav-item active">
          <span className="material-symbols-outlined text-lg">folder_open</span>
          <span>项目</span>
        </div>
        <div className="nav-item">
          <span className="material-symbols-outlined text-lg">chat</span>
          <span>会话</span>
        </div>
      </div>

      {/* projects */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] uppercase tracking-wider muted font-medium">项目</span>
          <span className="text-[11px] muted">{projects.length}</span>
        </div>
        <form onSubmit={submit} className="flex gap-2 mb-2">
          <input
            className="input !py-1.5 text-sm"
            placeholder="新项目名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-primary !px-2.5 text-sm" type="submit" disabled={busy}>
            <span className="material-symbols-outlined text-[16px] block">add</span>
          </button>
        </form>
        <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
          {projects.map((p) => {
            const active = p.id === selectedProjectId;
            const running = runtime?.status === "running" && runtime.mcpReady;
            return (
              <button
                key={p.id}
                className={`w-full text-left rounded-lg px-3 py-2.5 border transition ${
                  active
                    ? "bg-[rgba(173,198,255,0.12)] border-[rgba(173,198,255,0.3)]"
                    : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
                }`}
                onClick={() => onSelectProject(p.id)}
              >
                <div className="font-medium text-sm truncate">{p.name}</div>
                <div className="text-[11px] muted mt-0.5 truncate">{p.slug}</div>
                <div className="mt-1.5">
                  {running ? (
                    <span className="badge ok">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
                      运行中
                    </span>
                  ) : (
                    <span className="badge">空闲</span>
                  )}
                </div>
              </button>
            );
          })}
          {!projects.length ? (
            <p className="muted text-xs px-1">还没有项目，先创建一个。</p>
          ) : null}
        </div>
      </div>

      {/* threads */}
      <div className="min-h-0 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] uppercase tracking-wider muted font-medium">会话</span>
          <button
            className="text-[11px] muted hover:text-[var(--text)] flex items-center gap-1 transition"
            disabled={!selectedProjectId || busy}
            onClick={() => onCreateThread()}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            新建
          </button>
        </div>
        <div className="space-y-1 overflow-y-auto pr-1">
          {threads.map((t) => (
            <button
              key={t.id}
              className={`w-full text-left rounded-lg px-3 py-2 border text-sm truncate transition ${
                t.id === threadId
                  ? "bg-[rgba(255,255,255,0.1)] border-white/20"
                  : "bg-transparent border-transparent hover:bg-white/[0.06]"
              }`}
              onClick={() => onSelectThread(t.id)}
            >
              {t.title}
            </button>
          ))}
          {!threads.length ? (
            <p className="muted text-xs px-1">发送第一条消息将自动创建会话。</p>
          ) : null}
        </div>
      </div>

      {/* footer */}
      <div className="pt-4 border-t border-white/5 space-y-1 mt-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="avatar">{user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}</span>
          <div className="min-w-0">
            <div className="text-sm truncate">{user.name || user.email}</div>
            <div className="text-[11px] muted truncate">{user.email}</div>
          </div>
        </div>
        {isAdmin ? (
          <Link className="nav-item !cursor-pointer" href="/admin">
            <span className="material-symbols-outlined text-lg">settings</span>
            <span>管理</span>
          </Link>
        ) : null}
        <button className="nav-item w-full !cursor-pointer" onClick={onLogout}>
          <span className="material-symbols-outlined text-lg">logout</span>
          <span>退出</span>
        </button>
      </div>
    </nav>
  );
}
