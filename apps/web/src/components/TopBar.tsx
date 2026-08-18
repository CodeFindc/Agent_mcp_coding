import Link from "next/link";
import type { RuntimeStatus, User } from "@/lib/api";

type Props = {
  projectName?: string;
  projectSlug?: string;
  runtime: RuntimeStatus | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  isAdmin: boolean;
  user: User;
};

export function TopBar({
  projectName,
  projectSlug,
  runtime,
  busy,
  onStart,
  onStop,
  isAdmin,
  user,
}: Props) {
  const running = runtime?.status === "running";
  return (
    <header className="h-[52px] shrink-0 flex items-center justify-between px-5 bg-[rgba(19,19,19,0.8)] backdrop-blur-[20px] border-b border-white/5">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs muted min-w-0">
        <span className="material-symbols-outlined text-[16px]">folder</span>
        <span className="truncate max-w-[180px]">{projectName || "未选择项目"}</span>
        <span className="material-symbols-outlined text-[16px] opacity-60">chevron_right</span>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[var(--text)]">
          <span className="material-symbols-outlined text-[12px]">commit</span>
          {projectSlug || "—"}
        </span>
        {runtime ? <RuntimeBadge runtime={runtime} /> : null}
      </div>

      {/* actions */}
      <div className="flex items-center gap-2">
        <button className="btn" disabled={busy || !running} onClick={onStart}>
          启动工作区
        </button>
        <button className="btn btn-danger" disabled={busy || !running} onClick={onStop}>
          停止
        </button>
        <div className="w-px h-4 bg-white/10 mx-2" />
        {isAdmin ? (
          <Link className="btn" href="/admin">
            管理
          </Link>
        ) : null}
        <span className="avatar ml-1">{user.name?.slice(0, 1) || user.email?.slice(0, 1) || "U"}</span>
      </div>
    </header>
  );
}

function RuntimeBadge({ runtime }: { runtime: RuntimeStatus }) {
  if (runtime.status === "running" && runtime.mcpReady)
    return <span className="badge ok">MCP ready</span>;
  if (runtime.status === "running") return <span className="badge run">running</span>;
  if (runtime.status === "error") return <span className="badge err">error</span>;
  if (runtime.status === "starting") return <span className="badge run">starting</span>;
  return <span className="badge">stopped</span>;
}
