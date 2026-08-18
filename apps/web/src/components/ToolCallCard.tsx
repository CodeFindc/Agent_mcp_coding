"use client";

import { useState } from "react";

type Props = {
  tool: string;
  args?: string;
  result?: string;
};

export function ToolCallCard({ tool, args, result }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const isPending = result === undefined;
  const parsedArgs = parseArgs(args);

  function copyText(txt: string) {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Get tool meta (icon, color, label)
  const meta = getToolMeta(tool);

  return (
    <div className="w-full my-2.5">
      <div className="rounded-xl border border-slate-800 bg-[#0c0e15] overflow-hidden text-xs shadow-md shadow-black/30">
        {/* Header */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/70 hover:bg-slate-900 cursor-pointer select-none transition border-b border-slate-800/60"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Tool Icon */}
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-lg ${meta.bgColor} ${meta.textColor}`}
            >
              <span className="material-symbols-outlined text-[16px]">{meta.icon}</span>
            </span>

            {/* Tool Name & target summary */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-semibold text-slate-200">{tool}</span>
              {meta.summary(parsedArgs) && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/50 truncate max-w-xs sm:max-w-md">
                  {meta.summary(parsedArgs)}
                </span>
              )}
            </div>

            {/* Status Badge */}
            {isPending ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                执行中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                已完成
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        {/* Content Details */}
        {expanded && (
          <div className="p-3.5 space-y-3 bg-[#08090e]">
            {/* Specific tool parameter view */}
            {renderToolParameters(tool, parsedArgs, args)}

            {/* Execution Result */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 px-0.5">
                <span>执行输出 (Output)</span>
                {result && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(result);
                    }}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                    title="复制输出"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copied ? "check" : "content_copy"}
                    </span>
                    <span>{copied ? "已复制" : "复制"}</span>
                  </button>
                )}
              </div>

              {isPending ? (
                <div className="flex items-center gap-2 text-slate-400 py-2.5 px-3 rounded-lg bg-slate-900/40 border border-slate-800/60 font-mono text-xs">
                  <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>正在隔离容器沙箱中执行…</span>
                </div>
              ) : (
                <pre className="font-mono text-slate-200 bg-[#05060a] p-3 rounded-lg border border-slate-800/80 overflow-x-auto text-[11px] leading-relaxed max-h-72 whitespace-pre-wrap">
                  {result || "(无返回输出)"}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function parseArgs(args?: string): Record<string, unknown> {
  if (!args) return {};
  try {
    return JSON.parse(args);
  } catch {
    return { raw: args };
  }
}

function getToolMeta(tool: string) {
  switch (tool) {
    case "bash":
    case "exec":
    case "run_command":
      return {
        icon: "terminal",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.command === "string" ? args.command : "",
      };
    case "read_file":
      return {
        icon: "description",
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.path === "string" ? args.path : "",
      };
    case "edit_file":
    case "write_file":
      return {
        icon: "edit_document",
        bgColor: "bg-cyan-500/10",
        textColor: "text-cyan-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.path === "string" ? args.path : "",
      };
    case "list_directory":
    case "glob_find":
      return {
        icon: "folder_open",
        bgColor: "bg-amber-500/10",
        textColor: "text-amber-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.path === "string"
            ? args.path
            : typeof args.pattern === "string"
              ? args.pattern
              : "",
      };
    case "grep_search":
      return {
        icon: "search",
        bgColor: "bg-purple-500/10",
        textColor: "text-purple-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.query === "string" ? `"${args.query}"` : "",
      };
    default:
      return {
        icon: "extension",
        bgColor: "bg-slate-500/10",
        textColor: "text-slate-400",
        summary: () => "",
      };
  }
}

function renderToolParameters(
  tool: string,
  args: Record<string, unknown>,
  rawArgs?: string,
) {
  if (tool === "bash" && typeof args.command === "string") {
    return (
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 px-0.5">
          执行指令
        </div>
        <div className="flex items-center gap-2 bg-[#05060a] px-3 py-2 rounded-lg border border-slate-800/80 font-mono text-emerald-400 text-xs">
          <span className="text-slate-600 select-none">$</span>
          <span className="text-slate-200">{args.command}</span>
        </div>
      </div>
    );
  }

  if (tool === "edit_file" && typeof args.path === "string") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">目标文件:</span>
          <span className="font-mono text-cyan-300 font-medium">{args.path}</span>
        </div>
        {Boolean(args.old_str) && (
          <div>
            <div className="text-[10px] font-mono text-rose-400 mb-0.5">- 替换前 (Old):</div>
            <pre className="font-mono text-[11px] bg-rose-950/20 text-rose-300 p-2 rounded border border-rose-900/30 overflow-x-auto max-h-32">
              {String(args.old_str)}
            </pre>
          </div>
        )}
        {Boolean(args.new_str) && (
          <div>
            <div className="text-[10px] font-mono text-emerald-400 mb-0.5">+ 替换后 (New):</div>
            <pre className="font-mono text-[11px] bg-emerald-950/20 text-emerald-300 p-2 rounded border border-emerald-900/30 overflow-x-auto max-h-32">
              {String(args.new_str)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (tool === "read_file" && typeof args.path === "string") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">读取文件:</span>
        <span className="font-mono text-blue-300 font-medium">{args.path}</span>
        {args.offset !== undefined && (
          <span className="text-slate-500 text-[11px]">
            (offset: {String(args.offset)}, limit: {String(args.limit)})
          </span>
        )}
      </div>
    );
  }

  if (rawArgs) {
    return (
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 px-0.5">
          入参 (Arguments)
        </div>
        <pre className="font-mono text-slate-400 bg-[#05060a] p-2.5 rounded-lg border border-slate-800/80 overflow-x-auto text-[11px] max-h-36">
          {rawArgs}
        </pre>
      </div>
    );
  }

  return null;
}
