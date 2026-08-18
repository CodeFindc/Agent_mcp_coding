export type UiMsg =
  | { kind: "user" | "assistant"; content: string }
  | { kind: "tool"; tool: string; args?: string; result?: string };

export function MessageBubble({ msg }: { msg: UiMsg }) {
  if (msg.kind === "tool") {
    return (
      <div className="glass-pane px-4 py-3 text-sm">
        <div className="font-medium text-[var(--accent-2)] flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">terminal</span>
          {msg.tool}
        </div>
        {msg.args ? <pre className="mt-2 text-xs muted overflow-auto">{msg.args}</pre> : null}
        {msg.result !== undefined ? (
          <pre className="tool-result mt-2 text-xs overflow-auto max-h-64 prose-chat">
            {msg.result}
          </pre>
        ) : (
          <div className="muted text-xs mt-2">执行中…</div>
        )}
      </div>
    );
  }

  const mine = msg.kind === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          mine
            ? "bg-[rgba(75,142,255,0.22)] border border-[rgba(173,198,255,0.25)]"
            : "glass-pane"
        }`}
      >
        <div className="text-[11px] muted mb-1">{mine ? "你" : "助手"}</div>
        <div className="prose-chat">{msg.content}</div>
      </div>
    </div>
  );
}
