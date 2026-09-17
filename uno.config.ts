import { defineConfig, presetWind3, transformerDirectives, transformerVariantGroup } from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      sidebar: "#161618",
      line: "#2c2c2e",
      text: "#f5f5f7",
      muted: "#8e8e93",
      active: "#2c2c2e",
      danger: "#ff453a",
    },
  },
});
