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
    size: 32,
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
    :class="isTile ? 'rounded-[14px] bg-hover' : 'rounded-lg bg-hover'"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <img
      v-if="src"
      :src="src"
      alt=""
      class="object-contain"
      :class="isTile ? 'w-[72%] h-[72%]' : 'w-[82%] h-[82%]'"
      draggable="false"
    />
    <span
      v-else
      :class="isTile ? 'text-lg text-text/80' : 'text-sm text-text/80'"
    >
      {{ initial }}
    </span>
  </span>
</template>
