<script setup lang="ts">
import { computed } from "vue";
import { SIDEBAR_WIDTH_EXPANDED, type ThemeMode } from "../types";

const props = defineProps<{
  themeMode: ThemeMode;
  sidebarCollapsed: boolean;
  version: string;
}>();

const emit = defineEmits<{
  theme: [mode: ThemeMode];
  toggleSidebar: [];
  close: [];
  openGithub: [];
}>();

const shortcuts = [
  { keys: "⌘,", action: "设置" },
  { keys: "⌘B", action: "收起 / 展开侧栏" },
  { keys: "⌘1–9", action: "切换到对应服务" },
  { keys: "⌘D", action: "向右分屏" },
  { keys: "⌘⇧M", action: "管理服务" },
  { keys: "⌘[ / ⌘]", action: "后退 / 前进" },
  { keys: "⌘R / ⌘.", action: "刷新 / 停止" },
  { keys: "⌘W", action: "关闭浏览标签并返回来源 / 关闭设置" },
  { keys: "⌘⇧T", action: "恢复刚关闭的标签（本次运行）" },
  { keys: "⌃Tab / ⌃⇧Tab", action: "下一个 / 上一个标签" },
  { keys: "⌘F", action: "查找页面内容" },
  { keys: "⌘G / ⌘⇧G", action: "下一个 / 上一个匹配" },
  { keys: "Enter / ⇧Enter", action: "查找框中下一个 / 上一个匹配" },
  { keys: "Esc", action: "查找框中关闭查找" },
  { keys: "⌘L", action: "选择当前完整页面地址" },
  { keys: "⌘= / ⌘- / ⌘0", action: "放大 / 缩小 / 实际大小" },
  { keys: "⌘⇧C", action: "复制链接" },
  { keys: "⌘⇧O", action: "在浏览器中打开" },
];

const themes: { id: ThemeMode; label: string }[] = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "系统" },
];

const githubUrl = "https://github.com/taopaox/ai-panel";
const collapsedLabel = computed(() =>
  props.sidebarCollapsed ? "已折叠为图标栏" : `展开 ${SIDEBAR_WIDTH_EXPANDED}px`,
);
</script>

<template>
  <div class="relative h-full min-h-0 flex-1 min-w-0 flex flex-col bg-bg text-text">
    <header class="h-56px px-5 flex items-center gap-2 border-b border-line shrink-0">
      <p class="text-lg font-medium">设置</p>
      <span class="flex-1" />
      <button
        type="button"
        class="h-10 w-10 rounded-lg inline-flex items-center justify-center text-muted hover:text-text hover:bg-hover cursor-pointer"
        aria-label="关闭设置"
        title="关闭"
        @click="emit('close')"
      >
        <span class="i-lucide-x text-22px mx-auto" />
      </button>
    </header>

    <div class="flex-1 min-h-0 overflow-y-auto px-10 py-10">
      <section class="max-w-xl mx-auto flex flex-col gap-10">
        <div>
          <h2 class="text-base font-medium mb-4">外观</h2>
          <div class="flex gap-2">
            <button
              v-for="theme in themes"
              :key="theme.id"
              type="button"
              class="h-11 px-4 rounded-lg text-base cursor-pointer"
              :class="
                themeMode === theme.id
                  ? 'bg-active text-text font-medium'
                  : 'text-muted hover:bg-hover'
              "
              @click="emit('theme', theme.id)"
            >
              {{ theme.label }}
            </button>
          </div>
        </div>

        <div>
          <h2 class="text-base font-medium mb-4">侧栏</h2>
          <button
            type="button"
            class="h-11 px-4 rounded-lg text-base bg-hover hover:bg-active cursor-pointer"
            @click="emit('toggleSidebar')"
          >
            {{ collapsedLabel }}
          </button>
        </div>

        <div>
          <h2 class="text-base font-medium mb-4">快捷键</h2>
          <dl class="text-base">
            <div
              v-for="item in shortcuts"
              :key="item.keys"
              class="flex items-baseline gap-4 py-2.5 border-b border-line last:border-0"
            >
              <dt class="w-40 shrink-0 font-mono text-sm text-muted">{{ item.keys }}</dt>
              <dd class="m-0">{{ item.action }}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 class="text-base font-medium mb-4">关于</h2>
          <div class="flex items-center gap-3 mb-3">
            <img src="/logo.svg" alt="AiPanel" class="w-10 h-10 rounded-xl shadow-sm border border-black/5 dark:border-white/10" />
            <div>
              <div class="font-semibold text-sm">AiPanel <span class="text-xs text-muted font-normal">{{ version }}</span></div>
              <div class="text-xs text-muted">多 AI 站点工作区</div>
            </div>
          </div>
          <button
            type="button"
            class="text-base text-accent hover:underline cursor-pointer"
            @click="emit('openGithub')"
          >
            {{ githubUrl }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
