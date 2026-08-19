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
      <div className="rounded-xl border border-purple-900/30 bg-[#0d1017]/90 overflow-hidden text-xs transition-all shadow-sm">
        {/* Accordion header */}
        <div
          onClick={toggle}
          className={`flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-slate-800/40 select-none transition ${
            expanded ? "border-b border-purple-900/30 bg-purple-950/10" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-500/15 text-purple-400">
              <span className="material-symbols-outlined text-[15px]">psychology</span>
            </span>
            <span className="font-medium text-slate-200">思考过程</span>
            {isStreaming ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                思考中…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                已深度思考 ({charCount} 字)
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {expanded ? "收起思考" : "展开思考"}
            </span>
            <span className="material-symbols-outlined text-[18px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        {/* Accordion body */}
        {expanded && (
          <div className="px-4 py-3 bg-black/30 text-slate-300 text-[12px] leading-relaxed max-h-96 overflow-y-auto font-sans animate-in fade-in-50 duration-200 border-t border-purple-900/10">
            <MarkdownView content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
