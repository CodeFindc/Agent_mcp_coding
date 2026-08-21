"use client";

import { useRef, useState, useEffect } from "react";
import { ChatInput } from "./ChatInput"; // Reuse existing input logic for skills, streaming, etc.

type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  modelLabel: string;
  skills?: any[]; // SkillMeta
  onAttach?: () => void;
  onModelChange?: () => void;
};

export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  busy,
  placeholder,
  modelLabel,
  skills = [],
  onAttach,
  onModelChange,
}: ComposerProps) {
  const [showAttachments, setShowAttachments] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  // Reuse ChatInput but wrap it in a nicer composer wrapper with LiveAgent style
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-6 pt-4 border-t border-white/[0.06] bg-[rgba(10,13,22,0.85)] backdrop-blur-2xl">
      <div className="relative">
        <ChatInput
          value={value}
          onChange={onChange}
          onSend={onSend}
          disabled={disabled}
          busy={busy}
          placeholder={placeholder || "在项目中提问，或输入 /skill..."}
          modelLabel={modelLabel}
          skills={skills}
        />
        
        {/* LiveAgent-style attachment button (top right of input) */}
        <button
          onClick={() => {
            setShowAttachments(!showAttachments);
            onAttach?.();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl hover:bg-white/[0.05] transition-all duration-200"
        >
          <span className="material-symbols-outlined text-[20px] text-white/70">attach_file</span>
        </button>

        {/* Model switcher pill (top right, visible when composing) */}
        {isComposing && (
          <button
            onClick={onModelChange}
            className="absolute top-4 right-24 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-white/80 hover:bg-white/[0.08] transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[13px]">swap_horiz</span>
            {modelLabel}
          </button>
        )}
      </div>

      {/* Optional LiveAgent-style attachments preview area */}
      {showAttachments && (
        <div className="mt-3 p-3 rounded-2xl glass-card border border-white/[0.08]">
          <div className="text-xs text-white/50 mb-2 font-mono">📎 附件</div>
          <div className="flex gap-2 text-[10px] text-white/60">
            <div className="bg-white/[0.06] px-3 py-1.5 rounded-xl">file1.txt</div>
            <div className="bg-white/[0.06] px-3 py-1.5 rounded-xl">image2.png</div>
          </div>
        </div>
      )}
    </div>
  );
}