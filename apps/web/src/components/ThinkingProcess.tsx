"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "./MarkdownView";

type Props = {
  content: string;
  isStreaming?: boolean;
};

export function ThinkingProcess({ content, isStreaming }: Props) {
  // Auto-expand during live thinking stream, support manual toggle
  const [userToggled, setUserToggled] = useState(false);
  const [expanded, setExpanded] = useState(!!isStreaming);

  useEffect(() => {
    if (isStreaming && !userToggled) {
      setExpanded(true);
    }
  }, [isStreaming, userToggled]);

  if (!content) return null;

  const toggle = () => {
    setUserToggled(true);
    setExpanded((prev) => !prev);
  };

  const charCount = content.length;

  return (
    <div className="w-full my-2">
      <div className="rounded-2xl border border-purple-500/20 bg-[rgba(26,14,42,0.45)] backdrop-blur-xl overflow-hidden text-xs transition-all shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* Accordion header */}
        <div
          onClick={toggle}
          className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-purple-500/10 select-none transition ${
            expanded ? "border-b border-purple-500/20 bg-purple-950/30" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/20">
              <span className="material-symbols-outlined text-[14px]">psychology</span>
            </span>
            <span className="font-medium text-purple-200">思考过程</span>
            {isStreaming ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-purple-200 bg-purple-500/25 border border-purple-400/30 px-2 py-0.5 rounded-full font-medium shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-pulse shadow-[0_0_6px_rgba(216,180,254,0.9)]" />
                思考中…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] text-white/50 bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400/80" />
                已深度思考 ({charCount} 字)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-white/40">
            <span className="text-[11px] text-white/40 hidden sm:inline">
              {expanded ? "收起思考" : "展开思考"}
            </span>
            <span className="material-symbols-outlined text-[17px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        {/* Accordion body */}
        {expanded && (
          <div className="px-4 py-3 bg-black/40 text-white/80 text-[12px] leading-relaxed max-h-96 overflow-y-auto font-sans animate-in fade-in-50 duration-200 border-t border-purple-500/10">
            <MarkdownView content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
