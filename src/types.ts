export const SIDEBAR_WIDTH = 240;

export interface AiService {
  id: string;
  name: string;
  url: string;
  builtin: boolean;
  color: string;
}

export const DEFAULT_SERVICES: AiService[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    builtin: true,
    color: "#10a37f",
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    builtin: true,
    color: "#4285f4",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    builtin: true,
    color: "#d97757",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    builtin: true,
    color: "#4d6bfe",
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    builtin: true,
    color: "#e8e8e8",
  },
];

export function webviewLabel(serviceId: string): string {
  return `wv-${serviceId}`;
}

export function createCustomServiceId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from(
    { length: 10 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
  return `custom-${suffix}`;
}

export function normalizeServiceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("请输入网址");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("只支持 http 或 https 网址");
  }

  return parsed.toString();
}
