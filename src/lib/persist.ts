import { load, type Store } from "@tauri-apps/plugin-store";
import {
  composeServices,
  DEFAULT_ENABLED_IDS,
  DEFAULT_SERVICES,
  normalizeEnabledIds,
  normalizeSavedLayouts,
  type AiService,
  type SavedLayout,
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

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true });
  }
  return storePromise;
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
  const services = composeServices(enabledServiceIds, customServices);
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
