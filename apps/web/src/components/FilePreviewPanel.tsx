"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api, GitDiffResult } from "@/lib/api";

// Dynamically import Monaco Editor and DiffEditor for zero-burden initial page load
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-500 gap-2">
        <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span>加载编辑器中…</span>
      </div>
    ),
  },
);

const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-500 gap-2">
        <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <span>加载 Diff 对比器中…</span>
      </div>
    ),
  },
);

type Props = {
  projectId: number | null;
  filePath: string | null;
  mode: "preview" | "diff";
  isOpen: boolean;
  onClose: () => void;
};

export function FilePreviewPanel({
  projectId,
  filePath,
  mode,
  isOpen,
  onClose,
}: Props) {
  const [content, setContent] = useState("");
  const [diffData, setDiffData] = useState<GitDiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  useEffect(() => {
    if (!isOpen || !projectId || !filePath) {
      setContent("");
      setDiffData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    if (mode === "preview") {
      api
        .readProjectFile(projectId, filePath)
        .then((res) => {
          if (!isMounted) return;
          setContent(res.content);
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message || String(err));
          setLoading(false);
        });
    } else {
      // Git Diff mode
      api
        .getProjectGitDiff(projectId, filePath)
        .then((res) => {
          if (!isMounted) return;
          setDiffData(res);
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err.message || String(err));
          setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [projectId, filePath, mode, isOpen]);

  if (!isOpen || !filePath) return null;

  function copyCode() {
    const textToCopy = mode === "preview" ? content : diffData?.newContent || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const language = detectLanguage(filePath);

  return (
    <aside
      className={`border-l border-slate-800/80 bg-[#0c0e16] flex flex-col h-full z-30 select-none transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-[#0c0e16]"
          : "w-[480px] lg:w-[600px] xl:w-[720px] shrink-0"
      }`}
    >
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800/80 shrink-0 bg-[#0f111a]">
        {/* Left: Breadcrumbs and mode badge */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`material-symbols-outlined text-[18px] ${
              mode === "preview" ? "text-cyan-400" : "text-purple-400"
            }`}
          >
            {mode === "preview" ? "description" : "compare"}
          </span>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs font-semibold text-slate-200 truncate">
              {filePath}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.2 rounded-full font-medium shrink-0 ${
                mode === "preview"
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
              }`}
            >
              {mode === "preview" ? language : "Git Diff"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {mode === "diff" && (
            <button
              onClick={() => setRenderSideBySide(!renderSideBySide)}
              className="px-2 py-1 rounded-lg text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition border border-slate-800"
              title={renderSideBySide ? "切换为行内对比 (Inline)" : "切换为双栏对比 (Split)"}
            >
              {renderSideBySide ? "Split" : "Inline"}
            </button>
          )}

          <button
            onClick={copyCode}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            title="复制代码"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? "check" : "content_copy"}
            </span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            title={isFullscreen ? "退出全屏" : "全屏预览"}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="关闭预览"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-[#1e1e1e]">
        {error ? (
          <div className="p-4 m-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
            {error}
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-400 gap-2">
            <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>正在读取文件内容…</span>
          </div>
        ) : mode === "preview" ? (
          <MonacoEditor
            height="100%"
            language={language}
            value={content}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              automaticLayout: true,
              lineNumbers: "on",
              renderLineHighlight: "all",
            }}
          />
        ) : (
          <MonacoDiffEditor
            height="100%"
            language={language}
            original={diffData?.oldContent || ""}
            modified={diffData?.newContent || ""}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: renderSideBySide,
              minimap: { enabled: true },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', Consolas, Monaco, monospace",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              lineNumbers: "on",
            }}
          />
        )}
      </div>
    </aside>
  );
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    case "py":
      return "python";
    case "go":
      return "go";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "html":
      return "html";
    case "css":
    case "scss":
      return "css";
    case "sh":
    case "bash":
      return "shell";
    case "yaml":
    case "yml":
      return "yaml";
    case "sql":
      return "sql";
    case "dockerfile":
      return "dockerfile";
    default:
      if (filePath.toLowerCase().endsWith("dockerfile")) return "dockerfile";
      return "plaintext";
  }
}
