"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SkillMeta } from "@/lib/api";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  modelLabel: string;
  skills?: SkillMeta[];
};

type SlashMatch = {
  /** start index of '/' in value */
  start: number;
  /** text after '/' used for filter (may include nested path) */
  query: string;
};

function detectSlash(value: string, cursor: number): SlashMatch | null {
  const upto = value.slice(0, cursor);
  // Match a /token at start or after whitespace on the current line.
  const m = /(^|\s)\/([a-zA-Z0-9._/-]*)$/.exec(upto);
  if (!m) return null;
  const query = m[2] || "";
  const start = upto.length - query.length - 1; // position of '/'
  return { start, query };
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  placeholder,
  modelLabel,
  skills = [],
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [value]);

  const slash = useMemo(() => detectSlash(value, cursor), [value, cursor]);

  const filtered = useMemo(() => {
    if (!slash) return [];
    const q = slash.query.toLowerCase();
    return skills
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, 8);
  }, [slash, skills]);

  useEffect(() => {
    setActiveIdx(0);
  }, [slash?.query, filtered.length]);

  function applySkill(name: string) {
    if (!slash) return;
    const before = value.slice(0, slash.start);
    const after = value.slice(cursor);
    // Keep leading space from before; insert `/name ` 
    const next = `${before}/${name} ${after.replace(/^\s*/, "")}`;
    onChange(next);
    const newPos = before.length + name.length + 2; // /name␠
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newPos, newPos);
      setCursor(newPos);
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled || busy) return;
    onSend();
  }

  const showMenu = Boolean(slash && filtered.length > 0 && !disabled && !busy);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <form
        onSubmit={submit}
        className="relative rounded-2xl border border-white/[0.12] bg-[rgba(16,20,32,0.78)] backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] transition-all duration-200 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-[0_0_30px_rgba(59,130,246,0.15),0_20px_50px_-10px_rgba(0,0,0,0.6)]"
      >
        {showMenu && (
          <div className="absolute left-3 right-3 bottom-full mb-2.5 z-20 rounded-2xl border border-white/[0.12] bg-[rgba(12,15,25,0.88)] backdrop-blur-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] overflow-hidden animate-in fade-in-50 slide-in-from-bottom-2 duration-150">
            <div className="px-3.5 py-2 text-[10px] uppercase tracking-wider text-white/40 border-b border-white/[0.06] font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[13px] text-fuchsia-400">auto_awesome</span>
                <span>可用技能 · Skills</span>
              </span>
              <span className="text-[10px] text-white/30 lowercase">↑↓ 选择 · Tab/Enter 确认</span>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map((s, i) => (
                <li key={`${s.scope}:${s.name}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applySkill(s.name);
                    }}
                    className={`w-full text-left px-3.5 py-2 flex flex-col gap-0.5 transition ${
                      i === activeIdx ? "bg-blue-500/20 text-white" : "hover:bg-white/[0.05] text-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[14px] text-fuchsia-300">auto_awesome</span>
                      <span className="font-mono text-xs font-semibold text-white truncate">/{s.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/[0.08] text-white/50 border border-white/[0.08] shrink-0 font-mono">
                        {s.scope}
                      </span>
                    </div>
                    {s.description && (
                      <span className="text-[11px] text-white/50 line-clamp-1 pl-6 font-normal">{s.description}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-3.5 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            className="w-full bg-transparent resize-none text-[13.5px] text-white placeholder-white/40 focus:outline-none max-h-48 leading-relaxed font-sans"
            placeholder={placeholder || "问点什么，输入 / 选择 skill…"}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              onChange(e.target.value);
              setCursor(e.target.selectionStart ?? e.target.value.length);
            }}
            onClick={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyUp={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onSelect={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (showMenu) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey && filtered[activeIdx])) {
                  e.preventDefault();
                  applySkill(filtered[activeIdx].name);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  // move cursor past slash query to dismiss
                  const el = textareaRef.current;
                  if (el && slash) {
                    const pos = slash.start + 1 + slash.query.length;
                    el.setSelectionRange(pos, pos);
                    setCursor(pos);
                  }
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !disabled && !busy) {
                  onSend();
                }
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-white/[0.06] text-xs text-white/50">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/80 text-[11px] font-medium select-none shadow-sm backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="max-w-[140px] truncate">{modelLabel}</span>
            </div>

            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] text-white/50 text-[11px] select-none border border-white/[0.06]">
              <span className="material-symbols-outlined text-[13px] text-cyan-400">bolt</span>
              <span>MCP Tools</span>
            </div>

            {skills.length > 0 && (
              <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-fuchsia-500/10 text-fuchsia-300 text-[11px] select-none border border-fuchsia-500/20">
                <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                <span>{skills.length} skills · /</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-white/30 select-none">
              ↵ 发送 · Shift + ↵ 换行 · / skill
            </span>

            <button
              type="submit"
              disabled={disabled || busy || !value.trim()}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition duration-150 ${
                value.trim() && !busy && !disabled
                  ? "bg-gradient-to-tr from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/30 cursor-pointer active:scale-95 border border-white/20"
                  : "bg-white/[0.06] text-white/20 cursor-not-allowed border border-white/[0.04]"
              }`}
              title="发送"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              )}
            </button>
          </div>
        </div>
      </form>
      <div className="text-center mt-2 text-[11px] text-white/30 tracking-tight">
        AI 生成代码仅供参考，请在关键生产环境中进行校验与测试
      </div>
    </div>
  );
}
