import { FormEvent } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  modelLabel: string;
};

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  placeholder,
  modelLabel,
}: Props) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSend();
  }

  return (
    <form onSubmit={submit} className="p-4">
      <div className="bg-black/40 border border-white/10 rounded-2xl p-3 flex flex-col shadow-lg">
        <textarea
          className="bg-transparent border-none resize-none text-sm text-[var(--text)] focus:outline-none w-full min-h-[56px] max-h-40"
          placeholder={placeholder || "输入消息…"}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between mt-2 border-t border-white/5 pt-2">
          <div className="flex gap-1">
            <button
              type="button"
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 rounded transition"
            >
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
            <button
              type="button"
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] hover:bg-white/5 rounded transition"
            >
              <span className="material-symbols-outlined text-sm">motion_photos_on</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip">
              {modelLabel}
              <span className="material-symbols-outlined text-[12px]">expand_more</span>
            </span>
            <button
              type="submit"
              disabled={disabled || busy || !value.trim()}
              className="w-8 h-8 rounded-full bg-[rgba(75,142,255,0.25)] text-[var(--accent)] hover:bg-[rgba(75,142,255,0.4)] flex items-center justify-center transition disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
