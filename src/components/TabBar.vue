<script setup lang="ts">
import { popupPointFromEvent, type PopupPoint } from "../lib/menu";
import { TAB_BAR_HEIGHT, type ContentTab } from "../types";

defineProps<{
  tabs: ContentTab[];
  activeLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  focused: boolean;
  canSplit: boolean;
  canClosePane: boolean;
  locked: boolean;
}>();

const emit = defineEmits<{
  back: [];
  forward: [];
  reload: [];
  stop: [];
  select: [label: string];
  close: [label: string];
  focus: [];
  split: [point: PopupPoint];
  closePane: [];
  toggleLock: [];
  more: [point: PopupPoint];
}>();

const navButtonClass =
  "h-10 w-10 rounded-lg inline-flex items-center justify-center text-muted hover:text-text hover:bg-hover cursor-pointer disabled:opacity-30 disabled:hover:text-muted disabled:hover:bg-transparent disabled:cursor-not-allowed";
</script>

<template>
  <div
    class="flex items-center gap-0.5 px-2 border-b border-line bg-sidebar select-none"
    :style="{ height: `${TAB_BAR_HEIGHT}px` }"
    @pointerdown="emit('focus')"
  >
    <div
      class="flex items-center shrink-0"
      role="group"
      aria-label="页面导航"
    >
      <button
        type="button"
        :class="navButtonClass"
        aria-label="后退"
        title="后退"
        :disabled="!canGoBack"
        @click="emit('back')"
      >
        <span class="i-lucide-chevron-left text-22px mx-auto" />
      </button>
      <button
        type="button"
        :class="navButtonClass"
        aria-label="前进"
        title="前进"
        :disabled="!canGoForward"
        @click="emit('forward')"
      >
        <span class="i-lucide-chevron-right text-22px mx-auto" />
      </button>
      <button
        v-if="loading"
        type="button"
        :class="navButtonClass"
        aria-label="停止加载"
        title="停止"
        @click="emit('stop')"
      >
        <span class="i-lucide-x text-20px mx-auto" />
      </button>
      <button
        v-else
        type="button"
        :class="navButtonClass"
        aria-label="刷新当前页面"
        title="刷新"
        @click="emit('reload')"
      >
        <span class="i-lucide-rotate-cw text-20px mx-auto" />
      </button>
    </div>

    <div
      class="flex-1 min-w-0 h-full flex items-center gap-1 overflow-x-auto"
      role="tablist"
      aria-label="页面标签"
    >
      <div
        v-for="tab in tabs"
        :key="tab.label"
        class="group relative max-w-52 min-w-20 h-8 px-3 rounded-md flex items-center gap-1.5 shrink-0 cursor-pointer"
        :class="
          tab.label === activeLabel
            ? focused
              ? 'bg-hover text-text'
              : 'text-text/80'
            : 'text-muted hover:text-text hover:bg-hover'
        "
        role="tab"
        :aria-selected="tab.label === activeLabel"
        :title="tab.title"
        @click="emit('select', tab.label)"
      >
        <span
          v-if="tab.label === activeLabel && loading"
          class="i-lucide-loader-circle text-16px animate-spin shrink-0"
        />
        <span class="flex-1 min-w-0 truncate text-14px">{{ tab.title }}</span>
        <button
          v-if="tab.closable"
          type="button"
          class="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-sm text-muted hover:text-text cursor-pointer"
          aria-label="关闭标签"
          title="关闭"
          @click.stop="emit('close', tab.label)"
        >
          <span class="i-lucide-x text-14px" />
        </button>
      </div>
    </div>

    <div class="flex items-center shrink-0">
      <button
        type="button"
        :class="navButtonClass"
        aria-label="向右分屏"
        title="向右分屏"
        :disabled="locked || !canSplit"
        @pointerdown.stop
        @click.stop="emit('split', popupPointFromEvent($event))"
      >
        <span class="i-lucide-columns-2 text-20px mx-auto" />
      </button>
      <button
        v-if="canClosePane"
        type="button"
        :class="navButtonClass"
        aria-label="关闭分屏"
        title="关闭分屏"
        :disabled="locked"
        @pointerdown.stop
        @click.stop="emit('closePane')"
      >
        <span class="i-lucide-x text-20px mx-auto" />
      </button>
      <button
        type="button"
        :class="navButtonClass"
        aria-label="更多"
        title="更多"
        @pointerdown.stop
        @click.stop="emit('more', popupPointFromEvent($event))"
      >
        <span class="i-lucide-ellipsis text-22px mx-auto" />
      </button>
    </div>
  </div>
</template>
