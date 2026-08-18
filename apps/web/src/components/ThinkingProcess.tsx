"use client";

import { useState } from "react";
import { MarkdownView } from "./MarkdownView";

type Props = {
  content: string;
  isStreaming?: boolean;
};

export function ThinkingProcess({ content, isStreaming }: Props) {
  // Default collapsed as requested
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="w-full my-2">
      <div className="rounded-xl border border-slate-800/90 bg-[#0d1017]/80 overflow-hidden text-xs transition-all">
        {/* Accordion header */}
        <div
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center justify-between px-3.5 py-2 cursor-pointer hover:bg-slate-800/40 select-none transition ${
            expanded ? "border-b border-slate-800/60" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-500/10 text-purple-400">
              <span className="material-symbols-outlined text-[15px]">psychology</span>
            </span>
            <span className="font-medium text-slate-300">思考过程</span>
            {isStreaming ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                思考中…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                已深度思考
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              {expanded ? "收起" : "展开"}
            </span>
            <span className="material-symbols-outlined text-[18px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        {/* Accordion body */}
        {expanded && (
          <div className="px-4 py-3 bg-black/20 text-slate-400 text-[12px] leading-relaxed max-h-96 overflow-y-auto font-sans animate-in fade-in-50 duration-200">
            <MarkdownView content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
