<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import ServiceIcon from "./components/ServiceIcon.vue";
import ServiceManager from "./components/ServiceManager.vue";
import SettingsPage from "./components/SettingsPage.vue";
import TabBar from "./components/TabBar.vue";
import { usePointerReorder } from "./composables/usePointerReorder";
import { useTheme } from "./composables/useTheme";
import { useWorkspace } from "./composables/useWorkspace";
import { onMenuAction, popupPointFromEvent, popupSeparator, showPopup, type PopupPoint } from "./lib/menu";
import { MAX_LAYOUT_NAME, SPLITTER_WIDTH } from "./types";

const {
  services,
  customServices,
  enabledIds,
  paneViews,
  activeId,
  visibleServiceIds,
  openedServiceIds,
  layoutItems,
  panesLocked,
  toastMessage,
  showToast,
  overlay,
  managing,
  settingsOpen,
  sidebarCollapsed,
  sidebarWidth,
  canSplit,
  canClosePane,
  canSaveLayout,
  currentLayoutSaved,
  focusedZoom,
  findQuery,
  findResult,
  findError,
  findFocusToken,
  addressFocus,
  openFind,
  closeFind,
  findText,
  updateFindQuery,
  returnToSource,
  restoreClosedTab,
  copyPageUrl,
  openPageInBrowser,
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
  urlForService,
  reorderServices,
  reorderLayouts,
  handleMenuAction,
  focusPane,
  splitPane,
  splitPaneWith,
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
} = useWorkspace();

const { themeMode, setThemeMode } = useTheme();
const {
  dragId,
  dropId,
  dragging,
  consumeClick,
  begin: beginReorder,
  move: moveReorder,
  finish: finishReorder,
} = usePointerReorder();
const renamingId = ref("");
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement | null>(null);
let unlistenMenu: (() => void) | undefined;

const version = "0.1.0";

onMounted(async () => {
  unlistenMenu = await onMenuAction((id) => {
    void handleMenuAction(id);
  });
});

onUnmounted(() => {
  unlistenMenu?.();
});

async function handleSelect(id: string, event: MouseEvent): Promise<void> {
  if (overlay.value !== "none") {
    await setOverlay("none");
  }
  if (event.metaKey || event.ctrlKey) {
    await openInNewPane(id);
    return;
  }
  await selectService(id);
}

async function confirmRemove(id: string): Promise<void> {
  const { ask } = await import("@tauri-apps/plugin-dialog");
  const service = services.value.find((item) => item.id === id);
  const ok = await ask(`删除「${service?.name ?? "该服务"}」？`, {
    kind: "warning",
    title: "删除服务",
  });
  if (ok) {
    await removeService(id);
  }
}

async function handleAdd(
  name: string,
  url: string,
  logoSrc?: string,
): Promise<void> {
  try {
    await addService(name, url, logoSrc);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "添加失败");
  }
}

async function handleUpdate(
  id: string,
  name: string,
  url: string,
  logoSrc?: string,
): Promise<void> {
  try {
    await updateService(id, name, url, logoSrc);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "保存失败");
  }
}

function onSplitterPointerDown(index: number, event: PointerEvent): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    target.setPointerCapture(event.pointerId);
  }
  startPaneResize(index, event.clientX);
}

function onSplitterPointerMove(event: PointerEvent): void {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement) || !target.hasPointerCapture(event.pointerId)) {
    return;
  }
  updatePaneResize(event.clientX);
}

async function onSplitterPointerUp(event: PointerEvent): Promise<void> {
  const target = event.currentTarget;
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  await endPaneResize();
}

async function onServiceClick(id: string, event: MouseEvent): Promise<void> {
  if (consumeClick()) {
    return;
  }
  await handleSelect(id, event);
}

function onLayoutClick(id: string): void {
  if (consumeClick()) {
    return;
  }
  if (renamingId.value === id) {
    return;
  }
  void applyLayout(id);
}

async function commitReorder(kind: string, from: string, to: string): Promise<void> {
  if (kind === "layout") {
    await reorderLayouts(from, to);
    return;
  }
  await reorderServices(from, to);
}

