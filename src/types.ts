export const SIDEBAR_WIDTH = 240;
export const TAB_BAR_HEIGHT = 40;
export const MAX_TABS_PER_SERVICE = 8;

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

export type NavAction = "back" | "forward" | "reload";

export interface HistoryState {
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ContentPagePayload extends HistoryState {
  label: string;
  title: string;
  url: string;
}

export interface OpenTabPayload {
  openerLabel: string;
  url: string;
}

export interface ContentTab {
  label: string;
  title: string;
  url: string;
  closable: boolean;
}

function randomLetters(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export function webviewLabel(serviceId: string): string {
  return `wv-${serviceId}`;
}

export function extraTabLabel(serviceId: string): string {
  return `${webviewLabel(serviceId)}-t-${randomLetters(8)}`;
}

export function serviceIdFromWebviewLabel(label: string): string {
  if (!label.startsWith("wv-")) {
    return "";
  }
  const rest = label.slice(3);
  const marker = "-t-";
  const index = rest.lastIndexOf(marker);
  if (index > 0) {
    return rest.slice(0, index);
  }
  return rest;
}

export function createCustomServiceId(): string {
  return `custom-${randomLetters(10)}`;
}

export function titleFromUrl(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || fallback;
  } catch {
    return fallback;
  }
}

export function samePageUrl(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return `${a.origin}${a.pathname}` === `${b.origin}${b.pathname}`;
  } catch {
    return left === right;
  }
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
