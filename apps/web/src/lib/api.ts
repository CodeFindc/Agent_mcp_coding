const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

export type User = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
};

export type Project = {
  id: number;
  userId: number;
  name: string;
  slug: string;
  diskPath: string;
  createdAt: string;
};

export type RuntimeStatus = {
  userId?: number;
  projectId?: number;
  status: "stopped" | "starting" | "running" | "error";
  containerName?: string;
  lastError?: string;
  lastActiveAt?: string | null;
  mcpReady?: boolean;
};

export type RuntimeSummary = {
  running: number;
  limit: number;
  runtimes: RuntimeStatus[];
};

export type ChatThread = {
  id: number;
  projectId: number;
  title: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: number;
  threadId: number;
  role: string;
  content: string;
  toolCallsJson?: string;
  toolCallId?: string;
  name?: string;
  createdAt: string;
};

export type Provider = {
  id: number;
  name: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  hasApiKey: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  base: API_BASE,
  authConfig: () =>
    request<{ devAuthEnabled: boolean; oidcEnabled: boolean }>("/api/v1/auth/config"),
  me: () => request<User>("/api/v1/auth/me"),
  devLogin: (email: string, name: string) =>
    request<User>("/api/v1/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),
  logout: () => request<{ status: string }>("/api/v1/auth/logout", { method: "POST" }),
  listProjects: () => request<Project[]>("/api/v1/projects"),
  createProject: (name: string) =>
    request<Project>("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteProject: (id: number) =>
    request<{ status: string }>(`/api/v1/projects/${id}`, { method: "DELETE" }),
  userRuntime: () => request<RuntimeStatus>(`/api/v1/runtime`),
  startUserRuntime: () =>
    request<RuntimeStatus>(`/api/v1/runtime/start`, { method: "POST" }),
  stopUserRuntime: () =>
    request<RuntimeStatus>(`/api/v1/runtime/stop`, { method: "POST" }),
  projectRuntime: (id: number) => request<RuntimeStatus>(`/api/v1/projects/${id}/runtime`),
  startProjectRuntime: (id: number) =>
    request<RuntimeStatus>(`/api/v1/projects/${id}/runtime/start`, { method: "POST" }),
  stopProjectRuntime: (id: number) =>
    request<RuntimeStatus>(`/api/v1/projects/${id}/runtime/stop`, { method: "POST" }),
  /** @deprecated use startProjectRuntime / startUserRuntime */
  activateProject: (id: number) =>
    request<RuntimeStatus>(`/api/v1/projects/${id}/activate`, { method: "POST" }),
  listRuntimes: () => request<RuntimeSummary>("/api/v1/runtimes"),
  listThreads: (projectId: number) =>
    request<ChatThread[]>(`/api/v1/projects/${projectId}/threads`),
  createThread: (projectId: number, title?: string) =>
    request<ChatThread>(`/api/v1/projects/${projectId}/threads`, {
      method: "POST",
      body: JSON.stringify({ title: title || "New chat" }),
    }),
  listMessages: (threadId: number) =>
    request<ChatMessage[]>(`/api/v1/threads/${threadId}/messages`),
  listProviders: () => request<Provider[]>("/api/v1/admin/providers"),
  createProvider: (body: {
    name: string;
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
  }) =>
    request<Provider>("/api/v1/admin/providers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteProvider: (id: number) =>
    request<{ status: string }>(`/api/v1/admin/providers/${id}`, { method: "DELETE" }),
  platform: () => request<Record<string, unknown>>("/api/v1/admin/platform"),
  listUsers: () => request<User[]>("/api/v1/admin/users"),
};

export type ChatEvent = {
  type: string;
  content?: string;
  tool?: string;
  args?: string;
  result?: string;
  error?: string;
  threadId?: number;
  messageId?: number;
};

export async function sendChat(
  body: { threadId?: number; projectId: number; content: string },
  onEvent: (ev: ChatEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch(`${API_BASE}/api/v1/chat/send`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.replace(/^data:\s?/, "");
      try {
        onEvent(JSON.parse(data) as ChatEvent);
      } catch {
        /* ignore malformed */
      }
    }
  }
}
