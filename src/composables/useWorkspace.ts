import { invoke } from "@tauri-apps/api/core";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMounted, onUnmounted, ref } from "vue";
import {
  getContentBounds,
  layoutContentWebview,
  layoutSidebar,
} from "../lib/layout";
import { loadWorkspaceState, saveLastActiveId, saveServices } from "../lib/persist";
import {
  createCustomServiceId,
  DEFAULT_SERVICES,
  normalizeServiceUrl,
  webviewLabel,
  type AiService,
} from "../types";

async function waitForWebview(label: string): Promise<Webview> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const found = await Webview.getByLabel(label);
    if (found) {
      return found;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error("页面创建超时");
}

export function useWorkspace() {
  const services = ref<AiService[]>([...DEFAULT_SERVICES]);
  const activeId = ref(DEFAULT_SERVICES[0].id);
  const errorMessage = ref("");
  const ready = ref(false);

  const webviews = new Map<string, Webview>();
  const creating = new Set<string>();
  const unlisteners: Array<() => void> = [];

  async function persistServices(): Promise<void> {
    await saveServices(services.value);
  }

  async function layoutAll(): Promise<void> {
    await layoutSidebar();
    await Promise.all(
      [...webviews.values()].map((webview) => layoutContentWebview(webview)),
    );
  }

  async function hideOthers(exceptLabel: string): Promise<void> {
    await Promise.all(
      [...webviews.entries()].map(async ([label, webview]) => {
        if (label === exceptLabel) {
          return;
        }
        await webview.hide();
      }),
    );
  }

  async function showService(service: AiService): Promise<void> {
    const label = webviewLabel(service.id);
    let webview = webviews.get(label);

    if (!webview && !creating.has(label)) {
      creating.add(label);
      try {
        const bounds = await getContentBounds();
        await invoke("create_content_webview", {
          label,
          url: service.url,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
        webview = await waitForWebview(label);
        webviews.set(label, webview);
      } finally {
        creating.delete(label);
      }
    }

    if (!webview) {
      throw new Error(`未能打开 ${service.name}`);
    }

    await layoutContentWebview(webview);
    await hideOthers(label);
    await webview.show();
    await webview.setFocus();
  }

  async function selectService(id: string): Promise<void> {
    const service = services.value.find((item) => item.id === id);
    if (!service) {
      return;
    }

    errorMessage.value = "";
    activeId.value = id;
    await saveLastActiveId(id);

    try {
      await showService(service);
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : `打开 ${service.name} 失败`;
    }
  }

  async function addService(name: string, url: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("请输入名称");
    }

    const normalizedUrl = normalizeServiceUrl(url);
    const service: AiService = {
      id: createCustomServiceId(),
      name: trimmedName,
      url: normalizedUrl,
      builtin: false,
      color: "#8e8e93",
    };

    services.value = [...services.value, service];
    await persistServices();
    await selectService(service.id);
  }

  async function removeService(id: string): Promise<void> {
    const service = services.value.find((item) => item.id === id);
    if (!service || service.builtin) {
      return;
    }

    const label = webviewLabel(id);
    const webview = webviews.get(label);
    if (webview) {
      webviews.delete(label);
      await invoke("close_content_webview", { label });
    }

    services.value = services.value.filter((item) => item.id !== id);
    await persistServices();

    if (activeId.value === id) {
      const fallback = services.value[0];
      if (fallback) {
        await selectService(fallback.id);
      }
    }
  }

  async function reloadActive(): Promise<void> {
    const label = webviewLabel(activeId.value);
    if (!webviews.has(label)) {
      const service = services.value.find((item) => item.id === activeId.value);
      if (service) {
        await showService(service);
      }
      return;
    }
    await invoke("reload_content_webview", { label });
  }

  onMounted(async () => {
    try {
      const state = await loadWorkspaceState();
      services.value = state.services;
      const hasSaved = state.services.some(
        (service) => service.id === state.lastActiveId,
      );
      activeId.value = hasSaved ? state.lastActiveId : state.services[0].id;

      await layoutSidebar();
      const currentWindow = getCurrentWindow();
      unlisteners.push(
        await currentWindow.onResized(() => {
          void layoutAll();
        }),
      );
      if (typeof currentWindow.onScaleChanged === "function") {
        unlisteners.push(
          await currentWindow.onScaleChanged(() => {
            void layoutAll();
          }),
        );
      }

      await selectService(activeId.value);
      ready.value = true;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "工作区初始化失败";
      ready.value = true;
    }
  });

  onUnmounted(() => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });

  return {
    services,
    activeId,
    errorMessage,
    ready,
    selectService,
    addService,
    removeService,
    reloadActive,
  };
}
