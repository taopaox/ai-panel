export const SIDEBAR_WIDTH_EXPANDED = 192;
export const SIDEBAR_WIDTH_RAIL = 80;
export const TAB_BAR_HEIGHT = 96;
export const SPLITTER_WIDTH = 8;
export const MAX_TABS_PER_SERVICE = 8;
export const MAX_PANES = 3;
export const MIN_PANE_WIDTH = 200;
export const MAX_SAVED_LAYOUTS = 12;
export const MAX_LAYOUT_NAME = 40;
export const MAX_LOGO_BYTES = 200 * 1024;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.1;

export type ThemeMode = "light" | "dark" | "system";
export type OverlayKind = "none" | "manage" | "settings";

export interface AiService {
  id: string;
  name: string;
  url: string;
  builtin: boolean;
  color: string;
  /** Cherry Studio 小程序同款品牌图标 id，对应 `src/assets/icons/{logo}.svg`。 */
  logo?: string;
  /** 自定义上传图标（data URL）。 */
  logoSrc?: string;
}

export const CATALOG_SERVICES: AiService[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    builtin: true,
    color: "#10a37f",
    logo: "openai",
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    builtin: true,
    color: "#4285f4",
    logo: "gemini",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    builtin: true,
    color: "#d97757",
    logo: "claude",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com",
    builtin: true,
    color: "#4d6bfe",
    logo: "deepseek",
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com",
    builtin: true,
    color: "#e8e8e8",
    logo: "grok",
  },
  {
    id: "kimi",
    name: "Kimi",
    url: "https://kimi.moonshot.cn/",
    builtin: true,
    color: "#000000",
    logo: "moonshot",
  },
  {
    id: "qwen",
    name: "通义千问",
    url: "https://www.qianwen.com",
    builtin: true,
    color: "#615ced",
    logo: "qwen",
  },
  {
    id: "qwenchat",
    name: "Qwen Chat",
    url: "https://chat.qwen.ai",
    builtin: true,
    color: "#615ced",
    logo: "qwen",
  },
  {
    id: "doubao",
    name: "豆包",
    url: "https://www.doubao.com/chat/",
    builtin: true,
    color: "#2a6ee9",
    logo: "doubao",
  },
  {
    id: "yuanbao",
    name: "腾讯元宝",
    url: "https://yuanbao.tencent.com/chat",
    builtin: true,
    color: "#07c160",
    logo: "yuanbao",
  },
  {
    id: "zhipu",
    name: "智谱清言",
    url: "https://chatglm.cn/main/alltoolsdetail",
    builtin: true,
    color: "#3859ff",
    logo: "zhipu",
  },
  {
    id: "wenxin",
    name: "文心一言",
    url: "https://yiyan.baidu.com/",
    builtin: true,
    color: "#2932e1",
    logo: "wenxin",
  },
  {
    id: "baidu",
    name: "百度 AI 搜",
    url: "https://chat.baidu.com/",
    builtin: true,
    color: "#2932e1",
    logo: "baidu",
  },
  {
    id: "xinghuo",
    name: "讯飞星火",
    url: "https://xinghuo.xfyun.cn/desk",
    builtin: true,
    color: "#1e6fff",
    logo: "xinghuo",
  },
  {
    id: "metaso",
    name: "秘塔",
    url: "https://metaso.cn/",
    builtin: true,
    color: "#1f1f1f",
    logo: "metaso",
  },
  {
    id: "tiangong",
    name: "天工",
    url: "https://www.tiangong.cn/",
    builtin: true,
    color: "#0057ff",
    logo: "tng",
  },
  {
    id: "zhida",
    name: "知乎直答",
    url: "https://zhida.zhihu.com/",
    builtin: true,
    color: "#0066ff",
    logo: "zhida",
  },
  {
    id: "wps",
    name: "WPS AI",
    url: "https://copilot.wps.cn/",
    builtin: true,
    color: "#d81e06",
    logo: "lingxi",
  },
  {
    id: "ima",
    name: "ima",
    url: "https://ima.qq.com/",
    builtin: true,
    color: "#07c160",
    logo: "ima",
  },
  {
    id: "cici",
    name: "Cici",
    url: "https://www.cici.com/chat/",
    builtin: true,
    color: "#000000",
    logo: "bytedance",
  },
  {
    id: "hailuo",
    name: "海螺",
    url: "https://hailuoai.com/",
    builtin: true,
    color: "#ff6a00",
    logo: "hailuo",
  },
  {
    id: "minimax",
    name: "Minimax",
    url: "https://agent.minimaxi.com/",
    builtin: true,
    color: "#f23f3d",
    logo: "minimax",
  },
  {
    id: "longcat",
    name: "LongCat",
    url: "https://longcat.chat/",
    builtin: true,
    color: "#111111",
    logo: "longcat",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    builtin: true,
    color: "#20808d",
    logo: "perplexity",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    url: "https://github.com/copilot",
    builtin: true,
    color: "#24292f",
    logo: "github-copilot",
  },
  {
    id: "notebooklm",
    name: "NotebookLM",
    url: "https://notebooklm.google.com/",
    builtin: true,
    color: "#1a73e8",
    logo: "notebooklm",
  },
  {
    id: "aistudio",
    name: "AI Studio",
    url: "https://aistudio.google.com/",
    builtin: true,
    color: "#4285f4",
    logo: "ai-studio",
  },
  {
    id: "google",
    name: "Google",
    url: "https://google.com/",
    builtin: true,
    color: "#4285f4",
    logo: "google",
  },
  {
    id: "lechat",
    name: "Le Chat",
    url: "https://chat.mistral.ai/chat",
    builtin: true,
    color: "#ff7000",
    logo: "mistral",
  },
  {
    id: "huggingchat",
    name: "HuggingChat",
    url: "https://huggingface.co/chat/",
    builtin: true,
    color: "#ffd21e",
    logo: "huggingface",
  },
  {
    id: "poe",
    name: "Poe",
    url: "https://poe.com",
    builtin: true,
    color: "#5b4bff",
    logo: "poe",
  },
  {
    id: "duckduckgo",
    name: "DuckDuckGo",
    url: "https://duck.ai",
    builtin: true,
    color: "#de5833",
    logo: "duck",
  },
  {
    id: "you",
    name: "You",
    url: "https://you.com/",
    builtin: true,
    color: "#6b4aff",
    logo: "you",
  },
  {
    id: "zai",
    name: "Z.ai",
    url: "https://chat.z.ai/",
    builtin: true,
    color: "#111111",
    logo: "z-ai",
  },
  {
    id: "coze",
    name: "Coze",
    url: "https://www.coze.com/space",
    builtin: true,
    color: "#4d53e8",
    logo: "coze",
  },
  {
    id: "dify",
    name: "Dify",
    url: "https://cloud.dify.ai/apps",
    builtin: true,
    color: "#155eef",
    logo: "dify",
  },
  {
    id: "flowith",
    name: "Flowith",
    url: "https://www.flowith.io/",
    builtin: true,
    color: "#111111",
    logo: "flowith",
  },
  {
    id: "genspark",
    name: "Genspark",
    url: "https://www.genspark.ai/",
    builtin: true,
    color: "#111111",
    logo: "genspark",
  },
  {
    id: "bolt",
    name: "bolt",
    url: "https://bolt.new/",
    builtin: true,
    color: "#111111",
    logo: "bolt-new",
  },
  {
    id: "devv",
    name: "DEVV_",
    url: "https://devv.ai/",
    builtin: true,
    color: "#111111",
    logo: "devv",
  },
  {
    id: "lambda",
    name: "Lambda Chat",
    url: "https://lambda.chat/",
    builtin: true,
    color: "#7c3aed",
    logo: "lambda",
  },
  {
    id: "grok-x",
    name: "Grok / X",
    url: "https://x.com/i/grok",
    builtin: true,
    color: "#000000",
    logo: "twitter",
  },
];

