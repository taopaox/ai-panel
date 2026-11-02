<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { popupPointFromEvent, type PopupPoint } from "../lib/menu";
import { TAB_BAR_HEIGHT, type ContentTab } from "../types";

const props = defineProps<{
  tabs: ContentTab[];
  activeLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  focused: boolean;
  canSplit: boolean;
  canClosePane: boolean;
  locked: boolean;
  zoom: number;
  error: string;
  findOpen: boolean;
  findQuery: string;
  findResult: { total: number; index: number };
  findError: string;
  findFocusToken: number;
  addressFocusToken: number;
}>();
const emit = defineEmits<{
  back: []; forward: []; reload: []; stop: [];
  select: [label: string]; close: [label: string]; focus: [];
  split: [point: PopupPoint]; closePane: []; toggleLock: [];
  more: [point: PopupPoint]; context: [label: string, point: PopupPoint];
  source: []; browser: []; copy: [];
  findQuery: [query: string]; find: [direction: number]; closeFind: [];
}>();
const activeTab = computed(() => props.tabs.find(tab => tab.label === props.activeLabel));
const domain = computed(() => {
  try { return new URL(activeTab.value?.url ?? "").host; } catch { return "页面地址"; }
});
const addressInput = ref<HTMLInputElement | null>(null);
const findInput = ref<HTMLInputElement | null>(null);
const addressFocused = ref(false);
const tabElements = new Map<string, HTMLElement>();
const buttonClass = "h-7 w-7 shrink-0 rounded-md inline-flex items-center justify-center text-muted hover:text-text hover:bg-hover cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed";
function selectAddress(event: FocusEvent): void {
  addressFocused.value = true;
  nextTick(() => (event.target as HTMLInputElement).select());
}
watch(() => props.addressFocusToken, async () => {
  if (!props.addressFocusToken) return;
  addressFocused.value = true;
  await nextTick();
  addressInput.value?.focus();
  addressInput.value?.select();
}, { flush: "post" });
watch(() => props.findFocusToken, async () => {
  if (!props.findOpen) return;
  await nextTick();
  findInput.value?.focus();
  findInput.value?.select();
}, { flush: "post" });
watch(() => props.activeLabel, async label => {
  await nextTick();
  tabElements.get(label)?.scrollIntoView({ block: "nearest", inline: "nearest" });
}, { flush: "post" });
function tabRef(label: string, element: unknown): void {
  if (element instanceof HTMLElement) tabElements.set(label, element);
  else tabElements.delete(label);
}
function context(label: string, event: MouseEvent): void {
  event.preventDefault();
  emit("context", label, popupPointFromEvent(event));
}
function onTabClick(tab: ContentTab, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey) {
    emit("browser");
    return;
  }
  emit("select", tab.label);
}
</script>

