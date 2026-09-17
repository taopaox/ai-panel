<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  CATALOG_SERVICES,
  normalizeServiceUrl,
  readLogoFile,
  type AiService,
} from "../types";
import ServiceIcon from "./ServiceIcon.vue";

const props = defineProps<{
  customServices: AiService[];
  enabledIds: string[];
  activeId: string;
}>();

const emit = defineEmits<{
  open: [id: string];
  enable: [id: string];
  hide: [id: string];
  add: [name: string, url: string, logoSrc?: string];
  update: [id: string, name: string, url: string, logoSrc?: string];
  remove: [id: string];
  close: [];
}>();

const search = ref("");
const showForm = ref(false);
const editingId = ref<string | null>(null);
const newName = ref("");
const newUrl = ref("");
const newLogoSrc = ref("");
const formError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

const enabledSet = computed(() => new Set(props.enabledIds));

const allApps = computed(() => [...CATALOG_SERVICES, ...props.customServices]);

const filteredApps = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return allApps.value;
  }
  return allApps.value.filter(
    (app) =>
      app.name.toLowerCase().includes(query) ||
      app.url.toLowerCase().includes(query),
  );
});

const formTitle = computed(() => (editingId.value ? "编辑服务" : "添加服务"));

watch(
  () => props.customServices,
  (list) => {
    if (editingId.value && !list.some((item) => item.id === editingId.value)) {
      resetForm();
    }
  },
);

function resetForm(): void {
  showForm.value = false;
  editingId.value = null;
  newName.value = "";
  newUrl.value = "";
  newLogoSrc.value = "";
  formError.value = "";
}

function openCreate(): void {
  editingId.value = null;
  newName.value = "";
  newUrl.value = "";
  newLogoSrc.value = "";
  formError.value = "";
  showForm.value = true;
}

function openEdit(service: AiService): void {
  editingId.value = service.id;
  newName.value = service.name;
  newUrl.value = service.url;
  newLogoSrc.value = service.logoSrc ?? "";
  formError.value = "";
  showForm.value = true;
}

function previewService(): Pick<AiService, "name" | "color" | "logo" | "logoSrc"> {
  if (editingId.value) {
    const current = props.customServices.find((item) => item.id === editingId.value);
    return {
      name: newName.value || current?.name || "新服务",
      color: current?.color ?? "#8e8e93",
      logo: current?.logo ?? "application",
      logoSrc: newLogoSrc.value || undefined,
    };
  }
  return {
    name: newName.value || "新服务",
    color: "#8e8e93",
    logo: "application",
    logoSrc: newLogoSrc.value || undefined,
  };
}

async function onLogoFile(event: Event): Promise<void> {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  formError.value = "";
  try {
    newLogoSrc.value = await readLogoFile(file);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "图标读取失败";
  }
}

function submitForm(): void {
  formError.value = "";
  try {
    const name = newName.value.trim();
    if (!name) {
      throw new Error("请输入名称");
    }
    const url = normalizeServiceUrl(newUrl.value);
    if (editingId.value) {
      emit("update", editingId.value, name, url, newLogoSrc.value || undefined);
    } else {
      emit("add", name, url, newLogoSrc.value || undefined);
    }
    resetForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "保存失败";
  }
}

function handleOpen(app: AiService): void {
  if (app.builtin && !enabledSet.value.has(app.id)) {
    emit("enable", app.id);
    return;
  }
  emit("open", app.id);
}

function isVisible(app: AiService): boolean {
  return app.builtin ? enabledSet.value.has(app.id) : true;
}
</script>

