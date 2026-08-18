"use client";

import { FormEvent, useRef, useEffect } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  modelLabel: string;
};

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  placeholder,
  modelLabel,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [value]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled || busy) return;
    onSend();
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <form
        onSubmit={submit}
        className="relative rounded-2xl border border-slate-800 bg-[#121520]/90 backdrop-blur-xl shadow-2xl transition-all duration-200 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20"
      >
        <div className="p-3.5 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            className="w-full bg-transparent resize-none text-[13.5px] text-slate-100 placeholder-slate-500 focus:outline-none max-h-48 leading-relaxed font-sans"
            placeholder={placeholder || "问点什么，或输入指令编写代码…"}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (value.trim() && !disabled && !busy) {
                  onSend();
                }
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-800/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {/* Model Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-slate-300 text-[11px] font-medium select-none shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="max-w-[140px] truncate">{modelLabel}</span>
            </div>

            {/* MCP Tools Badge */}
            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/40 text-slate-400 text-[11px] select-none border border-slate-800">
              <span className="material-symbols-outlined text-[13px] text-cyan-400">bolt</span>
              <span>MCP Tools Enabled</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-slate-500 select-none">
              ↵ 发送 &bull; Shift + ↵ 换行
            </span>

            <button
              type="submit"
              disabled={disabled || busy || !value.trim()}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition duration-150 ${
                value.trim() && !busy && !disabled
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 cursor-pointer active:scale-95"
                  : "bg-slate-800/80 text-slate-500 cursor-not-allowed"
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
      <div className="text-center mt-2 text-[11px] text-slate-500">
        AI 可能会生成有偏差的代码，请在关键生产环境中进行校验与测试。
      </div>
    </div>
  );
}