<template>
  <header
    class="shrink-0 bg-sidebar border-b border-line select-none flex flex-col"
    @pointerdown="emit('focus')"
  >
    <div
      class="px-2 flex items-center gap-1 min-w-0"
      :style="{ height: `${TAB_BAR_HEIGHT}px` }"
      role="toolbar"
      aria-label="页面工具栏"
    >
      <button
        type="button"
        :class="buttonClass"
        aria-label="后退"
        title="后退（⌘[）"
        :disabled="!canGoBack"
        @click="emit('back')"
      >
        <span class="i-lucide-chevron-left text-16px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        aria-label="前进"
        title="前进（⌘]）"
        :disabled="!canGoForward"
        @click="emit('forward')"
      >
        <span class="i-lucide-chevron-right text-16px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        :aria-label="loading ? '停止加载' : '刷新当前页面'"
        :title="loading ? '停止（⌘.）' : '刷新（⌘R）'"
        @click="loading ? emit('stop') : emit('reload')"
      >
        <span
          class="text-15px"
          :class="loading ? 'i-lucide-x' : 'i-lucide-rotate-cw'"
        />
      </button>
      <button
        v-if="activeTab?.closable"
        type="button"
        :class="buttonClass"
        aria-label="返回来源页面"
        title="返回来源页面"
        @click="emit('source')"
      >
        <span class="i-lucide-corner-up-left text-15px" />
      </button>

      <input
        v-if="tabs.length <= 1 || addressFocused"
        ref="addressInput"
        readonly
        class="h-7 flex-1 min-w-0 px-2 rounded-md bg-hover text-12px text-muted cursor-text select-text"
        aria-label="当前页面地址"
        :title="activeTab?.url"
        :value="addressFocused ? activeTab?.url : (error || domain)"
        :class="error ? 'text-danger' : ''"
        @focus="selectAddress"
        @blur="addressFocused = false"
        @keydown.escape.prevent="addressInput?.blur()"
      />
      <div
        v-else
        class="flex-1 min-w-0 h-full flex items-center gap-1 overflow-x-auto"
        role="tablist"
        aria-label="页面标签"
      >
        <div
          v-for="tab in tabs"
          :key="tab.label"
          :ref="element => tabRef(tab.label, element)"
          class="group max-w-44 min-w-20 h-7 px-2 rounded-md flex items-center gap-1 shrink-0 cursor-pointer text-12px"
          :class="
            tab.label === activeLabel
              ? (focused ? 'bg-active text-text font-medium' : 'bg-hover text-text')
              : 'text-muted hover:text-text hover:bg-hover'
          "
          role="tab"
          :aria-selected="tab.label === activeLabel"
          :tabindex="tab.label === activeLabel ? 0 : -1"
          :title="`${tab.title}\n${tab.url}\n⌘+点击在系统浏览器打开`"
          @click="onTabClick(tab, $event)"
          @keydown.enter.prevent="emit('select', tab.label)"
          @keydown.space.prevent="emit('select', tab.label)"
          @keydown.right.prevent="emit('select', tabs[(tabs.indexOf(tab) + 1) % tabs.length]!.label)"
          @keydown.left.prevent="emit('select', tabs[(tabs.indexOf(tab) - 1 + tabs.length) % tabs.length]!.label)"
          @contextmenu="context(tab.label, $event)"
          @auxclick.middle.prevent="tab.closable && emit('close', tab.label)"
        >
          <span
            v-if="tab.label === activeLabel && loading"
            class="i-lucide-loader-circle text-13px animate-spin shrink-0"
          />
          <span
            v-else
            class="text-13px shrink-0"
            :class="tab.closable ? 'i-lucide-globe' : 'i-lucide-house'"
          />
          <span class="flex-1 min-w-0 truncate">{{ tab.title }}</span>
          <button
            v-if="tab.closable"
            type="button"
            class="h-5 w-5 shrink-0 rounded-sm inline-flex items-center justify-center text-muted hover:text-text hover:bg-hover cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            :class="tab.label === activeLabel ? 'opacity-100' : ''"
            :aria-label="`关闭 ${tab.title}`"
            title="关闭标签（⌘W）"
            @click.stop="emit('close', tab.label)"
          >
            <span class="i-lucide-x text-12px" />
          </button>
        </div>
      </div>

      <button
        type="button"
        :class="buttonClass"
        aria-label="向右分屏"
        title="向右分屏（⌘D）"
        :disabled="locked || !canSplit"
        @click="emit('split', popupPointFromEvent($event))"
      >
        <span class="i-lucide-columns-2 text-15px" />
      </button>
      <button
        v-if="canClosePane"
        type="button"
        :class="buttonClass"
        aria-label="关闭分屏"
        title="关闭分屏"
        :disabled="locked"
        @click="emit('closePane')"
      >
        <span class="i-lucide-panel-right-close text-15px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        aria-label="在系统浏览器打开"
        title="在系统浏览器打开（⌘⇧O）"
        @click="emit('browser')"
      >
        <span class="i-lucide-external-link text-15px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        aria-label="更多"
        title="更多"
        @click="emit('more', popupPointFromEvent($event))"
      >
        <span class="i-lucide-ellipsis text-16px" />
      </button>
    </div>

    <div
      v-if="findOpen"
      class="h-40px px-2 flex items-center gap-1 border-t border-line"
      role="search"
      aria-label="在当前页面查找"
    >
      <input
        ref="findInput"
        :value="findQuery"
        class="flex-1 min-w-0 h-7 px-2 rounded-md bg-bg text-13px select-text"
        aria-label="查找页面内容"
        placeholder="查找页面内容"
        @input="emit('findQuery', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('find', $event.shiftKey ? -1 : 1)"
        @keydown.escape.prevent.stop="emit('closeFind')"
      />
      <span
        class="text-12px text-muted shrink-0"
        role="status"
        aria-live="polite"
      >
        {{ findError || (findQuery ? `${findResult.index}/${findResult.total}` : '') }}
      </span>
      <button
        type="button"
        :class="buttonClass"
        aria-label="上一个匹配"
        title="上一个匹配（⇧Enter）"
        :disabled="!findResult.total"
        @click="emit('find', -1)"
      >
        <span class="i-lucide-chevron-up text-14px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        aria-label="下一个匹配"
        title="下一个匹配（Enter）"
        :disabled="!findResult.total"
        @click="emit('find', 1)"
      >
        <span class="i-lucide-chevron-down text-14px" />
      </button>
      <button
        type="button"
        :class="buttonClass"
        aria-label="关闭查找"
        title="关闭查找（Esc）"
        @click="emit('closeFind')"
      >
        <span class="i-lucide-x text-14px" />
      </button>
    </div>
  </header>
</template>