<template>
  <div class="relative h-full min-h-0 flex-1 min-w-0 flex flex-col bg-sidebar text-text">
    <header class="h-10 px-3 flex items-center gap-2 border-b border-line shrink-0">
      <p class="text-sm font-medium shrink-0">管理服务</p>
      <div class="flex-1 min-w-0">
        <input
          v-model="search"
          class="w-full max-w-sm h-7 mx-auto block px-3 rounded-md bg-active text-sm outline-none border border-transparent focus:border-white/20"
          placeholder="搜索名称或网址"
        />
      </div>
      <button
        type="button"
        class="h-7 w-7 rounded-md text-muted hover:text-text hover:bg-active cursor-pointer"
        aria-label="添加服务"
        title="添加服务"
        @click="openCreate"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="mx-auto" aria-hidden="true">
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="h-7 w-7 rounded-md text-muted hover:text-text hover:bg-active cursor-pointer"
        aria-label="关闭管理"
        title="关闭"
        @click="emit('close')"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="mx-auto" aria-hidden="true">
          <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </header>

    <div class="flex-1 min-h-0 overflow-y-auto px-8 pb-10">
      <div
        v-if="filteredApps.length === 0"
        class="h-full flex items-center justify-center text-sm text-muted"
      >
        没有匹配的服务
      </div>
      <div
        v-else
        class="grid w-full grid-cols-[repeat(auto-fill,minmax(84px,92px))] justify-center gap-x-5 gap-y-8 px-2 pt-10"
      >
        <div
          v-for="app in filteredApps"
          :key="app.id"
          class="group relative w-[92px] min-h-[104px] pt-1 flex flex-col items-center cursor-pointer"
          @click="handleOpen(app)"
        >
          <div
            class="relative size-[58px] rounded-[14px] flex items-center justify-center transition-colors duration-150"
            :class="
              app.id === activeId
                ? 'bg-white/10'
                : 'hover:bg-white/8'
            "
          >
            <ServiceIcon :service="app" appearance="tile" :size="56" />
            <span
              v-if="isVisible(app)"
              class="absolute -right-[3px] -bottom-[3px] size-2 rounded-full bg-emerald-400 ring-2 ring-sidebar"
              aria-hidden="true"
            />
          </div>
          <p
            class="mt-2 min-h-9 max-w-[92px] text-center text-[13px] leading-[18px] text-muted line-clamp-2"
          >
            {{ app.name }}
          </p>
          <button
            v-if="!app.builtin"
            type="button"
            class="hidden group-hover:flex absolute top-0 right-1 h-6 w-6 items-center justify-center rounded-md text-muted hover:text-text bg-sidebar/80 cursor-pointer"
            aria-label="编辑服务"
            title="编辑"
            @click.stop="openEdit(app)"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3.5 12.5 12.5 3.5M8.5 3.5h4v4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            v-if="app.builtin ? enabledSet.has(app.id) : true"
            type="button"
            class="hidden group-hover:flex absolute top-0 left-1 h-6 w-6 items-center justify-center rounded-md text-muted hover:text-danger bg-sidebar/80 cursor-pointer"
            :aria-label="app.builtin ? '移出侧栏' : '删除服务'"
            :title="app.builtin ? '移出侧栏' : '删除'"
            @click.stop="app.builtin ? emit('hide', app.id) : emit('remove', app.id)"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="group w-[92px] min-h-[104px] pt-1 flex flex-col items-center bg-transparent cursor-pointer text-muted hover:text-text"
          @click="openCreate"
        >
          <span
            class="size-[58px] rounded-[14px] border border-dashed border-white/20 flex items-center justify-center group-hover:bg-white/8 transition-colors duration-150"
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </span>
          <span class="mt-2 min-h-9 text-center text-[13px] leading-[18px]">添加服务</span>
        </button>
      </div>
    </div>

    <div
      v-if="showForm"
      class="absolute inset-0 z-10 flex items-center justify-center bg-black/45 px-4"
      @click.self="resetForm"
    >
      <form
        class="w-full max-w-md rounded-xl border border-line bg-sidebar p-5 flex flex-col gap-4"
        @submit.prevent="submitForm"
      >
        <h2 class="text-sm font-semibold">{{ formTitle }}</h2>
        <div class="flex flex-col items-center gap-3">
          <button
            type="button"
            class="cursor-pointer"
            aria-label="上传图标"
            @click="fileInput?.click()"
          >
            <ServiceIcon :service="previewService()" appearance="tile" :size="64" />
          </button>
          <button
            type="button"
            class="h-8 px-3 rounded-md text-xs text-muted hover:text-text hover:bg-white/8 cursor-pointer"
            @click="fileInput?.click()"
          >
            上传图标
          </button>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onLogoFile"
          />
        </div>
        <label class="flex flex-col gap-1 text-xs text-muted">
          名称
          <input
            v-model="newName"
            class="h-9 px-3 rounded-md bg-active text-sm text-text outline-none border border-transparent focus:border-white/20"
            placeholder="例如 Perplexity"
            maxlength="32"
            required
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted">
          网址
          <input
            v-model="newUrl"
            class="h-9 px-3 rounded-md bg-active text-sm text-text outline-none border border-transparent focus:border-white/20"
            placeholder="https://..."
            required
          />
        </label>
        <p v-if="formError" class="text-xs text-danger">{{ formError }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 h-9 rounded-md text-sm text-muted hover:bg-white/5 cursor-pointer"
            @click="resetForm"
          >
            取消
          </button>
          <button
            type="submit"
            class="flex-1 h-9 rounded-md text-sm bg-white/10 hover:bg-white/15 cursor-pointer"
          >
            保存
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