function onServicePointerDown(id: string, event: PointerEvent): void {
  beginReorder("service", id, event);
}

function onLayoutPointerDown(id: string, event: PointerEvent): void {
  if (renamingId.value === id) {
    return;
  }
  beginReorder("layout", id, event);
}

function onServicePointerMove(event: PointerEvent): void {
  moveReorder(event, "data-service-id");
}

function onLayoutPointerMove(event: PointerEvent): void {
  moveReorder(event, "data-layout-id");
}

async function onReorderPointerUp(event: PointerEvent): Promise<void> {
  await finishReorder(event, commitReorder);
}

function setRenameInput(el: unknown): void {
  renameInput.value = el instanceof HTMLInputElement ? el : null;
}

async function startRename(id: string): Promise<void> {
  if (rail.value) {
    showToast("请先展开侧栏再改名称");
    return;
  }
  const layout = layoutItems.value.find((item) => item.id === id);
  if (!layout) {
    return;
  }
  renamingId.value = id;
  renameDraft.value = layout.name;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

async function commitRename(): Promise<void> {
  const id = renamingId.value;
  if (!id) {
    return;
  }
  const draft = renameDraft.value;
  renamingId.value = "";
  await renameLayout(id, draft);
}

function cancelRename(): void {
  renamingId.value = "";
}

async function onLayoutContext(id: string, event: MouseEvent): Promise<void> {
  event.preventDefault();
  const layout = layoutItems.value.find((item) => item.id === id);
  if (!layout) {
    return;
  }
  const items = [
    {
      id: `popup:rename-layout:${id}`,
      text: "重命名",
      enabled: !rail.value,
    },
    {
      id: `popup:lock-layout:${id}`,
      text: layout.locked ? "解锁分屏" : "锁定分屏",
    },
    popupSeparator(),
    { id: `popup:remove-layout:${id}`, text: "删除" },
  ];
  const picked = await showPopup(items, popupPointFromEvent(event));
  if (picked === `popup:rename-layout:${id}`) {
    await startRename(id);
    return;
  }
  if (picked === `popup:lock-layout:${id}`) {
    await toggleLayoutLock(id);
    return;
  }
  if (picked === `popup:remove-layout:${id}`) {
    await removeLayout(id);
  }
}

async function onServiceContext(id: string, event: MouseEvent): Promise<void> {
  event.preventDefault();
  const service = services.value.find((item) => item.id === id);
  if (!service) {
    return;
  }
  const opened = openedServiceIds.value.has(id);
  const visible = visibleServiceIds.value.has(id);
  const items = [
    {
      id: `popup:split:${id}`,
      text: "分屏打开",
      enabled: canSplit.value && !visible,
    },
    {
      id: `popup:close-pages:${id}`,
      text: "关闭页面以释放内存",
      enabled: opened && !(panesLocked.value && visible),
    },
    popupSeparator(),
    { id: `popup:copy:${id}`, text: "复制链接" },
    { id: `popup:browser:${id}`, text: "在浏览器中打开" },
    popupSeparator(),
  ];
  if (service.builtin) {
    items.push({
      id: `popup:hide:${id}`,
      text: "移出侧栏",
      enabled: services.value.length > 1,
    });
  } else {
    items.push({ id: `popup:edit:${id}`, text: "编辑" });
    items.push({
      id: `popup:remove:${id}`,
      text: "删除",
      enabled: services.value.length > 1,
    });
  }

  const picked = await showPopup(items, popupPointFromEvent(event));
  if (!picked) {
    return;
  }
  if (picked === `popup:split:${id}`) {
    await splitPaneWith(id);
    return;
  }
  if (picked === `popup:close-pages:${id}`) {
    await closeServicePages(id);
    return;
  }
  if (picked === `popup:copy:${id}`) {
    await copyUrl(urlForService(id));
    return;
  }
  if (picked === `popup:browser:${id}`) {
    await openInBrowser(urlForService(id));
    return;
  }
  if (picked === `popup:hide:${id}`) {
    await hideService(id);
    return;
  }
  if (picked === `popup:edit:${id}`) {
    await setOverlay("manage");
    return;
  }
  if (picked === `popup:remove:${id}`) {
    await confirmRemove(id);
  }
}

async function onTabMore(paneIndex: number, point?: PopupPoint): Promise<void> {
  const pane = paneViews.value[paneIndex];
  if (!pane) {
    return;
  }
  await focusPane(paneIndex, false);
  const tab = pane.tabs.find((item) => item.label === pane.tabLabel);
  const percent = Math.round(focusedZoom.value * 100);
  const items = [
    { id: "popup:return-source", text: "返回来源页面", enabled: Boolean(tab?.closable) },
    { id: "popup:find", text: "查找页面内容…（⌘F）" },
    { id: "popup:restore", text: "恢复关闭的标签（⌘⇧T）" },
    popupSeparator(),
    { id: "popup:copy-url", text: "复制链接（⌘⇧C）" },
    { id: "popup:open-browser", text: "在浏览器中打开" },
    popupSeparator(),
    { id: "popup:zoom-in", text: "放大" },
    { id: "popup:zoom-out", text: "缩小" },
    { id: "popup:zoom-reset", text: `实际大小（${percent}%）` },
    popupSeparator(),
  ];
  if (canClosePane.value) {
    items.push({
      id: "popup:toggle-lock",
      text: panesLocked.value ? "解锁分屏" : "锁定分屏",
    });
  }
  items.push({
    id: "popup:close-service",
    text: "关闭本服务页面",
    enabled: !(panesLocked.value && visibleServiceIds.value.has(pane.serviceId)),
  });

  let picked: string | null = null;
  try {
    picked = await showPopup(items, point);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "打开菜单失败");
    return;
  }
  if (!picked) {
    return;
  }
  if (picked === "popup:copy-url" && tab?.url) {
    await copyPageUrl(tab.label);
    return;
  }
  if (picked === "popup:open-browser" && tab?.url) {
    await openPageInBrowser(tab.label);
    return;
  }
  if (picked === "popup:return-source" && tab) { await returnToSource(tab.label); return; }
  if (picked === "popup:find") { await openFind(); return; }
  if (picked === "popup:restore") { await restoreClosedTab(); return; }
  if (picked === "popup:zoom-in") {
    await zoomIn();
    return;
  }
  if (picked === "popup:zoom-out") {
    await zoomOut();
    return;
  }
  if (picked === "popup:zoom-reset") {
    await zoomReset();
    return;
  }
  if (picked === "popup:toggle-lock") {
    await setPanesLocked(!panesLocked.value);
    return;
  }
  if (picked === "popup:close-service") {
    await closeServicePages(pane.serviceId);
  }
}

