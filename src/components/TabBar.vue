<script setup lang="ts">
import { TAB_BAR_HEIGHT, type ContentTab } from "../types";

defineProps<{
  tabs: ContentTab[];
  activeLabel: string;
  canGoBack: boolean;
  canGoForward: boolean;
  focused: boolean;
  canSplit: boolean;
  canClosePane: boolean;
  locked: boolean;
}>();

const emit = defineEmits<{
  back: [];
  forward: [];
  reload: [];
  select: [label: string];
  close: [label: string];
  focus: [];
  split: [];
  closePane: [];
  toggleLock: [];
}>();

const navButtonClass =
  "h-7 w-7 rounded-md text-muted hover:text-text hover:bg-active cursor-pointer disabled:opacity-30 disabled:hover:text-muted disabled:hover:bg-transparent disabled:cursor-not-allowed";
</script>

<template>
  <div
    class="flex items-center gap-1 px-1.5 border-b bg-sidebar select-none"
    :class="focused ? 'border-line' : 'border-line/80'"
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
        class="group relative max-w-44 min-w-20 h-8 px-2.5 rounded-t-md flex items-center gap-2 shrink-0 cursor-pointer"
        :class="
          tab.label === activeLabel
            ? focused
              ? 'bg-active text-text'
              : 'bg-active/70 text-text/90'
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

    <div class="flex items-center shrink-0">
      <button
        v-if="canClosePane"
        type="button"
        :class="navButtonClass"
        :aria-label="locked ? '解锁分屏' : '锁定分屏'"
        :title="locked ? '解锁后可修改各栏网页' : '锁定分屏：点其他服务可离开，再点分屏回来'"
        :aria-pressed="locked"
        @pointerdown.stop
        @click.stop="emit('toggleLock')"
      >
        <svg
          v-if="locked"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class="mx-auto text-text"
        >
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M5.5 7V5.2A2.5 2.5 0 0 1 10.5 5.2V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <svg
          v-else
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          class="mx-auto"
        >
          <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M5.5 7V5.2A2.5 2.5 0 0 1 8 2.7 2.5 2.5 0 0 1 10.5 5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        :class="navButtonClass"
        aria-label="向右分屏"
        title="向右分屏"
        :disabled="locked || !canSplit"
        @pointerdown.stop
        @click.stop="emit('split')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="mx-auto">
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 3v10" stroke="currentColor" stroke-width="1.5" />
        </svg>
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" class="mx-auto">
          <path
            d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
