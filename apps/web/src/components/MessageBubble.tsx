"use client";

import { useState } from "react";
import { MarkdownView } from "./MarkdownView";

export type UiMsg =
  | { kind: "user" | "assistant"; content: string }
  | { kind: "tool"; tool: string; args?: string; result?: string };

export function MessageBubble({ msg }: { msg: UiMsg }) {
  const [expanded, setExpanded] = useState(true);

  if (msg.kind === "tool") {
    const isPending = msg.result === undefined;
    return (
      <div className="w-full max-w-4xl mx-auto my-3">
        <div className="rounded-lg border border-slate-800 bg-[#0d1017] overflow-hidden text-xs">
          <div
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 cursor-pointer hover:bg-slate-900 transition select-none"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded bg-cyan-500/10 text-cyan-400">
                <span className="material-symbols-outlined text-[15px]">terminal</span>
              </span>
              <span className="font-mono font-medium text-slate-200">{msg.tool}</span>
              {isPending ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  执行中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  已完成
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-slate-400 text-[18px] transition-transform duration-200">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>

          {expanded && (
            <div className="p-3 space-y-2 border-t border-slate-800/80 bg-black/20">
              {msg.args && (
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                    调用参数
                  </div>
                  <pre className="font-mono text-slate-400 bg-[#07090e] p-2 rounded border border-slate-800/50 overflow-x-auto text-[11px] max-h-32">
                    {msg.args}
                  </pre>
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
                  执行输出
                </div>
                {isPending ? (
                  <div className="flex items-center gap-2 text-slate-500 py-1 text-xs font-mono">
                    <span className="inline-block w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    正在等待容器响应…
                  </div>
                ) : (
                  <pre className="font-mono text-slate-300 bg-[#07090e] p-2.5 rounded border border-slate-800/50 overflow-x-auto text-[11px] max-h-64 whitespace-pre-wrap">
                    {msg.result || "(无输出)"}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isUser = msg.kind === "user";

  return (
    <div className={`w-full max-w-4xl mx-auto py-2 flex gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-xs font-semibold shadow-md shadow-blue-500/10">
            你
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center text-xs shadow-md shadow-cyan-500/10">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
          <span className="font-medium">{isUser ? "你" : "Coding Agent"}</span>
        </div>

        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
              : "bg-[#131622] border border-slate-800 text-slate-100 shadow-sm"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words leading-relaxed text-slate-50">
              {msg.content}
            </div>
          ) : (
            <MarkdownView content={msg.content} />
          )}
        </div>
      </div>
    </div>
  );
}
