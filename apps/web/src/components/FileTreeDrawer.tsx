"use client";

import { useEffect, useState, useMemo } from "react";
import { api, FileNode, GitStatusInfo } from "@/lib/api";

type Props = {
  projectId: number | null;
  projectName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (path: string) => void;
  onSelectDiff: (path: string) => void;
  selectedFilePath?: string | null;
};

export function FileTreeDrawer({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSelectFile,
  onSelectDiff,
  selectedFilePath,
}: Props) {
  const [activeTab, setActiveTab] = useState<"files" | "git">("files");
  const [files, setFiles] = useState<FileNode[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    setLoading(true);
    setError("");

    Promise.all([
      api.listProjectFiles(projectId).catch((err) => {
        if (isMounted) setError(err.message || String(err));
        return [] as FileNode[];
      }),
      api.getProjectGitStatus(projectId).catch(() => null),
    ]).then(([fileTree, git]) => {
      if (!isMounted) return;
      setFiles(fileTree || []);
      setGitStatus(git);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [projectId, isOpen]);

  async function refresh() {
    if (!projectId) return;
    setLoading(true);
    setError("");
    try {
      const [fileTree, git] = await Promise.all([
        api.listProjectFiles(projectId),
        api.getProjectGitStatus(projectId),
      ]);
      setFiles(fileTree);
      setGitStatus(git);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase().trim();
    function filterNode(node: FileNode): FileNode | null {
      if (!node.isDir) {
        return node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)
          ? node
          : null;
      }
      const matchedChildren: FileNode[] = [];
      for (const child of node.children || []) {
        const res = filterNode(child);
        if (res) matchedChildren.push(res);
      }
      if (matchedChildren.length > 0 || node.name.toLowerCase().includes(q)) {
        return { ...node, children: matchedChildren };
      }
      return null;
    }
    return files.map(filterNode).filter(Boolean) as FileNode[];
  }, [files, searchQuery]);

  if (!isOpen) return null;

  const changeCount = gitStatus?.changes?.length || 0;

  return (
    <aside className="w-72 shrink-0 border-r border-slate-800/80 bg-[#0c0e16] flex flex-col h-full z-25 select-none animate-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[18px] text-cyan-400">folder_open</span>
          <span className="font-semibold text-xs text-slate-200 truncate">
            {projectName || "项目文件"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            title="刷新目录"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                loading ? "animate-spin text-cyan-400" : ""
              }`}
            >
              refresh
            </span>
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
            title="收起目录"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/60 px-2 py-1.5 gap-1 shrink-0 bg-slate-950/40">
        <button
          onClick={() => setActiveTab("files")}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            activeTab === "files"
              ? "bg-slate-800 text-slate-100 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">account_tree</span>
          <span>文件树</span>
        </button>

        <button
          onClick={() => setActiveTab("git")}
          className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
            activeTab === "git"
              ? "bg-slate-800 text-slate-100 shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">history</span>
          <span>Git 变更</span>
          {changeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-400 font-bold">
              {changeCount}
            </span>
          )}
        </button>
      </div>

      {/* Search Input in Files Tab */}
      {activeTab === "files" && (
        <div className="p-2 border-b border-slate-800/40 shrink-0">
          <div className="relative">
            <span className="material-symbols-outlined text-[14px] text-slate-500 absolute left-2.5 top-2">
              search
            </span>
            <input
              type="text"
              placeholder="搜索文件名…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#07080d] border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 placeholder-slate-500"
            />
          </div>
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {error && (
          <div className="p-2 text-xs text-rose-400 bg-rose-500/10 rounded-lg mb-2">
            {error}
          </div>
        )}

        {loading && !files.length ? (
          <div className="flex items-center justify-center py-8 text-xs text-slate-500 gap-2">
            <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>加载目录中…</span>
          </div>
        ) : activeTab === "files" ? (
          filteredFiles.length > 0 ? (
            <div className="space-y-0.5">
              {filteredFiles.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  onSelectFile={onSelectFile}
                  selectedPath={selectedFilePath}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              {searchQuery ? "未找到匹配文件" : "目录为空"}
            </div>
          )
        ) : (
          /* Git Status Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-purple-400">commit</span>
                <span>当前分支:</span>
              </span>
              <span className="font-mono text-purple-300 font-medium">{gitStatus?.branch || "main"}</span>
            </div>

            {gitStatus?.changes && gitStatus.changes.length > 0 ? (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400 px-2 tracking-wider uppercase">
                  变更文件 ({gitStatus.changes.length})
                </div>
                {gitStatus.changes.map((c) => (
                  <button
                    key={c.path}
                    onClick={() => onSelectDiff(c.path)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-slate-800/80 transition group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[15px] text-slate-500 group-hover:text-slate-300">
                        description
                      </span>
                      <span className="truncate text-slate-200 group-hover:text-white font-mono text-[11px]">
                        {c.path}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        c.status === "M"
                          ? "bg-amber-500/20 text-amber-400"
                          : c.status === "A" || c.status === "?"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-[24px] text-emerald-400/60">
                  check_circle
                </span>
                <span>工作区很干净，无待提交变更</span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function TreeNode({
  node,
  depth,
  onSelectFile,
  selectedPath,
}: {
  node: FileNode;
  depth: number;
  onSelectFile: (path: string) => void;
  selectedPath?: string | null;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  const isSelected = selectedPath === node.path;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="w-full text-left py-1 pr-2 rounded-lg text-xs flex items-center gap-1.5 text-slate-300 hover:bg-slate-800/60 hover:text-white transition group"
        >
          <span className="material-symbols-outlined text-[14px] text-slate-500 group-hover:text-slate-400">
            {expanded ? "expand_more" : "chevron_right"}
          </span>
          <span className="material-symbols-outlined text-[15px] text-amber-400">
            {expanded ? "folder_open" : "folder"}
          </span>
          <span className="truncate font-medium">{node.name}</span>
        </button>

        {expanded && node.children && (
          <div className="space-y-0.5">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File item
  const fileIcon = getFileIcon(node.name, node.extension);

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      className={`w-full text-left py-1 pr-2 rounded-lg text-xs flex items-center justify-between transition ${
        isSelected
          ? "bg-blue-600/20 text-cyan-300 font-medium border border-blue-500/30"
          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`material-symbols-outlined text-[15px] ${fileIcon.color}`}>
          {fileIcon.icon}
        </span>
        <span className="truncate font-mono text-[11.5px]">{node.name}</span>
      </div>
      <span className="text-[10px] text-slate-400 opacity-60 font-mono ml-2 shrink-0">
        {formatSize(node.size)}
      </span>
    </button>
  );
}

function getFileIcon(name: string, ext?: string) {
  const lowerExt = (ext || "").toLowerCase();
  switch (lowerExt) {
    case "ts":
    case "tsx":
      return { icon: "code", color: "text-sky-400" };
    case "js":
    case "jsx":
      return { icon: "javascript", color: "text-amber-400" };
    case "py":
      return { icon: "terminal", color: "text-yellow-400" };
    case "go":
      return { icon: "data_object", color: "text-cyan-400" };
    case "json":
      return { icon: "data_object", color: "text-emerald-400" };
    case "md":
      return { icon: "description", color: "text-blue-300" };
    case "css":
    case "scss":
      return { icon: "palette", color: "text-pink-400" };
    case "html":
      return { icon: "html", color: "text-orange-400" };
    case "sh":
    case "bash":
      return { icon: "terminal", color: "text-green-400" };
    case "png":
    case "jpg":
    case "svg":
      return { icon: "image", color: "text-purple-400" };
    default:
      if (name.startsWith("Dockerfile")) {
        return { icon: "dns", color: "text-blue-400" };
      }
      return { icon: "draft", color: "text-slate-400" };
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
