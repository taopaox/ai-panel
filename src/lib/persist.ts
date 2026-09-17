import { load, type Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SERVICES, type AiService } from "../types";

const STORE_FILE = "workspace.json";
const SERVICES_KEY = "services";
const LAST_ACTIVE_KEY = "lastActiveId";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load(STORE_FILE, { autoSave: true });
  }
  return storePromise;
}

export async function loadWorkspaceState(): Promise<{
  services: AiService[];
  lastActiveId: string;
}> {
  const store = await getStore();
  const savedServices = (await store.get<AiService[]>(SERVICES_KEY)) ?? [];
  const customServices = savedServices.filter((service) => !service.builtin);
  const lastActiveId =
    (await store.get<string>(LAST_ACTIVE_KEY)) ?? DEFAULT_SERVICES[0].id;

  return {
    services: [...DEFAULT_SERVICES, ...customServices],
    lastActiveId,
  };
}

export async function saveServices(services: AiService[]): Promise<void> {
  const store = await getStore();
  await store.set(SERVICES_KEY, services);
}

export async function saveLastActiveId(id: string): Promise<void> {
  const store = await getStore();
  await store.set(LAST_ACTIVE_KEY, id);
}
