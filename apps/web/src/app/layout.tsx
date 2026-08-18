import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coding Agent Platform",
  description: "Per-user coding workspaces powered by coding-tools-mcp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