export const DEFAULT_ENABLED_IDS: string[] = [
  "chatgpt",
  "gemini",
  "claude",
  "deepseek",
  "grok",
];

export const DEFAULT_SERVICES: AiService[] = DEFAULT_ENABLED_IDS.map((id) => {
  const service = CATALOG_SERVICES.find((item) => item.id === id);
  if (!service) {
    throw new Error(`缺少默认服务 ${id}`);
  }
  return service;
});

export type NavAction = "back" | "forward" | "reload" | "stop";

export interface HistoryState {
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface ContentPagePayload extends HistoryState {
  label: string;
  title: string;
  url: string;
  loading?: boolean;
  focused?: boolean;
}

export interface OpenTabPayload {
  openerLabel: string;
  url: string;
  navigate?: boolean;
}

export interface ContentTab {
  label: string;
  title: string;
  url: string;
  closable: boolean;
  openerLabel?: string;
}

export interface WorkspacePane {
  id: string;
  serviceId: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  serviceIds: string[];
  ratios: number[];
  locked: boolean;
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

export function createPaneId(): string {
  return `p-${randomLetters(6)}`;
}

export function createLayoutId(): string {
  return `layout-${randomLetters(8)}`;
}

export function layoutNameFromIds(
  ids: string[],
  services: AiService[],
): string {
  return ids
    .map((id) => services.find((service) => service.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(" · ");
}

export function sanitizeLayoutName(raw: string, fallback: string): string {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LAYOUT_NAME);
  return name || fallback;
}

export function nextLayoutName(
  currentName: string,
  previousIds: string[],
  nextIds: string[],
  services: AiService[],
): string {
  const trimmed = currentName.trim();
  const previousAuto = layoutNameFromIds(previousIds, services);
  if (trimmed && trimmed !== previousAuto) {
    return sanitizeLayoutName(trimmed, trimmed);
  }
  return layoutNameFromIds(nextIds, services) || trimmed;
}

export function sameServiceIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function normalizeSavedLayouts(
  layouts: SavedLayout[],
  availableIds: Set<string>,
): SavedLayout[] {
  const result: SavedLayout[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  for (const layout of layouts) {
    if (
      !layout.id.startsWith("layout-") ||
      seenIds.has(layout.id) ||
      result.length >= MAX_SAVED_LAYOUTS
    ) {
      continue;
    }

    const serviceIds: string[] = [];
    for (const id of layout.serviceIds) {
      if (
        availableIds.has(id) &&
        !serviceIds.includes(id) &&
        serviceIds.length < MAX_PANES
      ) {
        serviceIds.push(id);
      }
    }
    if (serviceIds.length < 2) {
      continue;
    }

    const key = serviceIds.join("|");
    if (seenKeys.has(key)) {
      continue;
    }

    seenIds.add(layout.id);
    seenKeys.add(key);
    result.push({
      id: layout.id,
      name: layout.name.trim() || serviceIds.join(" · "),
      serviceIds,
      ratios: Array.isArray(layout.ratios) ? layout.ratios : [],
      locked: Boolean(layout.locked),
    });
  }

  return result;
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

export function catalogServiceById(id: string): AiService | undefined {
  return CATALOG_SERVICES.find((service) => service.id === id);
}

export function normalizeEnabledIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (seen.has(id) || !catalogServiceById(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  return next;
}

export function composeServices(
  enabledIds: string[],
  customServices: AiService[],
  order: string[] = [],
): AiService[] {
  const catalogItems = normalizeEnabledIds(enabledIds)
    .map((id) => catalogServiceById(id))
    .filter((service): service is AiService => Boolean(service));
  const custom = customServices.filter((service) => !service.builtin);
  const combined = [...catalogItems, ...custom];
  const list = combined.length > 0 ? combined : [...DEFAULT_SERVICES];
  if (order.length === 0) {
    return list;
  }

  const byId = new Map(list.map((service) => [service.id, service]));
  const result: AiService[] = [];
  for (const id of order) {
    const service = byId.get(id);
    if (service) {
      result.push(service);
      byId.delete(id);
    }
  }
  for (const service of list) {
    if (byId.has(service.id)) {
      result.push(service);
    }
  }
  return result;
}

export function normalizeServiceOrder(
  order: string[],
  availableIds: Iterable<string>,
): string[] {
  const available = new Set(availableIds);
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of order) {
    if (!available.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    next.push(id);
  }
  for (const id of available) {
    if (!seen.has(id)) {
      next.push(id);
    }
  }
  return next;
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const rounded = Math.round(value * 10) / 10;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

export function readLogoFile(file: File): Promise<string> {
  if (file.size > MAX_LOGO_BYTES) {
    return Promise.reject(new Error("图标需小于 200KB"));
  }
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请选择图片文件"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取图标"));
    };
    reader.onerror = () => {
      reject(new Error("无法读取图标"));
    };
    reader.readAsDataURL(file);
  });
}