async function onTabContext(paneIndex: number, label: string, point: PopupPoint): Promise<void> {
  const pane = paneViews.value[paneIndex];
  if (!pane) return;
  await focusPane(paneIndex, false);
  const index = pane.tabs.findIndex(tab => tab.label === label);
  const tab = pane.tabs[index];
  if (!tab) return;
  const picked = await showPopup([
    { id: "popup:tab-close", text: "关闭标签", enabled: tab.closable },
    { id: "popup:tab-others", text: "关闭其他浏览标签", enabled: pane.tabs.some(item => item.closable && item.label !== label) },
    { id: "popup:tab-right", text: "关闭右侧标签", enabled: index < pane.tabs.length - 1 },
    popupSeparator(),
    { id: "popup:tab-source", text: "返回来源页面", enabled: tab.closable },
    { id: "popup:tab-copy", text: "复制链接" },
    { id: "popup:tab-browser", text: "在系统浏览器打开" },
  ], point);
  if (picked === "popup:tab-close") await closeTab(label);
  if (picked === "popup:tab-source") await returnToSource(label);
  if (picked === "popup:tab-copy") await copyPageUrl(label);
  if (picked === "popup:tab-browser") await openPageInBrowser(label);
  if (picked === "popup:tab-others" || picked === "popup:tab-right") {
    const targets = pane.tabs.filter((item, i) => item.closable && (picked === "popup:tab-others" ? item.label !== label : i > index));
    for (const item of targets) await closeTab(item.label);
    await selectTab(label);
  }
}

const rail = computed(() => sidebarCollapsed.value);
</script>

