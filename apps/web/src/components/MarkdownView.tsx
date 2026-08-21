"use client";

import { useState } from "react";

type Props = {
  content: string;
};

export function MarkdownView({ content }: Props) {
  const segments = parseMarkdownSegments(content);

  return (
    <div className="markdown-body">
      {segments.map((seg, idx) => {
        if (seg.type === "code") {
          return <CodeBlock key={idx} language={seg.lang} code={seg.raw} />;
        }
        return <FormattedText key={idx} text={seg.raw} />;
      })}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="code-block-wrapper my-3 rounded-2xl border border-white/[0.1] bg-[rgba(8,10,18,0.85)] backdrop-blur-xl overflow-hidden shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="code-block-header flex items-center justify-between px-3.5 py-2 bg-white/[0.035] border-b border-white/[0.06] select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123] inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29] inline-block" />
          </div>
          <span className="font-mono text-xs text-white/50">{language || "text"}</span>
        </div>

        <button
          onClick={copyCode}
          className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white transition px-2 py-0.5 rounded-md hover:bg-white/[0.08]"
          title="复制代码"
        >
          <span className="material-symbols-outlined text-[13px]">
            {copied ? "check" : "content_copy"}
          </span>
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre className="code-block-content p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200">{code}</pre>
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushList() {
    if (!currentList) return;
    if (currentList.type === "ul") {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-2 ml-4 list-disc space-y-1">
          {currentList.items.map((it, i) => (
            <li key={i}>{parseInline(it)}</li>
          ))}
        </ul>,
      );
    } else {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-2 ml-4 list-decimal space-y-1">
          {currentList.items.map((it, i) => (
            <li key={i}>{parseInline(it)}</li>
          ))}
        </ol>,
      );
    }
    currentList = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Header 1
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={i} className="text-lg font-bold text-slate-100 mt-3 mb-1.5">
          {parseInline(line.slice(2))}
        </h1>,
      );
      continue;
    }
    // Header 2
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={i} className="text-base font-semibold text-slate-100 mt-2.5 mb-1">
          {parseInline(line.slice(3))}
        </h2>,
      );
      continue;
    }
    // Header 3
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={i} className="text-sm font-semibold text-slate-200 mt-2 mb-1">
          {parseInline(line.slice(4))}
        </h3>,
      );
      continue;
    }

    // Bullet list
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const itemText = line.trim().slice(2);
      if (currentList && currentList.type === "ul") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ul", items: [itemText] };
      }
      continue;
    }

    // Numbered list
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      const itemText = numMatch[2];
      if (currentList && currentList.type === "ol") {
        currentList.items.push(itemText);
      } else {
        flushList();
        currentList = { type: "ol", items: [itemText] };
      }
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={i}
          className="border-l-2 border-blue-500/50 pl-3 py-1 my-2 text-slate-300 bg-blue-500/5 rounded-r"
        >
          {parseInline(line.slice(2))}
        </blockquote>,
      );
      continue;
    }

    flushList();

    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="my-1 text-slate-200 leading-relaxed">
          {parseInline(line)}
        </p>,
      );
    }
  }

  flushList();

  return <>{elements}</>;
}

function parseInline(text: string): React.ReactNode {
  // Parses inline code `code`, bold **text**, links [title](url)
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-white/10 text-sky-300 font-mono text-[11px] border border-white/5"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={match.index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

interface Segment {
  type: "text" | "code";
  lang: string;
  raw: string;
}

function parseMarkdownSegments(markdown: string): Segment[] {
  const segments: Segment[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    if (match.index > lastIdx) {
      segments.push({
        type: "text",
        lang: "",
        raw: markdown.slice(lastIdx, match.index),
      });
    }
    segments.push({
      type: "code",
      lang: match[1] || "text",
      raw: match[2].trimEnd(),
    });
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < markdown.length) {
    segments.push({
      type: "text",
      lang: "",
      raw: markdown.slice(lastIdx),
    });
  }

  return segments;
}
