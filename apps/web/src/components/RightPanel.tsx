import type { ReactNode } from "react";
import type { Project, RuntimeStatus } from "@/lib/api";

type Props = {
  project: Project | null;
  runtime: RuntimeStatus | null;
  modelLabel: string;
};

export function RightPanel({ project, runtime, modelLabel }: Props) {
  return (
    <aside className="w-[300px] shrink-0 border-l border-white/10 bg-[rgba(19,19,19,0.35)] backdrop-blur-md p-5 overflow-y-auto flex flex-col space-y-6">
      <div className="flex items-center gap-2 text-[var(--accent)]">
        <span className="material-symbols-outlined text-lg">visibility</span>
        <span className="text-[11px] uppercase tracking-wider font-medium">工作区</span>
      </div>

      {/* runtime status */}
      <section>
        <h2 className="text-sm font-semibold mb-3">状态</h2>
        <div className="glass-pane p-3.5 space-y-2.5 text-xs">
          <Row label="状态" value={<StatusBadge runtime={runtime} />} />
          <Row label="容器" value={runtime?.containerName || "—"} mono />
          <Row label="MCP" value={runtime?.mcpReady ? "ready" : "—"} />
          <Row
            label="最近活动"
            value={
              runtime?.lastActiveAt
                ? new Date(runtime.lastActiveAt).toLocaleString()
                : "—"
            }
          />
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* project */}
      <section>
        <h2 className="text-sm font-semibold mb-3">项目</h2>
        <div className="glass-pane p-3.5 space-y-2.5 text-xs">
          <Row label="名称" value={project?.name || "—"} />
          <Row label="slug" value={project?.slug || "—"} mono />
          <Row label="路径" value={project?.diskPath || "—"} mono />
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* model */}
      <section>
        <h2 className="text-sm font-semibold mb-3">模型</h2>
        <div className="glass-pane p-3.5">
          <span className="chip">
            <span className="material-symbols-outlined text-[14px]">smart_toy</span>
            {modelLabel}
          </span>
          <p className="text-xs muted leading-5 mt-2.5">
            OpenAI 兼容渠道，可在「管理」页配置；对话会携带项目 slug，工具按项目根隔离。
          </p>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* note */}
      <section>
        <h2 className="text-sm font-semibold mb-3">说明</h2>
        <div className="glass-pane p-3.5 space-y-2 text-xs muted leading-5">
          <p>每位用户一个 coding-tools 容器；多个项目共享该容器，在进程内按 slug 隔离。</p>
          <p>新建项目无需重启容器，目录出现在 /projects/&#123;slug&#125; 即可懒加载 Runtime。</p>
        </div>
      </section>
    </aside>
  );
}

function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="muted shrink-0">{label}</span>
      <span className={`text-right break-all ${mono ? "tool-result" : ""}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ runtime }: { runtime: RuntimeStatus | null }) {
  if (!runtime) return <span className="badge">—</span>;
  if (runtime.status === "running" && runtime.mcpReady)
    return <span className="badge ok">running</span>;
  if (runtime.status === "running") return <span className="badge run">running</span>;
  if (runtime.status === "error") return <span className="badge err">error</span>;
  if (runtime.status === "starting") return <span className="badge run">starting</span>;
  return <span className="badge">stopped</span>;
}
