import { icons as lucideIcons } from "@iconify-json/lucide";
import { defineConfig, presetIcons, presetWind3, transformerDirectives, transformerVariantGroup } from "unocss";

const lucideClasses = [
  "i-lucide-settings",
  "i-lucide-layout-grid",
  "i-lucide-plus",
  "i-lucide-x",
  "i-lucide-lock",
  "i-lucide-unlock",
  "i-lucide-panel-left-open",
  "i-lucide-panel-left-close",
  "i-lucide-chevron-left",
  "i-lucide-chevron-right",
  "i-lucide-rotate-cw",
  "i-lucide-loader-circle",
  "i-lucide-columns-2",
  "i-lucide-ellipsis",
  "i-lucide-pencil",
];

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      collections: {
        lucide: () => lucideIcons,
      },
      iconifyCollectionsNames: ["lucide"],
      extraProperties: {
        display: "inline-block",
        "vertical-align": "middle",
      },
      warn: true,
    }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  safelist: lucideClasses,
  theme: {
    colors: {
      sidebar: "var(--c-sidebar)",
      bg: "var(--c-bg)",
      line: "var(--c-line)",
      text: "var(--c-text)",
      muted: "var(--c-muted)",
      hover: "var(--c-hover)",
      active: "var(--c-active)",
      accent: "var(--c-accent)",
      open: "var(--c-open)",
      online: "var(--c-online)",
      danger: "var(--c-danger)",
      selected: "var(--c-selected)",
    },
  },
});
