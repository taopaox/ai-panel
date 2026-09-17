import { getCurrentWindow } from "@tauri-apps/api/window";
import { onMounted, onUnmounted, ref } from "vue";
import { saveThemeMode, loadThemeMode } from "../lib/persist";
import type { ThemeMode } from "../types";

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? systemTheme() : mode;
}

async function applyWindowTheme(mode: ThemeMode): Promise<void> {
  document.documentElement.dataset.theme = resolveTheme(mode);
  try {
    await getCurrentWindow().setTheme(mode === "system" ? null : mode);
  } catch {
    // 非 Tauri 环境忽略
  }
}

export function useTheme(initial: ThemeMode = "system") {
  const themeMode = ref<ThemeMode>(initial);
  const resolvedTheme = ref<"light" | "dark">(resolveTheme(initial));
  let media: MediaQueryList | null = null;

  function onSystemChange(): void {
    if (themeMode.value !== "system") {
      return;
    }
    resolvedTheme.value = systemTheme();
    void applyWindowTheme("system");
  }

  async function apply(mode: ThemeMode): Promise<void> {
    themeMode.value = mode;
    resolvedTheme.value = resolveTheme(mode);
    await applyWindowTheme(mode);
  }

  async function setThemeMode(mode: ThemeMode): Promise<void> {
    await apply(mode);
    await saveThemeMode(mode);
  }

  onMounted(() => {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onSystemChange);
    void loadThemeMode().then((saved) => apply(saved));
  });

  onUnmounted(() => {
    media?.removeEventListener("change", onSystemChange);
  });

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    applyTheme: apply,
  };
}
