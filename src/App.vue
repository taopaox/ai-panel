<script setup lang="ts">
import { computed, ref } from "vue";
import TabBar from "./components/TabBar.vue";
import { useWorkspace } from "./composables/useWorkspace";
import { SIDEBAR_WIDTH } from "./types";

const {
  services,
  activeId,
  activeTabLabel,
  currentTabs,
  errorMessage,
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
} = useWorkspace();

const showAddForm = ref(false);
const newName = ref("");
const newUrl = ref("");
const formError = ref("");

const activeService = computed(
  () => services.value.find((service) => service.id === activeId.value) ?? null,
);

function resetAddForm(): void {
  showAddForm.value = false;
  newName.value = "";
  newUrl.value = "";
  formError.value = "";
}

async function submitAdd(): Promise<void> {
  formError.value = "";
  try {
    await addService(newName.value, newUrl.value);
    resetAddForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "添加失败";
  }
}

async function handleSelect(id: string): Promise<void> {
  await selectService(id);
}

async function handleRemove(id: string): Promise<void> {
  await removeService(id);
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
          {{ activeService?.name ?? "选择服务" }}
        </h1>
      </header>

      <nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="AI 服务">
        <button
          v-for="service in services"
          :key="service.id"
          type="button"
          class="group w-full h-10 mb-1 px-2 rounded-lg flex items-center gap-3 text-left cursor-pointer transition-colors bg-transparent"
          :class="
            service.id === activeId
              ? 'bg-active text-text'
              : 'text-text/85 hover:bg-white/5'
          "
          @click="handleSelect(service.id)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0"
            :style="{ backgroundColor: service.color }"
            aria-hidden="true"
          />
          <span class="flex-1 truncate text-sm">{{ service.name }}</span>
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
      </nav>

      <p v-if="errorMessage" class="px-4 pb-2 text-xs text-danger">
        {{ errorMessage }}
      </p>

      <footer class="border-t border-line p-3">
        <form v-if="showAddForm" class="flex flex-col gap-2" @submit.prevent="submitAdd">
          <input
            v-model="newName"
            class="h-9 px-3 rounded-md bg-active text-sm text-text outline-none border border-transparent focus:border-white/20"
            placeholder="名称，例如 Perplexity"
            maxlength="32"
          />
          <input
            v-model="newUrl"
            class="h-9 px-3 rounded-md bg-active text-sm text-text outline-none border border-transparent focus:border-white/20"
            placeholder="https://..."
          />
          <p v-if="formError" class="text-xs text-danger">{{ formError }}</p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 h-8 rounded-md text-sm text-muted hover:bg-white/5 cursor-pointer"
              @click="resetAddForm"
            >
              取消
            </button>
            <button
              type="submit"
              class="flex-1 h-8 rounded-md text-sm bg-white/10 hover:bg-white/15 cursor-pointer"
            >
              保存
            </button>
          </div>
        </form>
        <button
          v-else
          type="button"
          class="w-full h-9 rounded-md text-sm text-muted hover:text-text hover:bg-white/5 cursor-pointer"
          @click="showAddForm = true"
        >
          + 添加
        </button>
      </footer>
    </aside>

    <section class="flex-1 min-w-0 h-full flex flex-col">
      <TabBar
        :tabs="currentTabs"
        :active-label="activeTabLabel"
        :can-go-back="canGoBack"
        :can-go-forward="canGoForward"
        @back="goBack"
        @forward="goForward"
        @reload="reloadActive"
        @select="selectTab"
        @close="closeTab"
      />
      <div
        class="flex-1 pointer-events-none"
        :style="{ minHeight: 0 }"
        aria-hidden="true"
      />
    </section>
  </div>
</template>
