"use client";

import { MarkdownView } from "./MarkdownView";
import { ThinkingProcess } from "./ThinkingProcess";
import { ToolCallCard } from "./ToolCallCard";

export type UiMsg =
  | { kind: "user"; content: string }
  | {
      kind: "assistant";
      content: string;
      reasoning?: string;
      isThinking?: boolean;
    }
  | {
      kind: "tool";
      tool: string;
      args?: string;
      result?: string;
      toolCallId?: string;
    };

export function MessageBubble({ msg }: { msg: UiMsg }) {
  if (msg.kind === "tool") {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <ToolCallCard tool={msg.tool} args={msg.args} result={msg.result} />
      </div>
    );
  }

  const isUser = msg.kind === "user";

  return (
    <div
      className={`w-full max-w-4xl mx-auto py-2.5 flex gap-3.5 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center text-xs font-semibold shadow-md shadow-blue-500/20 border border-white/20">
            你
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs shadow-md shadow-cyan-500/20 border border-white/20">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col min-w-0 max-w-[86%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-white/40 font-medium">
          <span>{isUser ? "你" : "Coding Agent"}</span>
        </div>

        {/* Reasoning / Thinking accordion if assistant has thinking steps */}
        {!isUser && msg.reasoning ? (
          <ThinkingProcess content={msg.reasoning} isStreaming={msg.isThinking} />
        ) : null}

        {/* Response bubble */}
        {(msg.content || isUser || !msg.reasoning) && (
          <div
            className={`px-4 py-3 text-sm ${
              isUser
                ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/15 rounded-2xl rounded-tr-sm border border-blue-400/30"
                : "bg-[rgba(16,20,32,0.65)] backdrop-blur-2xl border border-white/[0.08] text-slate-100 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)] rounded-2xl rounded-tl-sm w-full"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap break-words leading-relaxed text-white">
                {msg.content}
              </div>
            ) : msg.content ? (
              <MarkdownView content={msg.content} />
            ) : (
              <div className="flex items-center gap-2.5 text-xs text-white/60 py-1">
                <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>思考完成，正在组织回答…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
