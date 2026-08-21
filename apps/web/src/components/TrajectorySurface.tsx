"use client";

import { MarkdownView } from "./MarkdownView";
import { MessageBubble } from "./MessageBubble";
import { ThinkingProcess } from "./ThinkingProcess";
import { ToolCallCard } from "./ToolCallCard";

type TrajectorySurfaceProps = {
  messages: any[]; // UiMsg[]
  onMessageClick?: (msg: any) => void;
};

export function TrajectorySurface({ messages = [], onMessageClick }: TrajectorySurfaceProps) {
  // Simple trajectory list - minimal LiveAgent style
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-8">
      <div className="glass-card rounded-3xl border border-white/[0.07] overflow-hidden">
        <div className="px-5 py-3 bg-[rgba(255,255,255,0.035)] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-[18px]">timeline</span>
            <span className="text-xs font-medium tracking-widest text-white/70">对话轨迹</span>
          </div>
          <div className="text-[10px] text-white/40 font-mono">LIVEAGENT STYLE</div>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-4 space-y-6">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-white/30 text-sm">
              还没有任何对话历史
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                onClick={() => onMessageClick?.(msg)}
                className="group cursor-pointer"
              >
                <div className="flex gap-3 text-[10px] text-white/50 mb-1.5 font-mono">
                  <span>{msg.kind === "user" ? "你" : "Agent"}</span>
                  <span className="text-white/30">•</span>
                  <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                {msg.kind === "assistant" && msg.reasoning && (
                  <div className="mb-2">
                    <ThinkingProcess content={msg.reasoning} isStreaming={false} />
                  </div>
                )}

                <div className={`text-sm ${msg.kind === "user" ? "text-right" : ""}`}>
                  {msg.kind === "user" ? (
                    <div className="bg-white/10 text-white px-4 py-2.5 rounded-2xl inline-block">
                      {msg.content?.slice(0, 120)}...
                    </div>
                  ) : msg.content ? (
                    <div className="prose prose-invert max-w-none text-white/90">
                      <MarkdownView content={msg.content} />
                    </div>
                  ) : (
                    <div className="text-white/60 text-xs">思考中...</div>
                  )}
                </div>

                {msg.kind === "tool" && (
                  <div className="mt-2 text-[10px] font-mono text-cyan-300">
                    工具调用：{msg.tool}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] p-3 text-center">
          <button className="text-[10px] text-white/40 hover:text-white/60 transition-all font-mono flex items-center gap-1 mx-auto">
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
            展开完整历史
          </button>
        </div>
      </div>
    </div>
  );
}