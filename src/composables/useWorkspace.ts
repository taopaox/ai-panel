import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  applySplitterDrag,
  contentAreaSize,
  equalRatios,
  getLogicalWindowSize,
  layoutContentWebview,
  layoutShell,
  mergeRatioAt,
  normalizeRatios,
  paneBoundsList,
  paneWidths,
  splitRatioAt,
  widthsToRatios,
} from "../lib/layout";
import { showPopup, type PopupPoint } from "../lib/menu";
import {
  loadWorkspaceState,
  saveActiveLayoutId,
  saveEnabledServiceIds,
  saveLastActiveId,
  saveLayouts,
  savePanes,
  savePanesLocked,
  saveServiceOrder,
  saveServices,
  saveSidebarCollapsed,
  saveZoomByService,
} from "../lib/persist";
import {
  catalogServiceById,
  clampZoom,
  composeServices,
  createCustomServiceId,
  createLayoutId,
  createPaneId,
  DEFAULT_ENABLED_IDS,
  DEFAULT_SERVICES,
  extraTabLabel,
  layoutNameFromIds,
  MAX_PANES,
  MAX_SAVED_LAYOUTS,
  nextLayoutName,
  sanitizeLayoutName,
  MAX_TABS_PER_SERVICE,
  ZOOM_STEP,
  TAB_BAR_HEIGHT,
  normalizeEnabledIds,
  normalizeSavedLayouts,
  normalizeServiceOrder,
  normalizeServiceUrl,
  samePageUrl,
  sameServiceIds,
  serviceIdFromWebviewLabel,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_RAIL,
  titleFromUrl,
  webviewLabel,
  type AiService,
  type ContentPagePayload,
  type ContentTab,
  type HistoryState,
  type NavAction,
  type OpenTabPayload,
  type OverlayKind,
  type SavedLayout,
  type WorkspacePane,
} from "../types";
import { useToast } from "./useToast";

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

function emptyHistory(): HistoryState {
  return { canGoBack: false, canGoForward: false };
}

