import { load, type Store } from "@tauri-apps/plugin-store";
import {
  clampZoom,
  composeServices,
  DEFAULT_ENABLED_IDS,
  DEFAULT_SERVICES,
  normalizeEnabledIds,
  normalizeSavedLayouts,
  normalizeServiceOrder,
  type AiService,
  type SavedLayout,
  type ThemeMode,
} from "../types";

const STORE_FILE = "workspace.json";
const SERVICES_KEY = "services";
const LAST_ACTIVE_KEY = "lastActiveId";
const PANE_IDS_KEY = "paneServiceIds";
const PANE_RATIOS_KEY = "paneRatios";
const ENABLED_IDS_KEY = "enabledServiceIds";
const LAYOUTS_KEY = "savedLayouts";
const ACTIVE_LAYOUT_KEY = "activeLayoutId";
const PANES_LOCKED_KEY = "panesLocked";
const THEME_KEY = "theme";
const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
const SERVICE_ORDER_KEY = "serviceOrder";
const ZOOM_KEY = "zoomByService";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true });
  }
  return storePromise;
}

function parseThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

function parseZoomMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, number> = {};
  for (const [id, zoom] of Object.entries(value as Record<string, unknown>)) {
    if (typeof zoom === "number") {
      next[id] = clampZoom(zoom);
    }
  }
  return next;
}

export async function loadWorkspaceState(): Promise<{
  services: AiService[];
  customServices: AiService[];
  enabledServiceIds: string[];
  lastActiveId: string;
  paneServiceIds: string[];
  paneRatios: number[];
  savedLayouts: SavedLayout[];
  activeLayoutId: string;
  panesLocked: boolean;
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  serviceOrder: string[];
  zoomByService: Record<string, number>;
}> {
  const store = await getStore();
  const savedServices = (await store.get<AiService[]>(SERVICES_KEY)) ?? [];
  const customServices = savedServices.filter((service) => !service.builtin);
  const savedEnabled = await store.get<string[]>(ENABLED_IDS_KEY);
  const enabledServiceIds = normalizeEnabledIds(
    savedEnabled ?? DEFAULT_ENABLED_IDS,
  );
  const lastActiveId =
    (await store.get<string>(LAST_ACTIVE_KEY)) ?? DEFAULT_SERVICES[0].id;
  const paneServiceIds = (await store.get<string[]>(PANE_IDS_KEY)) ?? [];
  const paneRatios = (await store.get<number[]>(PANE_RATIOS_KEY)) ?? [];
  const savedOrder = (await store.get<string[]>(SERVICE_ORDER_KEY)) ?? [];
  const draft = composeServices(enabledServiceIds, customServices, savedOrder);
  const serviceOrder = normalizeServiceOrder(
    savedOrder.length > 0 ? savedOrder : draft.map((service) => service.id),
    draft.map((service) => service.id),
  );
  const services = composeServices(
    enabledServiceIds,
    customServices,
    serviceOrder,
  );
  const availableIds = new Set(services.map((service) => service.id));
  const savedLayouts = normalizeSavedLayouts(
    (await store.get<SavedLayout[]>(LAYOUTS_KEY)) ?? [],
    availableIds,
  );
  const savedActiveLayoutId = (await store.get<string>(ACTIVE_LAYOUT_KEY)) ?? "";
  const activeLayoutId = savedLayouts.some(
    (layout) => layout.id === savedActiveLayoutId,
  )
    ? savedActiveLayoutId
    : "";
  const panesLocked = Boolean(await store.get<boolean>(PANES_LOCKED_KEY));

  return {
    services,
    customServices,
    enabledServiceIds,
    lastActiveId,
    paneServiceIds,
    paneRatios,
    savedLayouts,
    activeLayoutId,
    panesLocked,
    theme: parseThemeMode(await store.get(THEME_KEY)),
    sidebarCollapsed: Boolean(await store.get<boolean>(SIDEBAR_COLLAPSED_KEY)),
    serviceOrder,
    zoomByService: parseZoomMap(await store.get(ZOOM_KEY)),
  };
}

export async function saveServices(services: AiService[]): Promise<void> {
  const store = await getStore();
  await store.set(
    SERVICES_KEY,
    services.filter((service) => !service.builtin),
  );
}

export async function saveEnabledServiceIds(ids: string[]): Promise<void> {
  const store = await getStore();
  await store.set(ENABLED_IDS_KEY, normalizeEnabledIds(ids));
}

export async function saveLastActiveId(id: string): Promise<void> {
  const store = await getStore();
  await store.set(LAST_ACTIVE_KEY, id);
}

export async function savePanes(
  serviceIds: string[],
  ratios: number[],
): Promise<void> {
  const store = await getStore();
  await store.set(PANE_IDS_KEY, serviceIds);
  await store.set(PANE_RATIOS_KEY, ratios);
}

export async function saveLayouts(layouts: SavedLayout[]): Promise<void> {
  const store = await getStore();
  await store.set(LAYOUTS_KEY, layouts);
}

export async function saveActiveLayoutId(id: string): Promise<void> {
  const store = await getStore();
  await store.set(ACTIVE_LAYOUT_KEY, id);
}

export async function savePanesLocked(locked: boolean): Promise<void> {
  const store = await getStore();
  await store.set(PANES_LOCKED_KEY, locked);
}

export async function saveThemeMode(mode: ThemeMode): Promise<void> {
  const store = await getStore();
  await store.set(THEME_KEY, mode);
}

export async function loadThemeMode(): Promise<ThemeMode> {
  const store = await getStore();
  return parseThemeMode(await store.get(THEME_KEY));
}

export async function saveSidebarCollapsed(collapsed: boolean): Promise<void> {
  const store = await getStore();
  await store.set(SIDEBAR_COLLAPSED_KEY, collapsed);
}

export async function saveServiceOrder(order: string[]): Promise<void> {
  const store = await getStore();
  await store.set(SERVICE_ORDER_KEY, order);
}

export async function saveZoomByService(
  zoom: Record<string, number>,
): Promise<void> {
  const store = await getStore();
  await store.set(ZOOM_KEY, zoom);
}
