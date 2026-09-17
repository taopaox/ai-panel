import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getContentBounds,
  layoutContentWebview,
  layoutShell,
} from "../lib/layout";
import { loadWorkspaceState, saveLastActiveId, saveServices } from "../lib/persist";
import {
  createCustomServiceId,
  DEFAULT_SERVICES,
  extraTabLabel,
  MAX_TABS_PER_SERVICE,
  normalizeServiceUrl,
  samePageUrl,
  serviceIdFromWebviewLabel,
  titleFromUrl,
  webviewLabel,
  type AiService,
  type ContentPagePayload,
  type ContentTab,
  type NavAction,
  type OpenTabPayload,
} from "../types";

const HISTORY_POLL_MS = 800;
const HISTORY_REFRESH_DELAY_MS = 160;

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

function homeTab(service: AiService): ContentTab {
  return {
    label: webviewLabel(service.id),
    title: service.name,
    url: service.url,
    closable: false,
  };
}

export function useWorkspace() {
  const services = ref<AiService[]>([...DEFAULT_SERVICES]);
  const activeId = ref(DEFAULT_SERVICES[0].id);
  const activeTabLabel = ref(webviewLabel(DEFAULT_SERVICES[0].id));
  const tabsByService = ref<Record<string, ContentTab[]>>({});
  const lastTabByService = ref<Record<string, string>>({});
  const errorMessage = ref("");
  const ready = ref(false);
  const canGoBack = ref(false);
  const canGoForward = ref(false);

  const webviews = new Map<string, Webview>();
  const creating = new Set<string>();
  const unlisteners: Array<() => void> = [];
  let historyQuerySeq = 0;
  let historyPollTimer = 0;
  let historyDelayTimer = 0;

  const currentTabs = computed(
    () => tabsByService.value[activeId.value] ?? [],
  );

  function resetHistory(): void {
    canGoBack.value = false;
    canGoForward.value = false;
  }

  function setServiceTabs(serviceId: string, tabs: ContentTab[]): void {
    tabsByService.value = { ...tabsByService.value, [serviceId]: tabs };
  }

  function ensureHomeTab(service: AiService): ContentTab[] {
    const existing = tabsByService.value[service.id];
    if (existing && existing.length > 0) {
      return existing;
    }
    const tabs = [homeTab(service)];
    setServiceTabs(service.id, tabs);
    return tabs;
  }

  function updateTabMeta(
    label: string,
    patch: Partial<Pick<ContentTab, "title" | "url">>,
  ): void {
    const serviceId = serviceIdFromWebviewLabel(label);
    const tabs = tabsByService.value[serviceId];
    if (!tabs) {
      return;
    }
    setServiceTabs(
      serviceId,
      tabs.map((tab) => {
        if (tab.label !== label) {
          return tab;
        }
        const title =
          patch.title && patch.title.trim() ? patch.title.trim() : tab.title;
        return {
          ...tab,
          title,
          url: patch.url || tab.url,
        };
      }),
    );
  }

  function applyPageState(payload: ContentPagePayload): void {
    if (payload.label === activeTabLabel.value) {
      canGoBack.value = payload.canGoBack;
      canGoForward.value = payload.canGoForward;
    }
    updateTabMeta(payload.label, {
      title: payload.title,
      url: payload.url,
    });
  }

  async function refreshHistory(): Promise<void> {
    const label = activeTabLabel.value;
    if (!webviews.has(label)) {
      resetHistory();
      return;
    }

    const seq = (historyQuerySeq += 1);
    try {
      const state = await invoke<Omit<ContentPagePayload, "label">>(
        "content_webview_history",
        { label },
      );
      if (seq !== historyQuerySeq || activeTabLabel.value !== label) {
        return;
      }
      applyPageState({ ...state, label });
    } catch {
      if (seq !== historyQuerySeq || activeTabLabel.value !== label) {
        return;
      }
      resetHistory();
    }
  }

  function scheduleHistoryRefresh(): void {
    window.clearTimeout(historyDelayTimer);
    historyDelayTimer = window.setTimeout(() => {
      void refreshHistory();
    }, HISTORY_REFRESH_DELAY_MS);
  }

  async function persistServices(): Promise<void> {
    await saveServices(services.value);
  }

  async function layoutAll(): Promise<void> {
    await layoutShell();
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

  async function ensureWebview(label: string, url: string): Promise<Webview> {
    let webview = webviews.get(label);
    if (webview) {
      return webview;
    }
    if (creating.has(label)) {
      const created = await waitForWebview(label);
      webviews.set(label, created);
      return created;
    }

    creating.add(label);
    try {
      const bounds = await getContentBounds();
      await invoke("create_content_webview", {
        label,
        url,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      webview = await waitForWebview(label);
      webviews.set(label, webview);
      return webview;
    } finally {
      creating.delete(label);
    }
  }

  async function showLabel(label: string): Promise<void> {
    const webview = webviews.get(label);
    if (!webview) {
      throw new Error("页面尚未打开");
    }
    await layoutContentWebview(webview);
    await hideOthers(label);
    await webview.show();
    await webview.setFocus();
    await refreshHistory();
  }

  async function selectTab(label: string): Promise<void> {
    const serviceId = serviceIdFromWebviewLabel(label);
    const service = services.value.find((item) => item.id === serviceId);
    const tab = (tabsByService.value[serviceId] ?? []).find(
      (item) => item.label === label,
    );
    if (!service || !tab) {
      return;
    }

    errorMessage.value = "";
    activeId.value = serviceId;
    activeTabLabel.value = label;
    lastTabByService.value = { ...lastTabByService.value, [serviceId]: label };
    resetHistory();
    await saveLastActiveId(serviceId);

    try {
      await ensureWebview(label, tab.url);
      await showLabel(label);
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : `打开 ${tab.title} 失败`;
    }
  }

  async function selectService(id: string): Promise<void> {
    const service = services.value.find((item) => item.id === id);
    if (!service) {
      return;
    }

    const tabs = ensureHomeTab(service);
    const lastLabel = lastTabByService.value[service.id];
    const preferred =
      tabs.find((tab) => tab.label === lastLabel) ??
      tabs.find((tab) => tab.label === activeTabLabel.value) ??
      tabs[0];
    await selectTab(preferred.label);
  }

  async function openTab(service: AiService, url: string): Promise<void> {
    const tabs = ensureHomeTab(service);
    const existing = tabs.find((tab) => samePageUrl(tab.url, url));
    if (existing) {
      await selectTab(existing.label);
      return;
    }

    if (tabs.length >= MAX_TABS_PER_SERVICE) {
      const target = tabs.find((tab) => tab.closable) ?? tabs[tabs.length - 1];
      await selectTab(target.label);
      if (webviews.has(target.label)) {
        await invoke("load_content_webview", { label: target.label, url });
        updateTabMeta(target.label, {
          title: titleFromUrl(url, service.name),
          url,
        });
      }
      return;
    }

    const label = extraTabLabel(service.id);
    const tab: ContentTab = {
      label,
      title: titleFromUrl(url, service.name),
      url,
      closable: true,
    };
    setServiceTabs(service.id, [...tabs, tab]);
    await selectTab(label);
  }

  async function handleOpenTab(payload: OpenTabPayload): Promise<void> {
    const serviceId = serviceIdFromWebviewLabel(payload.openerLabel);
    const service = services.value.find((item) => item.id === serviceId);
    if (!service) {
      return;
    }
    await openTab(service, payload.url);
  }

  async function closeTab(label: string): Promise<void> {
    const serviceId = serviceIdFromWebviewLabel(label);
    const tabs = tabsByService.value[serviceId] ?? [];
    const tab = tabs.find((item) => item.label === label);
    if (!tab || !tab.closable) {
      return;
    }

    const nextTabs = tabs.filter((item) => item.label !== label);
    setServiceTabs(serviceId, nextTabs);

    const webview = webviews.get(label);
    if (webview) {
      webviews.delete(label);
      await invoke("close_content_webview", { label });
    }

    if (activeTabLabel.value === label) {
      const fallback = nextTabs[nextTabs.length - 1] ?? nextTabs[0];
      if (fallback) {
        await selectTab(fallback.label);
      }
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

    const tabs = tabsByService.value[id] ?? [];
    await Promise.all(
      tabs.map(async (tab) => {
        if (webviews.has(tab.label)) {
          webviews.delete(tab.label);
          await invoke("close_content_webview", { label: tab.label });
        }
      }),
    );

    const nextTabs = { ...tabsByService.value };
    delete nextTabs[id];
    tabsByService.value = nextTabs;

    services.value = services.value.filter((item) => item.id !== id);
    await persistServices();

    if (activeId.value === id) {
      const fallback = services.value[0];
      if (fallback) {
        await selectService(fallback.id);
      }
    }
  }

  async function navigateActive(action: NavAction): Promise<void> {
    const label = activeTabLabel.value;
    if (!webviews.has(label)) {
      if (action === "reload") {
        await selectTab(label);
      }
      return;
    }

    errorMessage.value = "";
    try {
      await invoke("navigate_content_webview", { label, action });
      scheduleHistoryRefresh();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "页面导航失败";
    }
  }

  async function goBack(): Promise<void> {
    if (!canGoBack.value) {
      return;
    }
    await navigateActive("back");
  }

  async function goForward(): Promise<void> {
    if (!canGoForward.value) {
      return;
    }
    await navigateActive("forward");
  }

  async function reloadActive(): Promise<void> {
    await navigateActive("reload");
  }

  onMounted(async () => {
    try {
      const state = await loadWorkspaceState();
      services.value = state.services;
      const hasSaved = state.services.some(
        (service) => service.id === state.lastActiveId,
      );
      activeId.value = hasSaved ? state.lastActiveId : state.services[0].id;
      activeTabLabel.value = webviewLabel(activeId.value);

      await layoutShell();
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
      unlisteners.push(
        await listen<ContentPagePayload>("content-page-state", (event) => {
          if (event.payload.label === activeTabLabel.value) {
            historyQuerySeq += 1;
          }
          applyPageState(event.payload);
        }),
      );
      unlisteners.push(
        await listen<OpenTabPayload>("content-open-tab", (event) => {
          void handleOpenTab(event.payload);
        }),
      );
      historyPollTimer = window.setInterval(() => {
        void refreshHistory();
      }, HISTORY_POLL_MS);

      await selectService(activeId.value);
      ready.value = true;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : "工作区初始化失败";
      ready.value = true;
    }
  });

  onUnmounted(() => {
    window.clearInterval(historyPollTimer);
    window.clearTimeout(historyDelayTimer);
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });

  return {
    services,
    activeId,
    activeTabLabel,
    currentTabs,
    errorMessage,
    ready,
    canGoBack,
    canGoForward,
    selectService,
    selectTab,
    closeTab,
    addService,
    removeService,
    goBack,
    goForward,
    reloadActive,
  };
}
