<script setup lang="ts">
import { TAB_BAR_HEIGHT, type ContentTab } from "../types";

defineProps<{
  tabs: ContentTab[];
  activeLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
}>();

const emit = defineEmits<{
  back: [];
  forward: [];
  reload: [];
  select: [label: string];
  close: [label: string];
}>();

const navButtonClass =
  "h-7 w-7 rounded-md text-muted hover:text-text hover:bg-active cursor-pointer disabled:opacity-30 disabled:hover:text-muted disabled:hover:bg-transparent disabled:cursor-not-allowed";
</script>

<template>
  <div
    class="flex items-center gap-1 px-2 border-b border-line bg-sidebar select-none"
    :style="{ height: `${TAB_BAR_HEIGHT}px` }"
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="mx-auto">
          <path
            d="M10 3.5 5.5 8 10 12.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        :class="navButtonClass"
        aria-label="前进"
        title="前进"
        :disabled="!canGoForward"
        @click="emit('forward')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="mx-auto">
          <path
            d="M6 3.5 10.5 8 6 12.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        class="h-7 w-7 rounded-md text-muted hover:text-text hover:bg-active cursor-pointer"
        aria-label="刷新当前页面"
        title="刷新"
        @click="emit('reload')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="mx-auto">
          <path
            d="M13.5 8a5.5 5.5 0 0 1-9.4 3.9M2.5 8A5.5 5.5 0 0 1 11.9 4.1"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <path
            d="M11.2 2.8v2.6h-2.6M4.8 13.2v-2.6h2.6"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <div
      class="flex-1 min-w-0 h-full flex items-end gap-1 overflow-x-auto"
      role="tablist"
      aria-label="页面标签"
    >
      <div
        v-for="tab in tabs"
        :key="tab.label"
        class="group relative max-w-44 min-w-28 h-8 px-3 rounded-t-md flex items-center gap-2 shrink-0 cursor-pointer"
        :class="
          tab.label === activeLabel
            ? 'bg-active text-text'
            : 'text-muted hover:text-text hover:bg-white/5'
        "
        role="tab"
        :aria-selected="tab.label === activeLabel"
        :title="tab.title"
        @click="emit('select', tab.label)"
      >
        <span class="flex-1 min-w-0 truncate text-xs">{{ tab.title }}</span>
        <button
          v-if="tab.closable"
          type="button"
          class="hidden group-hover:flex h-4 w-4 items-center justify-center rounded-sm text-muted hover:text-text cursor-pointer"
          aria-label="关闭标签"
          title="关闭"
          @click.stop="emit('close', tab.label)"
        >
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M3 3l6 6M9 3L3 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
