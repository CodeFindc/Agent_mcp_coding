"use client";

import { useState } from "react";

type Props = {
  tool: string;
  args?: string;
  result?: string;
};

export function ToolCallCard({ tool, args, result }: Props) {
  // Default collapsed as requested
  const [expanded, setExpanded] = useState(false);
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
    <div className="w-full my-2">
      <div className="rounded-2xl border border-white/[0.08] bg-[rgba(13,16,26,0.7)] backdrop-blur-xl overflow-hidden text-xs shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* Header */}
        <div
          onClick={() => setExpanded(!expanded)}
          className={`flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer select-none transition ${
            expanded ? "border-b border-white/[0.06] bg-white/[0.05]" : ""
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Tool Icon */}
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-lg ${meta.bgColor} ${meta.textColor} border border-white/10`}
            >
              <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
            </span>

            {/* Tool Name & target summary */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-semibold text-white/95">{tool}</span>
              {meta.summary(parsedArgs) && (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/60 border border-white/[0.08] truncate max-w-xs sm:max-w-md">
                  {meta.summary(parsedArgs)}
                </span>
              )}
            </div>

            {/* Status Badge */}
            {isPending ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-400/15 border border-amber-400/25 px-2 py-0.5 rounded-full font-medium shrink-0 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                执行中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-400/15 border border-emerald-400/25 px-2 py-0.5 rounded-full font-medium shrink-0 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                已完成
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-white/40">
            <span className="text-[11px] text-white/40 hidden sm:inline">
              {expanded ? "收起" : "详情"}
            </span>
            <span className="material-symbols-outlined text-[17px]">
              {expanded ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        {/* Content Details */}
        {expanded && (
          <div className="p-3.5 space-y-3 bg-[rgba(6,8,14,0.65)] animate-in fade-in-50 duration-200">
            {/* Specific tool parameter view */}
            {renderToolParameters(tool, parsedArgs, args)}

            {/* Execution Result */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1.5 px-0.5">
                <span>执行输出 (Output)</span>
                {result && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyText(result);
                    }}
                    className="flex items-center gap-1 text-white/50 hover:text-white transition px-2 py-0.5 rounded-md hover:bg-white/[0.08]"
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
                <div className="flex items-center gap-2 text-white/50 py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06] font-mono text-xs">
                  <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>正在隔离容器沙箱中执行…</span>
                </div>
              ) : (
                <pre className="font-mono text-slate-200 bg-[rgba(4,6,12,0.85)] p-3 rounded-xl border border-white/[0.08] overflow-x-auto text-[11px] leading-relaxed max-h-72 whitespace-pre-wrap shadow-inner">
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
    case "exec_command":
      return {
        icon: "terminal",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.command === "string"
            ? args.command
            : typeof args.cmd === "string"
              ? args.cmd
              : "",
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
    case "apply_patch":
      return {
        icon: "edit_document",
        bgColor: "bg-cyan-500/10",
        textColor: "text-cyan-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.path === "string"
            ? args.path
            : typeof args.patch === "string"
              ? "patch"
              : "",
      };
    case "list_directory":
    case "list_dir":
    case "list_files":
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
              : typeof args.glob === "string"
                ? args.glob
                : "",
      };
    case "grep_search":
    case "search_text":
      return {
        icon: "search",
        bgColor: "bg-purple-500/10",
        textColor: "text-purple-400",
        summary: (args: Record<string, unknown>) => {
          const q =
            typeof args.query === "string"
              ? args.query
              : typeof args.pattern === "string"
                ? args.pattern
                : typeof args.regex === "string"
                  ? args.regex
                  : "";
          return q ? `"${q}"` : "";
        },
      };
    case "git_status":
    case "git_diff":
    case "git_log":
    case "git_show":
    case "git_blame":
      return {
        icon: "commit",
        bgColor: "bg-orange-500/10",
        textColor: "text-orange-400",
        summary: (args: Record<string, unknown>) =>
          typeof args.path === "string"
            ? args.path
            : typeof args.ref === "string"
              ? args.ref
              : "",
      };
    case "list_skills":
      return {
        icon: "auto_awesome_motion",
        bgColor: "bg-violet-500/10",
        textColor: "text-violet-300",
        summary: () => "catalog",
      };
    case "load_skill":
      return {
        icon: "auto_awesome",
        bgColor: "bg-fuchsia-500/10",
        textColor: "text-fuchsia-300",
        summary: (args: Record<string, unknown>) =>
          typeof args.name === "string" ? args.name : "",
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
  if (
    (tool === "bash" || tool === "exec_command" || tool === "exec" || tool === "run_command") &&
    (typeof args.command === "string" || typeof args.cmd === "string")
  ) {
    const cmd = typeof args.command === "string" ? args.command : String(args.cmd);
    return (
      <div>
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1 px-0.5">
          执行指令
        </div>
        <div className="flex items-center gap-2 bg-[#05060a] px-3 py-2 rounded-lg border border-slate-800/80 font-mono text-emerald-400 text-xs">
          <span className="text-slate-600 select-none">$</span>
          <span className="text-slate-200">{cmd}</span>
        </div>
      </div>
    );
  }

  if (tool === "load_skill" && typeof args.name === "string") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">加载技能:</span>
        <span className="font-mono text-fuchsia-300 font-medium">{args.name}</span>
      </div>
    );
  }

  if (tool === "list_skills") {
    return (
      <div className="text-xs text-slate-400">列出可用 SKILL.md 技能包目录</div>
    );
  }

  if ((tool === "edit_file" || tool === "apply_patch") && typeof args.path === "string") {
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