export function useWorkspace() {
  const services = ref<AiService[]>([...DEFAULT_SERVICES]);
  const enabledIds = ref<string[]>([...DEFAULT_ENABLED_IDS]);
  const panes = ref<WorkspacePane[]>([
    { id: createPaneId(), serviceId: DEFAULT_SERVICES[0].id },
  ]);
  const paneRatios = ref<number[]>([1]);
  const focusedPaneIndex = ref(0);
  const windowSize = ref({ width: 1280, height: 840 });
  const tabsByService = ref<Record<string, ContentTab[]>>({});
  const lastTabByService = ref<Record<string, string>>({});
  const historyByLabel = ref<Record<string, HistoryState>>({});
  const savedLayouts = ref<SavedLayout[]>([]);
  const activeLayoutId = ref("");
  const panesLocked = ref(false);
  const overlay = ref<OverlayKind>("none");
  const sidebarCollapsed = ref(false);
  const serviceOrder = ref<string[]>([...DEFAULT_ENABLED_IDS]);
  const zoomByService = ref<Record<string, number>>({});
  const loadingByLabel = ref<Record<string, boolean>>({});
  const ready = ref(false);
  const resizing = ref(false);
  const { toastMessage, showToast } = useToast();

  const webviews = new Map<string, Webview>();
  const openedLabels = ref(new Set<string>());
  const creating = new Set<string>();
  const unlisteners: Array<() => void> = [];
  const historyQuerySeq = new Map<string, number>();
  let historyPollTimer = 0;
  let historyDelayTimer = 0;
  let layoutRaf = 0;
  let resizeSession: {
    index: number;
    startX: number;
    startWidths: number[];
  } | null = null;

  const managing = computed(() => overlay.value === "manage");
  const settingsOpen = computed(() => overlay.value === "settings");
  const sidebarWidth = computed(() =>
    sidebarCollapsed.value ? SIDEBAR_WIDTH_RAIL : SIDEBAR_WIDTH_EXPANDED,
  );
  const focusedZoom = computed(
    () => zoomByService.value[activeId.value] ?? 1,
  );

  const activeId = computed(
    () => panes.value[focusedPaneIndex.value]?.serviceId ?? "",
  );

  const visibleServiceIds = computed(
    () => new Set(panes.value.map((pane) => pane.serviceId)),
  );

  const openedServiceIds = computed(() => {
    const ids = new Set<string>();
    for (const label of openedLabels.value) {
      ids.add(serviceIdFromWebviewLabel(label));
    }
    return ids;
  });

  const unusedServices = computed(() =>
    services.value.filter((service) => !visibleServiceIds.value.has(service.id)),
  );

  const canSplit = computed(
    () =>
      !panesLocked.value &&
      panes.value.length < MAX_PANES &&
      unusedServices.value.length > 0,
  );

  const canClosePane = computed(
    () => panes.value.length > 1,
  );

  const canSaveLayout = computed(() => panes.value.length >= 2);

  const currentLayoutSaved = computed(() => Boolean(activeLayoutId.value));

  const layoutItems = computed(() =>
    savedLayouts.value.map((layout) => ({
      ...layout,
      services: layout.serviceIds
        .map((id) => services.value.find((service) => service.id === id))
        .filter((service): service is AiService => Boolean(service)),
      active: layout.id === activeLayoutId.value,
    })),
  );

  const customServices = computed(() =>
    services.value.filter((service) => !service.builtin),
  );

  const paneRects = computed(() =>
    paneBoundsList(
      windowSize.value.width,
      windowSize.value.height,
      paneRatios.value,
      sidebarWidth.value,
    ),
  );

  const paneViews = computed(() =>
    panes.value.map((pane, index) => {
      const tabLabel =
        lastTabByService.value[pane.serviceId] ?? webviewLabel(pane.serviceId);
      const history = historyByLabel.value[tabLabel] ?? emptyHistory();
      return {
        ...pane,
        index,
        tabLabel,
        tabs: tabsByService.value[pane.serviceId] ?? [],
        canGoBack: history.canGoBack,
        canGoForward: history.canGoForward,
        loading: Boolean(loadingByLabel.value[tabLabel]),
        focused: index === focusedPaneIndex.value,
        width: paneRects.value[index]?.width ?? 0,
      };
    }),
  );

  function tabLabelOf(pane: WorkspacePane): string {
    return lastTabByService.value[pane.serviceId] ?? webviewLabel(pane.serviceId);
  }

  function visibleTabLabels(): string[] {
    return panes.value.map((pane) => tabLabelOf(pane));
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
    historyByLabel.value = {
      ...historyByLabel.value,
      [payload.label]: {
        canGoBack: payload.canGoBack,
        canGoForward: payload.canGoForward,
      },
    };
    updateTabMeta(payload.label, {
      title: payload.title,
      url: payload.url,
    });
    if (typeof payload.loading === "boolean") {
      loadingByLabel.value = {
        ...loadingByLabel.value,
        [payload.label]: payload.loading,
      };
    }
  }

  async function refreshLabelHistory(label: string): Promise<void> {
    if (!webviews.has(label)) {
      historyByLabel.value = {
        ...historyByLabel.value,
        [label]: emptyHistory(),
      };
      return;
    }

    const seq = (historyQuerySeq.get(label) ?? 0) + 1;
    historyQuerySeq.set(label, seq);
    try {
      const state = await invoke<Omit<ContentPagePayload, "label">>(
        "content_webview_history",
        { label },
      );
      if (historyQuerySeq.get(label) !== seq) {
        return;
      }
      applyPageState({ ...state, label });
    } catch {
      if (historyQuerySeq.get(label) !== seq) {
        return;
      }
      historyByLabel.value = {
        ...historyByLabel.value,
        [label]: emptyHistory(),
      };
    }
  }

  async function refreshVisibleHistory(): Promise<void> {
    await Promise.all(visibleTabLabels().map((label) => refreshLabelHistory(label)));
  }

  function scheduleHistoryRefresh(): void {
    window.clearTimeout(historyDelayTimer);
    historyDelayTimer = window.setTimeout(() => {
      void refreshVisibleHistory();
    }, HISTORY_REFRESH_DELAY_MS);
  }

  function applyServiceLists(
    nextEnabled: string[],
    nextCustom: AiService[],
    nextOrder = serviceOrder.value,
  ): void {
    enabledIds.value = normalizeEnabledIds(nextEnabled);
    const composed = composeServices(enabledIds.value, nextCustom, nextOrder);
    serviceOrder.value = normalizeServiceOrder(
      nextOrder,
      composed.map((service) => service.id),
    );
    services.value = composeServices(
      enabledIds.value,
      nextCustom,
      serviceOrder.value,
    );
  }

  async function persistServices(): Promise<void> {
    await saveServices(services.value);
    await saveEnabledServiceIds(enabledIds.value);
    await saveServiceOrder(serviceOrder.value);
    const nextLayouts = pruneLayouts(savedLayouts.value);
    const layoutsChanged =
      nextLayouts.length !== savedLayouts.value.length ||
      nextLayouts.some((layout, index) => layout !== savedLayouts.value[index]);
    if (layoutsChanged) {
      savedLayouts.value = nextLayouts;
      if (
        activeLayoutId.value &&
        !nextLayouts.some((layout) => layout.id === activeLayoutId.value)
      ) {
        activeLayoutId.value = "";
      }
      await persistLayouts();
    }
  }

  function currentPaneServiceIds(): string[] {
    return panes.value.map((pane) => pane.serviceId);
  }

  function pruneLayouts(next: SavedLayout[]): SavedLayout[] {
    return normalizeSavedLayouts(
      next,
      new Set(services.value.map((service) => service.id)),
    );
  }

  function updateActiveLayoutSnapshot(): void {
    const layoutId = activeLayoutId.value;
    if (!layoutId) {
      return;
    }

    const current = savedLayouts.value.find((layout) => layout.id === layoutId);
    if (!current) {
      activeLayoutId.value = "";
      panesLocked.value = false;
      return;
    }

    const serviceIds = currentPaneServiceIds();
    if (panesLocked.value) {
      if (!sameServiceIds(serviceIds, current.serviceIds)) {
        activeLayoutId.value = "";
        panesLocked.value = false;
        return;
      }
      savedLayouts.value = pruneLayouts(
        savedLayouts.value.map((layout) =>
          layout.id === layoutId
            ? { ...current, ratios: [...paneRatios.value], locked: true }
            : layout,
        ),
      );
      return;
    }

    if (serviceIds.length < 2) {
      activeLayoutId.value = "";
      return;
    }

    const updated: SavedLayout = {
      ...current,
      name: nextLayoutName(
        current.name,
        current.serviceIds,
        serviceIds,
        services.value,
      ),
      serviceIds,
      ratios: [...paneRatios.value],
      locked: false,
    };
    savedLayouts.value = pruneLayouts(
      savedLayouts.value.map((layout) =>
        layout.id === layoutId ? updated : layout,
      ),
    );
    if (!savedLayouts.value.some((layout) => layout.id === layoutId)) {
      activeLayoutId.value = "";
    }
  }

  async function persistLayouts(): Promise<void> {
    await saveLayouts(savedLayouts.value);
    await saveActiveLayoutId(activeLayoutId.value);
    await savePanesLocked(panesLocked.value);
  }

  async function persistPanes(): Promise<void> {
    updateActiveLayoutSnapshot();
    await savePanes(currentPaneServiceIds(), paneRatios.value);
    await persistLayouts();
  }

  function syncOpenedLabel(label: string, open: boolean): void {
    if (openedLabels.value.has(label) === open) {
      return;
    }
    const next = new Set(openedLabels.value);
    if (open) {
      next.add(label);
    } else {
      next.delete(label);
    }
    openedLabels.value = next;
  }

  function rememberWebview(label: string, webview: Webview): void {
    webviews.set(label, webview);
    syncOpenedLabel(label, true);
  }

  async function closeWebviews(labels: string[]): Promise<void> {
    const unique = [...new Set(labels)];
    const next = new Set(openedLabels.value);
    const toClose: string[] = [];
    for (const label of unique) {
      if (webviews.has(label)) {
        webviews.delete(label);
        toClose.push(label);
      }
      next.delete(label);
    }
    openedLabels.value = next;
    await Promise.all(
      toClose.map((label) => invoke("close_content_webview", { label })),
    );
  }

  async function closeWebview(label: string): Promise<void> {
    await closeWebviews([label]);
  }

  function guardLocked(): boolean {
    if (!panesLocked.value) {
      return false;
    }
    showToast("分屏已锁定，请先解锁再改各栏网页");
    return true;
  }

  async function ensurePaneWebviews(): Promise<void> {
    for (const pane of panes.value) {
      const service = services.value.find((item) => item.id === pane.serviceId);
      if (!service) {
        continue;
      }
      const tabs = ensureHomeTab(service);
      const label = lastTabByService.value[pane.serviceId] ?? tabs[0].label;
      lastTabByService.value = {
        ...lastTabByService.value,
        [pane.serviceId]: label,
      };
      const tab = tabs.find((item) => item.label === label) ?? tabs[0];
      await ensureWebview(tab.label, tab.url);
    }
  }

  async function layoutAll(measure = true): Promise<void> {
    if (measure) {
      windowSize.value = await getLogicalWindowSize();
      await layoutShell();
    }

    if (overlay.value !== "none") {
      await Promise.all(
        [...webviews.values()].map(async (webview) => {
          await webview.hide();
        }),
      );
      return;
    }

    const rects = paneBoundsList(
      windowSize.value.width,
      windowSize.value.height,
      paneRatios.value,
      sidebarWidth.value,
    );
    const visible = new Map<string, (typeof rects)[number]>();
    panes.value.forEach((pane, index) => {
      const bounds = rects[index];
      if (bounds) {
        visible.set(tabLabelOf(pane), bounds);
      }
    });

    await Promise.all(
      [...webviews.entries()].map(async ([label, webview]) => {
        const bounds = visible.get(label);
        if (bounds) {
          await layoutContentWebview(webview, bounds);
          await webview.show();
        } else {
          await webview.hide();
        }
      }),
    );
  }

  async function setOverlay(next: OverlayKind): Promise<void> {
    if (overlay.value === next) {
      return;
    }
    overlay.value = next;
    await layoutAll();
    if (next === "none") {
      await focusPane(focusedPaneIndex.value);
    }
  }

  async function setManaging(open: boolean): Promise<void> {
    await setOverlay(open ? "manage" : "none");
  }

  async function toggleSidebar(): Promise<void> {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    await saveSidebarCollapsed(sidebarCollapsed.value);
    await layoutAll();
  }

  function scheduleLayout(measure = true): void {
    if (layoutRaf) {
      return;
    }
    layoutRaf = window.requestAnimationFrame(() => {
      layoutRaf = 0;
      void layoutAll(measure);
    });
  }

  async function ensureWebview(label: string, url: string): Promise<Webview> {
    let webview = webviews.get(label);
    if (webview) {
      return webview;
    }
    if (creating.has(label)) {
      const created = await waitForWebview(label);
      rememberWebview(label, created);
      await applyZoomToLabel(label);
      return created;
    }

    creating.add(label);
    try {
      const serviceId = serviceIdFromWebviewLabel(label);
      const paneIndex = panes.value.findIndex((pane) => pane.serviceId === serviceId);
      const bounds =
        paneRects.value[paneIndex] ??
        paneRects.value[0] ??
        paneBoundsList(
          windowSize.value.width,
          windowSize.value.height,
          [1],
          sidebarWidth.value,
        )[0];
      await invoke("create_content_webview", {
        label,
        url,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
      webview = await waitForWebview(label);
      rememberWebview(label, webview);
      await applyZoomToLabel(label);
      return webview;
    } finally {
      creating.delete(label);
    }
  }

  async function focusPane(index: number, focusWebview = true): Promise<void> {
    const pane = panes.value[index];
    if (!pane) {
      return;
    }
    focusedPaneIndex.value = index;
    await saveLastActiveId(pane.serviceId);
    if (!focusWebview) {
      return;
    }
    const label = tabLabelOf(pane);
    const webview = webviews.get(label);
    if (webview) {
      await webview.setFocus();
      await refreshVisibleHistory();
      return;
    }
    await showServiceInPane(pane.serviceId, index);
  }

  async function showServiceInPane(
    serviceId: string,
    paneIndex: number,
    tabLabel?: string,
  ): Promise<void> {
    const service = services.value.find((item) => item.id === serviceId);
    const pane = panes.value[paneIndex];
    if (!service || !pane) {
      return;
    }

    const tabs = ensureHomeTab(service);
    const preferredLabel =
      tabLabel ?? lastTabByService.value[serviceId] ?? tabs[0]?.label;
    const tab =
      tabs.find((item) => item.label === preferredLabel) ?? tabs[0];
    if (!tab) {
      return;
    }

    const next = [...panes.value];
    next[paneIndex] = { ...pane, serviceId };
    panes.value = next;
    focusedPaneIndex.value = paneIndex;
    lastTabByService.value = {
      ...lastTabByService.value,
      [serviceId]: tab.label,
    };
    await saveLastActiveId(serviceId);
    await persistPanes();

    try {
      await ensureWebview(tab.label, tab.url);
      await layoutAll();
      await webviews.get(tab.label)?.setFocus();
      await refreshVisibleHistory();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : `打开 ${tab.title} 失败`,
      );
    }
  }

  async function selectTab(label: string): Promise<void> {
    const serviceId = serviceIdFromWebviewLabel(label);
    const existing = panes.value.findIndex((pane) => pane.serviceId === serviceId);
    const paneIndex = existing >= 0 ? existing : focusedPaneIndex.value;
    await showServiceInPane(serviceId, paneIndex, label);
  }

  async function leaveSplitToService(id: string): Promise<void> {
    activeLayoutId.value = "";
    panesLocked.value = false;
    panes.value = [{ id: createPaneId(), serviceId: id }];
    paneRatios.value = [1];
    focusedPaneIndex.value = 0;
    await showServiceInPane(id, 0);
  }

  async function selectService(id: string): Promise<void> {
    const existing = panes.value.findIndex((pane) => pane.serviceId === id);
    if (existing >= 0) {
      await focusPane(existing);
      return;
    }
    if (panesLocked.value) {
      await leaveSplitToService(id);
      return;
    }
    await showServiceInPane(id, focusedPaneIndex.value);
  }

  function popupPointForPane(index: number): PopupPoint {
    const rect = paneRects.value[index] ?? paneRects.value[focusedPaneIndex.value];
    if (!rect) {
      return { x: sidebarWidth.value + 48, y: TAB_BAR_HEIGHT / 2 };
    }
    return {
      x: rect.x + Math.max(rect.width - 28, 16),
      y: TAB_BAR_HEIGHT / 2,
    };
  }

  async function splitPaneWith(
    serviceId: string,
    fromIndex = focusedPaneIndex.value,
  ): Promise<void> {
    if (guardLocked()) {
      return;
    }
    const source = services.value.find((item) => item.id === serviceId);
    if (!source || panes.value.length >= MAX_PANES) {
      return;
    }
    if (visibleServiceIds.value.has(serviceId)) {
      await focusPane(panes.value.findIndex((pane) => pane.serviceId === serviceId));
      return;
    }

    const insertAt = Math.min(fromIndex + 1, panes.value.length);
    const next = [...panes.value];
    next.splice(insertAt, 0, { id: createPaneId(), serviceId });
    panes.value = next;
    paneRatios.value = splitRatioAt(paneRatios.value, fromIndex);
    ensureHomeTab(source);
    await persistPanes();
    await showServiceInPane(serviceId, insertAt);
  }

  async function splitPane(
    fromIndex = focusedPaneIndex.value,
    point?: PopupPoint,
  ): Promise<void> {
    if (guardLocked()) {
      return;
    }
    const unused = unusedServices.value;
    if (panes.value.length >= MAX_PANES) {
      showToast("最多 3 栏分屏");
      return;
    }
    if (!unused[0]) {
      showToast("没有可分屏的服务");
      return;
    }
    if (unused.length === 1) {
      await splitPaneWith(unused[0].id, fromIndex);
      return;
    }

    try {
      const picked = await showPopup(
        unused.map((service) => ({
          id: `popup:split:${service.id}`,
          text: service.name,
        })),
        point ?? popupPointForPane(fromIndex),
      );
      if (!picked?.startsWith("popup:split:")) {
        return;
      }
      await splitPaneWith(picked.slice("popup:split:".length), fromIndex);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "打开分屏菜单失败");
    }
  }

  async function closePane(index: number): Promise<void> {
    if (guardLocked()) {
      return;
    }
    if (panes.value.length <= 1 || !panes.value[index]) {
      return;
    }

    panes.value = panes.value.filter((_, paneIndex) => paneIndex !== index);
    paneRatios.value = mergeRatioAt(paneRatios.value, index);
    focusedPaneIndex.value = Math.min(
      index > 0 ? index - 1 : 0,
      panes.value.length - 1,
    );
    await persistPanes();
    await layoutAll();
    await focusPane(focusedPaneIndex.value);
  }

  async function openInNewPane(serviceId: string): Promise<void> {
    const existing = panes.value.findIndex((pane) => pane.serviceId === serviceId);
    if (existing >= 0) {
      await focusPane(existing);
      return;
    }
    if (panesLocked.value) {
      await leaveSplitToService(serviceId);
      return;
    }
    if (panes.value.length >= MAX_PANES) {
      await showServiceInPane(serviceId, focusedPaneIndex.value);
      return;
    }

    const fromIndex = focusedPaneIndex.value;
    const insertAt = Math.min(fromIndex + 1, panes.value.length);
    const next = [...panes.value];
    next.splice(insertAt, 0, { id: createPaneId(), serviceId });
    panes.value = next;
    paneRatios.value = splitRatioAt(paneRatios.value, fromIndex);
    await persistPanes();
    await showServiceInPane(serviceId, insertAt);
  }

  function startPaneResize(splitterIndex: number, clientX: number): void {
    const area = contentAreaSize(
      windowSize.value.width,
      windowSize.value.height,
      sidebarWidth.value,
    );
    resizeSession = {
      index: splitterIndex,
      startX: clientX,
      startWidths: paneWidths(area.width, paneRatios.value),
    };
    resizing.value = true;
  }

  function updatePaneResize(clientX: number): void {
    if (!resizeSession) {
      return;
    }
    const nextWidths = applySplitterDrag(
      resizeSession.startWidths,
      resizeSession.index,
      clientX - resizeSession.startX,
    );
    paneRatios.value = widthsToRatios(nextWidths);
    scheduleLayout(false);
  }

  async function endPaneResize(): Promise<void> {
    if (!resizeSession) {
      return;
    }
    resizeSession = null;
    resizing.value = false;
    await persistPanes();
    await layoutAll(false);
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

    await closeWebview(label);

    if (lastTabByService.value[serviceId] === label) {
      const fallback = nextTabs[nextTabs.length - 1] ?? nextTabs[0];
      if (fallback) {
        await selectTab(fallback.label);
      }
    }
  }

  async function closeServicePages(id: string): Promise<void> {
    const paneIndex = panes.value.findIndex((pane) => pane.serviceId === id);
    if (paneIndex >= 0 && panesLocked.value) {
      showToast("分屏已锁定，请先解锁再关闭当前显示的页面");
      return;
    }

    const labels = [...webviews.keys()].filter(
      (label) => serviceIdFromWebviewLabel(label) === id,
    );
    if (labels.length === 0) {
      return;
    }

    await closeWebviews(labels);

    const service = services.value.find((item) => item.id === id);
    if (service) {
      setServiceTabs(id, [homeTab(service)]);
    }
    if (lastTabByService.value[id]) {
      const nextLast = { ...lastTabByService.value };
      delete nextLast[id];
      lastTabByService.value = nextLast;
    }
    historyByLabel.value = Object.fromEntries(
      Object.entries(historyByLabel.value).filter(
        ([label]) => serviceIdFromWebviewLabel(label) !== id,
      ),
    );

    if (paneIndex >= 0 && panes.value.length > 1) {
      await closePane(paneIndex);
      return;
    }

    if (paneIndex >= 0) {
      const fallback = services.value.find(
        (item) => item.id !== id && openedServiceIds.value.has(item.id),
      );
      if (fallback) {
        await showServiceInPane(fallback.id, 0);
        return;
      }
    }

    await layoutAll();
  }

  async function leaveServicePane(id: string): Promise<void> {
    const paneIndex = panes.value.findIndex((pane) => pane.serviceId === id);
    if (paneIndex < 0) {
      return;
    }
    if (panes.value.length > 1) {
      await closePane(paneIndex);
      return;
    }
    const fallback = services.value[0];
    if (fallback) {
      await showServiceInPane(fallback.id, 0);
    }
  }

  async function addService(
    name: string,
    url: string,
    logoSrc?: string,
  ): Promise<void> {
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
      logo: "application",
      logoSrc,
    };

    applyServiceLists(enabledIds.value, [...customServices.value, service]);
    await persistServices();
    overlay.value = "none";
    await layoutAll();
    await selectService(service.id);
  }

  async function updateService(
    id: string,
    name: string,
    url: string,
    logoSrc?: string,
  ): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("请输入名称");
    }
    const normalizedUrl = normalizeServiceUrl(url);
    const current = services.value.find((item) => item.id === id);
    if (!current || current.builtin) {
      throw new Error("无法编辑内置服务");
    }

    const next: AiService = {
      ...current,
      name: trimmedName,
      url: normalizedUrl,
      logo: current.logo ?? "application",
      logoSrc: logoSrc ?? current.logoSrc,
    };
    applyServiceLists(
      enabledIds.value,
      customServices.value.map((item) => (item.id === id ? next : item)),
    );
    await persistServices();

    const home = webviewLabel(id);
    updateTabMeta(home, { title: trimmedName, url: normalizedUrl });
    if (webviews.has(home)) {
      await invoke("load_content_webview", { label: home, url: normalizedUrl });
    }
  }

  async function enableService(id: string): Promise<void> {
    if (!services.value.some((item) => item.id === id)) {
      const item = catalogServiceById(id);
      if (!item) {
        return;
      }
      applyServiceLists([...enabledIds.value, id], customServices.value);
      await persistServices();
    }
    overlay.value = "none";
    await layoutAll();
    await selectService(id);
  }

  async function hideService(id: string): Promise<void> {
    const service = services.value.find((item) => item.id === id);
    if (!service?.builtin) {
      return;
    }
    if (services.value.length <= 1) {
      showToast("至少保留一个服务");
      return;
    }
    if (panesLocked.value && visibleServiceIds.value.has(id)) {
      showToast("分屏已锁定，请先解锁再改各栏网页");
      return;
    }

    applyServiceLists(
      enabledIds.value.filter((item) => item !== id),
      customServices.value,
    );
    await persistServices();
    await leaveServicePane(id);
  }

  async function removeService(id: string): Promise<void> {
    const service = services.value.find((item) => item.id === id);
    if (!service || service.builtin) {
      return;
    }
    if (services.value.length <= 1) {
      showToast("至少保留一个服务");
      return;
    }
    if (panesLocked.value && visibleServiceIds.value.has(id)) {
      showToast("分屏已锁定，请先解锁再改各栏网页");
      return;
    }

    const tabs = tabsByService.value[id] ?? [];
    await closeWebviews(tabs.map((tab) => tab.label));

    const nextTabs = { ...tabsByService.value };
    delete nextTabs[id];
    tabsByService.value = nextTabs;

    applyServiceLists(
      enabledIds.value,
      customServices.value.filter((item) => item.id !== id),
    );
    await persistServices();
    await leaveServicePane(id);
  }

  async function navigateTab(label: string, action: NavAction): Promise<void> {
    if (!webviews.has(label)) {
      if (action === "reload") {
        await selectTab(label);
      }
      return;
    }

    try {
      await invoke("navigate_content_webview", { label, action });
      scheduleHistoryRefresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "页面导航失败",
      );
    }
  }

  async function goBack(label: string): Promise<void> {
    const history = historyByLabel.value[label];
    if (!history?.canGoBack) {
      return;
    }
    await navigateTab(label, "back");
  }

  async function goForward(label: string): Promise<void> {
    const history = historyByLabel.value[label];
    if (!history?.canGoForward) {
      return;
    }
    await navigateTab(label, "forward");
  }

  async function reloadTab(label: string): Promise<void> {
    await navigateTab(label, "reload");
  }

  async function stopTab(label: string): Promise<void> {
    await navigateTab(label, "stop");
  }

  async function applyZoomToLabel(label: string): Promise<void> {
    const serviceId = serviceIdFromWebviewLabel(label);
    const factor = zoomByService.value[serviceId] ?? 1;
    try {
      await invoke("set_content_zoom", { label, factor });
    } catch {
      // 页面尚未就绪时忽略
    }
  }

  async function persistZoom(): Promise<void> {
    await saveZoomByService(zoomByService.value);
  }

  async function applyZoomToService(serviceId: string): Promise<void> {
    await Promise.all(
      [...webviews.keys()]
        .filter((label) => serviceIdFromWebviewLabel(label) === serviceId)
        .map((label) => applyZoomToLabel(label)),
    );
  }

  async function setServiceZoom(serviceId: string, value: number): Promise<void> {
    const next = clampZoom(value);
    const zoom = { ...zoomByService.value };
    if (next === 1) {
      delete zoom[serviceId];
    } else {
      zoom[serviceId] = next;
    }
    zoomByService.value = zoom;
    await persistZoom();
    await applyZoomToService(serviceId);
    showToast(`${Math.round(next * 100)}%`);
  }

  async function zoomBy(delta: number): Promise<void> {
    const id = activeId.value;
    if (!id) {
      return;
    }
    await setServiceZoom(id, (zoomByService.value[id] ?? 1) + delta);
  }

  async function zoomIn(): Promise<void> {
    await zoomBy(ZOOM_STEP);
  }

  async function zoomOut(): Promise<void> {
    await zoomBy(-ZOOM_STEP);
  }

  async function zoomReset(): Promise<void> {
    const id = activeId.value;
    if (!id) {
      return;
    }
    await setServiceZoom(id, 1);
  }

  function focusedTab(): ContentTab | undefined {
    const pane = paneViews.value[focusedPaneIndex.value];
    return pane?.tabs.find((tab) => tab.label === pane.tabLabel);
  }

  function urlForService(id: string): string {
    const pane = panes.value.find((item) => item.serviceId === id);
    if (pane) {
      const tabs = tabsByService.value[id] ?? [];
      const label = lastTabByService.value[id] ?? webviewLabel(id);
      const tab = tabs.find((item) => item.label === label);
      if (tab?.url) {
        return tab.url;
      }
    }
    return services.value.find((service) => service.id === id)?.url ?? "";
  }

  async function copyUrl(url: string): Promise<void> {
    if (!url) {
      return;
    }
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(url);
    showToast("已复制链接");
  }

  async function openInBrowser(url: string): Promise<void> {
    if (!url) {
      return;
    }
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  }

  async function copyActiveUrl(): Promise<void> {
    await copyUrl(focusedTab()?.url ?? "");
  }

  async function openActiveInBrowser(): Promise<void> {
    await openInBrowser(focusedTab()?.url ?? "");
  }

  async function closeActiveTab(): Promise<void> {
    const tab = focusedTab();
    if (!tab) {
      return;
    }
    if (!tab.closable) {
      showToast("首页标签不可关闭");
      return;
    }
    await closeTab(tab.label);
  }

  async function reorderServices(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) {
      return;
    }
    const ids = services.value.map((service) => service.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) {
      return;
    }
    ids.splice(from, 1);
    ids.splice(to, 0, fromId);
    applyServiceLists(enabledIds.value, customServices.value, ids);
    await persistServices();
  }

  async function reorderLayouts(fromId: string, toId: string): Promise<void> {
    if (fromId === toId) {
      return;
    }
    const from = savedLayouts.value.findIndex((layout) => layout.id === fromId);
    const to = savedLayouts.value.findIndex((layout) => layout.id === toId);
    if (from < 0 || to < 0) {
      return;
    }
    const next = [...savedLayouts.value];
    const [item] = next.splice(from, 1);
    if (!item) {
      return;
    }
    next.splice(to, 0, item);
    savedLayouts.value = next;
    await persistLayouts();
  }

  async function handleMenuAction(id: string): Promise<void> {
    if (id.startsWith("popup:")) {
      return;
    }
    const label = paneViews.value[focusedPaneIndex.value]?.tabLabel ?? "";
    switch (id) {
      case "settings":
        await setOverlay("settings");
        return;
      case "manage":
        await setOverlay("manage");
        return;
      case "toggle-sidebar":
        await toggleSidebar();
        return;
      case "split":
        await splitPane();
        return;
      case "back":
        await goBack(label);
        return;
      case "forward":
        await goForward(label);
        return;
      case "reload":
        await reloadTab(label);
        return;
      case "stop":
        await stopTab(label);
        return;
      case "close-tab":
        await closeActiveTab();
        return;
      case "zoom-in":
        await zoomIn();
        return;
      case "zoom-out":
        await zoomOut();
        return;
      case "zoom-reset":
        await zoomReset();
        return;
      case "copy-url":
        await copyActiveUrl();
        return;
      case "open-browser":
        await openActiveInBrowser();
        return;
      default:
        break;
    }
    if (id.startsWith("service-")) {
      const index = Number(id.slice("service-".length)) - 1;
      const service = services.value[index];
      if (service) {
        if (overlay.value !== "none") {
          await setOverlay("none");
        }
        await selectService(service.id);
      }
    }
  }

  async function setPanesLocked(locked: boolean): Promise<void> {
    if (panes.value.length < 2) {
      return;
    }
    panesLocked.value = locked;
    if (locked && !activeLayoutId.value) {
      await saveCurrentLayout();
      if (!activeLayoutId.value) {
        panesLocked.value = false;
      }
      return;
    }
    await persistPanes();
  }

  async function saveCurrentLayout(): Promise<void> {
    const serviceIds = currentPaneServiceIds();
    if (serviceIds.length < 2) {
      return;
    }

    const existing = savedLayouts.value.find((layout) =>
      sameServiceIds(layout.serviceIds, serviceIds),
    );
    if (existing) {
      activeLayoutId.value = existing.id;
      await persistPanes();
      return;
    }

    if (savedLayouts.value.length >= MAX_SAVED_LAYOUTS) {
      showToast(`最多固定 ${MAX_SAVED_LAYOUTS} 个分屏`);
      return;
    }

    const layout: SavedLayout = {
      id: createLayoutId(),
      name: layoutNameFromIds(serviceIds, services.value),
      serviceIds,
      ratios: [...paneRatios.value],
      locked: panesLocked.value,
    };
    savedLayouts.value = [...savedLayouts.value, layout];
    activeLayoutId.value = layout.id;
    await persistLayouts();
  }

  async function applyLayout(id: string): Promise<void> {
    const layout = savedLayouts.value.find((item) => item.id === id);
    if (!layout) {
      return;
    }

    const unique: string[] = [];
    for (const serviceId of layout.serviceIds) {
      if (
        services.value.some((service) => service.id === serviceId) &&
        !unique.includes(serviceId) &&
        unique.length < MAX_PANES
      ) {
        unique.push(serviceId);
      }
    }
    if (unique.length < 2) {
      showToast("该分屏已失效，请删除后重新固定");
      return;
    }

    if (
      activeLayoutId.value === layout.id &&
      sameServiceIds(currentPaneServiceIds(), unique) &&
      panesLocked.value === layout.locked
    ) {
      if (overlay.value !== "none") {
        await setOverlay("none");
      }
      return;
    }

    if (overlay.value !== "none") {
      overlay.value = "none";
    }

    const lastFocused = panes.value[focusedPaneIndex.value]?.serviceId ?? "";
    activeLayoutId.value = layout.id;
    panesLocked.value = layout.locked;
    panes.value = unique.map((serviceId) => ({
      id: createPaneId(),
      serviceId,
    }));
    paneRatios.value =
      layout.ratios.length === unique.length
        ? normalizeRatios(layout.ratios)
        : equalRatios(unique.length);
    focusedPaneIndex.value = unique.includes(lastFocused)
      ? unique.indexOf(lastFocused)
      : 0;
    await persistPanes();
    await ensurePaneWebviews();
    await layoutAll();
    await focusPane(focusedPaneIndex.value);
  }

  async function renameLayout(id: string, raw: string): Promise<void> {
    const current = savedLayouts.value.find((layout) => layout.id === id);
    if (!current) {
      return;
    }
    const fallback =
      layoutNameFromIds(current.serviceIds, services.value) || current.name;
    const name = sanitizeLayoutName(raw, fallback);
    if (name === current.name) {
      return;
    }
    savedLayouts.value = savedLayouts.value.map((layout) =>
      layout.id === id ? { ...layout, name } : layout,
    );
    await persistLayouts();
  }

  async function removeLayout(id: string): Promise<void> {
    savedLayouts.value = savedLayouts.value.filter((layout) => layout.id !== id);
    if (activeLayoutId.value === id) {
      activeLayoutId.value = "";
    }
    await persistLayouts();
  }

  async function toggleLayoutLock(id: string): Promise<void> {
    const layout = savedLayouts.value.find((item) => item.id === id);
    if (!layout) {
      return;
    }
    const locked = !layout.locked;
    savedLayouts.value = savedLayouts.value.map((item) =>
      item.id === id ? { ...item, locked } : item,
    );
    if (activeLayoutId.value === id && panes.value.length >= 2) {
      panesLocked.value = locked;
    }
    await persistLayouts();
  }

  function restorePanes(
    savedIds: string[],
    savedRatios: number[],
    lastActiveId: string,
  ): void {
    const validIds: string[] = [];
    for (const id of savedIds) {
      if (
        validIds.length < MAX_PANES &&
        !validIds.includes(id) &&
        services.value.some((service) => service.id === id)
      ) {
        validIds.push(id);
      }
    }
    if (validIds.length === 0) {
      validIds.push(lastActiveId);
    }

    panes.value = validIds.map((serviceId) => ({
      id: createPaneId(),
      serviceId,
    }));
    paneRatios.value =
      savedRatios.length === validIds.length
        ? normalizeRatios(savedRatios)
        : equalRatios(validIds.length);

    const focused = validIds.indexOf(lastActiveId);
    focusedPaneIndex.value = focused >= 0 ? focused : 0;
  }

  onMounted(async () => {
    try {
      const state = await loadWorkspaceState();
      enabledIds.value = state.enabledServiceIds;
      services.value = state.services;
      serviceOrder.value = state.serviceOrder;
      sidebarCollapsed.value = state.sidebarCollapsed;
      zoomByService.value = state.zoomByService;
      savedLayouts.value = state.savedLayouts;
      const hasSaved = state.services.some(
        (service) => service.id === state.lastActiveId,
      );
      const lastActiveId = hasSaved
        ? state.lastActiveId
        : state.services[0].id;
      restorePanes(state.paneServiceIds, state.paneRatios, lastActiveId);
      const restoredLayout = state.savedLayouts.find(
        (layout) => layout.id === state.activeLayoutId,
      );
      if (restoredLayout && panes.value.length >= 2) {
        activeLayoutId.value = restoredLayout.id;
        panesLocked.value = restoredLayout.locked;
      } else {
        activeLayoutId.value = "";
        panesLocked.value = state.panesLocked && panes.value.length > 1;
      }

      await layoutShell();
      windowSize.value = await getLogicalWindowSize();

      const currentWindow = getCurrentWindow();
      unlisteners.push(
        await currentWindow.onResized(() => {
          scheduleLayout(true);
        }),
      );
      if (typeof currentWindow.onScaleChanged === "function") {
        unlisteners.push(
          await currentWindow.onScaleChanged(() => {
            scheduleLayout(true);
          }),
        );
      }
      unlisteners.push(
        await listen<ContentPagePayload>("content-page-state", (event) => {
          const current = historyQuerySeq.get(event.payload.label) ?? 0;
          historyQuerySeq.set(event.payload.label, current + 1);
          applyPageState(event.payload);
        }),
      );
      unlisteners.push(
        await listen<OpenTabPayload>("content-open-tab", (event) => {
          void handleOpenTab(event.payload);
        }),
      );
      historyPollTimer = window.setInterval(() => {
        void refreshVisibleHistory();
      }, HISTORY_POLL_MS);

      await ensurePaneWebviews();
      await layoutAll(false);
      await focusPane(focusedPaneIndex.value);
      ready.value = true;
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "工作区初始化失败",
      );
      ready.value = true;
    }
  });

  onUnmounted(() => {
    window.clearInterval(historyPollTimer);
    window.clearTimeout(historyDelayTimer);
    if (layoutRaf) {
      window.cancelAnimationFrame(layoutRaf);
    }
    for (const unlisten of unlisteners) {
      unlisten();
    }
  });

  return {
    services,
    customServices,
    enabledIds,
    panes,
    paneViews,
    focusedPaneIndex,
    activeId,
    visibleServiceIds,
    openedServiceIds,
    savedLayouts,
    layoutItems,
    activeLayoutId,
    panesLocked,
    toastMessage,
    showToast,
    ready,
    resizing,
    overlay,
    managing,
    settingsOpen,
    sidebarCollapsed,
    sidebarWidth,
    unusedServices,
    canSplit,
    canClosePane,
    canSaveLayout,
    currentLayoutSaved,
    focusedZoom,
    setOverlay,
    setManaging,
    toggleSidebar,
    selectService,
    selectTab,
    closeTab,
    closeServicePages,
    addService,
    updateService,
    enableService,
    hideService,
    removeService,
    goBack,
    goForward,
    reloadTab,
    stopTab,
    zoomIn,
    zoomOut,
    zoomReset,
    copyUrl,
    openInBrowser,
    copyActiveUrl,
    openActiveInBrowser,
    urlForService,
    closeActiveTab,
    reorderServices,
    reorderLayouts,
    handleMenuAction,
    splitPaneWith,
    focusPane,
    splitPane,
    closePane,
    openInNewPane,
    startPaneResize,
    updatePaneResize,
    endPaneResize,
    setPanesLocked,
    saveCurrentLayout,
    applyLayout,
    renameLayout,
    removeLayout,
    toggleLayoutLock,
  };
}
