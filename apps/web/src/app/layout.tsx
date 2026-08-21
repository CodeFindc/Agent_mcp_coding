import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coding Agent Platform · macOS Workspace",
  description: "Per-user coding workspaces powered by coding-tools-mcp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#06070a" />
      </head>
      <body className="antialiased selection:bg-blue-500/30 selection:text-white">{children}</body>
    </html>
  );
}
