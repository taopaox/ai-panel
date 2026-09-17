<script setup lang="ts">
import { computed } from "vue";
import { iconUrlFor } from "../lib/icons";
import type { AiService } from "../types";

const props = withDefaults(
  defineProps<{
    service: Pick<AiService, "name" | "color" | "logo" | "logoSrc">;
    size?: number;
    appearance?: "sidebar" | "tile";
  }>(),
  {
    size: 20,
    appearance: "sidebar",
  },
);

const src = computed(
  () => props.service.logoSrc || iconUrlFor(props.service.logo),
);
const initial = computed(() => props.service.name.slice(0, 1).toUpperCase());
const isTile = computed(() => props.appearance === "tile");
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center overflow-hidden select-none"
    :class="
      isTile
        ? 'rounded-[14px] border border-white/10 bg-white/8'
        : 'rounded-full bg-white/10'
    "
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="object-contain"
      :class="isTile ? 'w-[72%] h-[72%]' : 'w-[70%] h-[70%]'"
      draggable="false"
    />
    <span
      v-else
      class="font-medium leading-none"
      :class="isTile ? 'text-lg text-text/80' : 'text-[10px] text-text/80'"
    >
      {{ initial }}
    </span>
  </span>
</template>