<template>
  <div
    class="relative h-full w-full flex bg-sidebar text-text"
    :class="dragging ? 'cursor-grabbing' : ''"
  >
    <aside
      class="h-full shrink-0 flex flex-col select-none border-r border-line px-1"
      :style="{ width: `${sidebarWidth}px` }"
    >
      <div
        class="h-12 shrink-0"
        data-tauri-drag-region
      />

      <nav class="flex-1 overflow-y-auto py-1" aria-label="AI 服务">
        <p
          v-if="!rail"
          class="px-2 pt-1 pb-1 text-12px text-muted"
        >
          服务
        </p>
        <button
          v-for="(service, index) in services"
          :key="service.id"
          type="button"
          :data-service-id="service.id"
          class="group relative w-full mb-0.5 rounded-lg flex items-center text-left cursor-pointer transition-colors"
          :class="[
            rail ? 'h-11 justify-center' : 'min-h-11 py-1 px-1 gap-2',
            service.id === activeId && overlay === 'none'
              ? 'is-current font-medium'
              : 'hover:bg-hover',
            dragId === service.id && dragging ? 'opacity-50' : '',
            dropId === service.id && dragId !== service.id ? 'ring-1 ring-accent' : '',
          ]"
          :title="service.name"
          :aria-current="service.id === activeId ? 'page' : undefined"
          @click="onServiceClick(service.id, $event)"
          @contextmenu="onServiceContext(service.id, $event)"
          @pointerdown="onServicePointerDown(service.id, $event)"
          @pointermove="onServicePointerMove"
          @pointerup="onReorderPointerUp"
          @pointercancel="onReorderPointerUp"
        >
          <span class="relative shrink-0">
            <ServiceIcon :service="service" :size="32" />
            <span
              v-if="openedServiceIds.has(service.id)"
              class="online-dot absolute -top-0.5 -right-0.5 size-3 rounded-full ring-2 ring-sidebar"
              title="页面已打开"
              aria-label="页面已打开"
            />
          </span>
          <span v-if="!rail" class="flex-1 min-w-0 flex flex-col gap-0.5">
            <span class="truncate text-14px leading-tight">{{ service.name }}</span>
            <span class="text-11px text-muted leading-none">
              {{ index < 9 ? `⌘${index + 1}` : "\u00a0" }}
            </span>
          </span>
          <button
            v-if="!rail && openedServiceIds.has(service.id)"
            type="button"
            class="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md text-muted hover:text-danger cursor-pointer"
            :disabled="panesLocked && visibleServiceIds.has(service.id)"
            :aria-label="`关闭 ${service.name} 页面`"
            title="关闭页面以释放内存"
            @click.stop="closeServicePages(service.id)"
          >
            <span class="i-lucide-x text-14px" />
          </button>
        </button>

        <section
          v-if="canSaveLayout || layoutItems.length > 0"
          class="mt-2 pt-2 border-t border-line"
          aria-label="固定分屏"
        >
          <p v-if="!rail" class="px-2 mb-1 text-12px text-muted">分屏</p>
          <button
            v-if="canSaveLayout && !currentLayoutSaved"
            type="button"
            class="w-full rounded-md flex items-center text-left text-muted hover:text-text hover:bg-hover cursor-pointer"
            :class="rail ? 'h-11 justify-center' : 'h-11 px-1 gap-2 text-14px'"
            title="固定当前分屏"
            @click="saveCurrentLayout"
          >
            <span class="i-lucide-plus text-16px" />
            <span v-if="!rail" class="truncate">固定当前分屏</span>
          </button>
          <div
            v-for="layout in layoutItems"
            :key="layout.id"
            role="button"
            tabindex="0"
            :data-layout-id="layout.id"
            class="group w-full mb-px px-1 rounded-md flex items-center text-left cursor-pointer transition-colors"
            :class="[
              rail ? 'h-11 justify-center' : 'min-h-11 py-1 gap-2',
              layout.active && overlay === 'none'
                ? 'is-current font-medium'
                : 'hover:bg-hover',
              dragId === layout.id && dragging ? 'opacity-50' : '',
              dropId === layout.id && dragId !== layout.id ? 'ring-1 ring-accent' : '',
            ]"
            :title="layout.locked ? '已锁定：点其他服务可离开，再点此项回来' : layout.name"
            @click="onLayoutClick(layout.id)"
            @dblclick.stop="startRename(layout.id)"
            @contextmenu="onLayoutContext(layout.id, $event)"
            @keydown.enter.prevent="onLayoutClick(layout.id)"
            @pointerdown="onLayoutPointerDown(layout.id, $event)"
            @pointermove="onLayoutPointerMove"
            @pointerup="onReorderPointerUp"
            @pointercancel="onReorderPointerUp"
          >
            <span class="relative h-8 w-11 shrink-0" aria-hidden="true">
              <span
                v-for="(service, index) in layout.services.slice(0, 3)"
                :key="service.id"
                class="absolute top-0"
                :style="{
                  left: `${index * 10}px`,
                  zIndex: index + 1,
                }"
              >
                <ServiceIcon :service="service" :size="28" />
              </span>
            </span>
            <input
              v-if="!rail && renamingId === layout.id"
              :ref="setRenameInput"
              v-model="renameDraft"
              class="flex-1 min-w-0 h-8 px-1 rounded-md bg-bg text-14px outline-none ring-1 ring-accent"
              :maxlength="MAX_LAYOUT_NAME"
              aria-label="分屏名称"
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.escape.prevent="cancelRename"
              @blur="commitRename"
            />
            <span
              v-else-if="!rail"
              class="flex-1 min-w-0 truncate text-14px"
            >{{ layout.name }}</span>
            <button
              v-if="!rail && renamingId !== layout.id"
              type="button"
              class="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md text-muted hover:text-text cursor-pointer"
              aria-label="重命名分屏"
              title="重命名"
              @click.stop="startRename(layout.id)"
            >
              <span class="i-lucide-pencil text-14px" />
            </button>
            <button
              v-if="!rail"
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded-md cursor-pointer"
              :class="
                layout.locked
                  ? 'text-text'
                  : 'text-muted opacity-0 group-hover:opacity-100 hover:text-text'
              "
              :aria-label="layout.locked ? '解锁分屏' : '锁定分屏'"
              :title="layout.locked ? '解锁后可修改各栏网页' : '锁定后点其他服务可离开，再点此项回来'"
              @click.stop="toggleLayoutLock(layout.id)"
            >
              <span
                :class="layout.locked ? 'i-lucide-lock' : 'i-lucide-unlock'"
                class="text-14px"
              />
            </button>
            <button
              v-if="!rail"
              type="button"
              class="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-md text-muted hover:text-danger cursor-pointer"
              aria-label="删除分屏"
              title="从侧栏移除"
              @click.stop="removeLayout(layout.id)"
            >
              <span class="i-lucide-x text-14px" />
            </button>
          </div>
        </section>
      </nav>

      <footer
        class="border-t border-line py-1.5"
        :class="rail ? 'flex flex-col items-center gap-1' : 'flex items-center gap-1 px-1'"
      >
        <button
          type="button"
          class="h-9 rounded-md inline-flex items-center justify-center whitespace-nowrap text-muted hover:text-text hover:bg-hover cursor-pointer"
          :class="[
            rail ? 'w-9' : 'flex-1 min-w-0 text-14px',
            managing ? 'bg-active text-text' : '',
          ]"
          :title="managing ? '返回网页' : '管理'"
          @click="setManaging(!managing)"
        >
          <span class="i-lucide-layout-grid text-18px" :class="rail ? '' : 'mr-1'" />
          <span v-if="!rail" class="truncate">{{ managing ? "返回" : "管理" }}</span>
        </button>
        <button
          type="button"
          class="h-9 rounded-md inline-flex items-center justify-center whitespace-nowrap text-muted hover:text-text hover:bg-hover cursor-pointer"
          :class="[
            rail ? 'w-9' : 'flex-1 min-w-0 text-14px',
            settingsOpen ? 'bg-active text-text' : '',
          ]"
          title="打开设置"
          aria-label="打开设置"
          @click="setOverlay(settingsOpen ? 'none' : 'settings')"
        >
          <span class="i-lucide-settings text-18px" :class="rail ? '' : 'mr-1'" />
          <span v-if="!rail" class="truncate">设置</span>
        </button>
        <button
          type="button"
          class="h-9 w-9 shrink-0 rounded-md inline-flex items-center justify-center text-muted hover:text-text hover:bg-hover cursor-pointer"
          :title="rail ? '展开侧栏' : '收起侧栏'"
          :aria-label="rail ? '展开侧栏' : '收起侧栏'"
          @click="toggleSidebar"
        >
          <span
            class="text-18px"
            :class="rail ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          />
        </button>
      </footer>
    </aside>

    <section class="relative flex-1 min-w-0 h-full flex overflow-hidden bg-bg">
      <div
        v-if="toastMessage"
        class="absolute top-1 right-2 z-20 pointer-events-none h-8 px-3 rounded-md bg-text text-sidebar text-13px flex items-center"
      >
        {{ toastMessage }}
      </div>
      <ServiceManager
        v-if="managing"
        :custom-services="customServices"
        :enabled-ids="enabledIds"
        :active-id="activeId"
        @open="enableService"
        @enable="enableService"
        @hide="hideService"
        @add="handleAdd"
        @update="handleUpdate"
        @remove="confirmRemove"
        @close="setManaging(false)"
      />
      <SettingsPage
        v-else-if="settingsOpen"
        :theme-mode="themeMode"
        :sidebar-collapsed="sidebarCollapsed"
        :version="version"
        @theme="setThemeMode"
        @toggle-sidebar="toggleSidebar"
        @close="setOverlay('none')"
        @open-github="openInBrowser('https://github.com/taopaox/ai-panel')"
      />
      <template v-else>
        <template v-for="(pane, index) in paneViews" :key="pane.id">
          <div
            class="h-full min-w-0 flex flex-col"
            :style="{ width: `${pane.width}px` }"
          >
            <TabBar
              :tabs="pane.tabs"
              :active-label="pane.tabLabel"
              :can-go-back="pane.canGoBack"
              :can-go-forward="pane.canGoForward"
              :loading="pane.loading"
              :focused="pane.focused"
              :can-split="canSplit"
              :can-close-pane="canClosePane"
              :locked="panesLocked"
              :zoom="pane.zoom"
              :error="pane.error"
              :find-open="pane.findOpen"
              :find-query="findQuery"
              :find-result="findResult"
              :find-error="findError"
              :find-focus-token="findFocusToken"
              :address-focus-token="addressFocus.label === pane.tabLabel ? addressFocus.token : 0"
              @source="returnToSource(pane.tabLabel)"
              @browser="openPageInBrowser(pane.tabLabel)"
              @copy="copyPageUrl(pane.tabLabel)"
              @find-query="updateFindQuery"
              @find="findText"
              @close-find="closeFind()"
              @context="(label, point) => onTabContext(pane.index, label, point)"
              @back="goBack(pane.tabLabel)"
              @forward="goForward(pane.tabLabel)"
              @reload="reloadTab(pane.tabLabel)"
              @stop="stopTab(pane.tabLabel)"
              @select="selectTab"
              @close="closeTab"
              @focus="focusPane(pane.index, false)"
              @split="splitPane(pane.index, $event)"
              @close-pane="closePane(pane.index)"
              @toggle-lock="setPanesLocked(!panesLocked)"
              @more="onTabMore(pane.index, $event)"
            />
            <div
              class="flex-1 pointer-events-none"
              :style="{ minHeight: 0 }"
              aria-hidden="true"
            />
          </div>
          <div
            v-if="index < paneViews.length - 1"
            class="h-full shrink-0 flex items-stretch justify-center cursor-col-resize touch-none group"
            :style="{ width: `${SPLITTER_WIDTH}px` }"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整分屏宽度"
            @pointerdown.prevent="onSplitterPointerDown(index, $event)"
            @pointermove="onSplitterPointerMove"
            @pointerup="onSplitterPointerUp"
            @pointercancel="onSplitterPointerUp"
          >
            <div
              class="w-px h-full bg-line group-hover:bg-muted group-active:bg-text"
            />
          </div>
        </template>
      </template>
    </section>
  </div>
</template>
