<script setup lang="ts">
import { computed } from "vue";
import ServiceIcon from "./components/ServiceIcon.vue";
import ServiceManager from "./components/ServiceManager.vue";
import TabBar from "./components/TabBar.vue";
import { useWorkspace } from "./composables/useWorkspace";
import { SIDEBAR_WIDTH, SPLITTER_WIDTH } from "./types";

const {
  services,
  customServices,
  enabledIds,
  paneViews,
  activeId,
  visibleServiceIds,
  layoutItems,
  panesLocked,
  errorMessage,
  managing,
  canSplit,
  canClosePane,
  canSaveLayout,
  currentLayoutSaved,
  setManaging,
  selectService,
  selectTab,
  closeTab,
  addService,
  updateService,
  enableService,
  hideService,
  removeService,
  goBack,
  goForward,
  reloadTab,
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
  removeLayout,
  toggleLayoutLock,
} = useWorkspace();

const headerTitle = computed(() => {
  if (managing.value) {
    return "管理服务";
  }
  const activeLayout = layoutItems.value.find((layout) => layout.active);
  if (activeLayout) {
    return activeLayout.name;
  }
  return paneViews.value
    .map(
      (pane) =>
        services.value.find((service) => service.id === pane.serviceId)?.name,
    )
    .filter((name): name is string => Boolean(name))
    .join(" · ");
});

async function handleSelect(id: string, event: MouseEvent): Promise<void> {
  if (managing.value) {
    await setManaging(false);
  }
  if (event.metaKey || event.ctrlKey) {
    await openInNewPane(id);
    return;
  }
  await selectService(id);
}

async function handleRemove(id: string): Promise<void> {
  await removeService(id);
}

