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
      className={`w-full max-w-4xl mx-auto py-2 flex gap-3.5 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
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

        {/* Reasoning / Thinking accordion if assistant has thinking steps */}
        {!isUser && msg.reasoning ? (
          <ThinkingProcess content={msg.reasoning} isStreaming={msg.isThinking} />
        ) : null}

        {/* Response bubble (only render if there's content or if no reasoning) */}
        {(msg.content || isUser || !msg.reasoning) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              isUser
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                : "bg-[#131622] border border-slate-800 text-slate-100 shadow-sm w-full"
            }`}
          >
            {isUser ? (
              <div className="whitespace-pre-wrap break-words leading-relaxed text-slate-50">
                {msg.content}
              </div>
            ) : msg.content ? (
              <MarkdownView content={msg.content} />
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>思考完成，正在组织回答…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