async function handleAdd(
  name: string,
  url: string,
  logoSrc?: string,
): Promise<void> {
  try {
    await addService(name, url, logoSrc);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "添加失败";
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
    errorMessage.value = error instanceof Error ? error.message : "保存失败";
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
</script>

<template>
  <div class="h-full w-full flex bg-sidebar text-text">
    <aside
      class="h-full shrink-0 flex flex-col select-none border-r border-line"
      :style="{ width: `${SIDEBAR_WIDTH}px` }"
    >
      <header
        class="pt-13 px-4 pb-3 border-b border-line"
        data-tauri-drag-region
      >
        <p class="text-xs tracking-wide text-muted" data-tauri-drag-region>
          AI Workspace
        </p>
        <h1 class="mt-2 text-sm font-semibold truncate" data-tauri-drag-region>
          {{ headerTitle || "选择服务" }}
        </h1>
      </header>

      <nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="AI 服务">
        <button
          v-for="service in services"
          :key="service.id"
          type="button"
          class="group w-full h-10 mb-1 px-2 rounded-lg flex items-center gap-3 text-left cursor-pointer transition-colors bg-transparent"
          :class="
            service.id === activeId && !managing
              ? 'bg-active text-text'
              : visibleServiceIds.has(service.id)
                ? 'bg-white/5 text-text'
                : 'text-text/85 hover:bg-white/5'
          "
          @click="handleSelect(service.id, $event)"
        >
          <ServiceIcon :service="service" :size="20" />
          <span class="flex-1 truncate text-sm">{{ service.name }}</span>
          <button
            v-if="canSplit && !visibleServiceIds.has(service.id)"
            type="button"
            class="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-text cursor-pointer"
            aria-label="分屏打开"
            title="分屏打开"
            @click.stop="openInNewPane(service.id)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" />
              <path d="M8 3v10" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </button>
          <button
            v-if="!service.builtin"
            type="button"
            class="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-danger cursor-pointer"
            aria-label="删除服务"
            title="删除"
            @click.stop="handleRemove(service.id)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3 3l6 6M9 3L3 9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </button>

        <section
          v-if="canSaveLayout || layoutItems.length > 0"
          class="mt-3 pt-3 border-t border-line"
          aria-label="固定分屏"
        >
          <p class="px-2 mb-2 text-[11px] tracking-wide text-muted">分屏</p>
          <button
            v-if="canSaveLayout && !currentLayoutSaved"
            type="button"
            class="w-full h-9 mb-1 px-2 rounded-lg flex items-center gap-3 text-left text-sm text-muted hover:text-text hover:bg-white/5 cursor-pointer"
            @click="saveCurrentLayout"
          >
            <span
              class="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-text/80"
              aria-hidden="true"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 2v8M2 6h8"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            <span class="truncate">固定当前分屏</span>
          </button>
          <div
            v-for="layout in layoutItems"
            :key="layout.id"
            role="button"
            tabindex="0"
            class="group w-full h-10 mb-1 px-2 rounded-lg flex items-center gap-3 text-left cursor-pointer transition-colors bg-transparent"
            :class="
              layout.active && !managing
                ? 'bg-active text-text'
                : 'text-text/85 hover:bg-white/5'
            "
            :title="layout.locked ? '已锁定：点其他服务可离开，再点此项回来' : layout.name"
            @click="applyLayout(layout.id)"
            @keydown.enter.prevent="applyLayout(layout.id)"
          >
            <span class="relative h-5 w-7 shrink-0" aria-hidden="true">
              <span
                v-for="(service, index) in layout.services.slice(0, 3)"
                :key="service.id"
                class="absolute top-0"
                :style="{
                  left: `${index * 7}px`,
                  zIndex: index + 1,
                }"
              >
                <ServiceIcon :service="service" :size="20" />
              </span>
            </span>
            <span class="flex-1 min-w-0 truncate text-sm">{{ layout.name }}</span>
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-md cursor-pointer"
              :class="
                layout.locked
                  ? 'text-text'
                  : 'text-muted opacity-0 group-hover:opacity-100 hover:text-text'
              "
              :aria-label="layout.locked ? '解锁分屏' : '锁定分屏'"
              :title="layout.locked ? '解锁后可修改各栏网页' : '锁定后点其他服务可离开，再点此项回来'"
              @click.stop="toggleLayoutLock(layout.id)"
            >
              <svg
                v-if="layout.locked"
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                <path d="M5.5 7V5.2A2.5 2.5 0 0 1 10.5 5.2V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
              <svg
                v-else
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.5" />
                <path d="M5.5 7V5.2A2.5 2.5 0 0 1 8 2.7 2.5 2.5 0 0 1 10.5 5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              class="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-md text-muted hover:text-danger cursor-pointer"
              aria-label="删除分屏"
              title="从侧栏移除"
              @click.stop="removeLayout(layout.id)"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M3 3l6 6M9 3L3 9"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        </section>
      </nav>

      <p v-if="errorMessage" class="px-4 pb-2 text-xs text-danger">
        {{ errorMessage }}
      </p>

      <footer class="border-t border-line p-3">
        <button
          type="button"
          class="w-full h-9 rounded-md text-sm cursor-pointer"
          :class="
            managing
              ? 'bg-active text-text'
              : 'text-muted hover:text-text hover:bg-white/5'
          "
          @click="setManaging(!managing)"
        >
          {{ managing ? "返回网页" : "管理" }}
        </button>
      </footer>
    </aside>

    <section class="flex-1 min-w-0 h-full flex overflow-hidden">
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
        @remove="handleRemove"
        @close="setManaging(false)"
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
              :focused="pane.focused"
              :can-split="canSplit"
              :can-close-pane="canClosePane"
              :locked="panesLocked"
              @back="goBack(pane.tabLabel)"
              @forward="goForward(pane.tabLabel)"
              @reload="reloadTab(pane.tabLabel)"
              @select="selectTab"
              @close="closeTab"
              @focus="focusPane(pane.index, false)"
              @split="splitPane(pane.index)"
              @close-pane="closePane(pane.index)"
              @toggle-lock="setPanesLocked(!panesLocked)"
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
              class="w-px h-full bg-line group-hover:bg-white/35 group-active:bg-white/50"
            />
          </div>
        </template>
      </template>
    </section>
  </div>
</template>
