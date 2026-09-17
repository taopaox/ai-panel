import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Webview } from "@tauri-apps/api/webview";
import { SIDEBAR_WIDTH, TAB_BAR_HEIGHT } from "../types";

export interface ContentBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getLogicalWindowSize(): Promise<{
  width: number;
  height: number;
}> {
  const window = getCurrentWindow();
  const factor = await window.scaleFactor();
  const physical = await window.innerSize();
  return {
    width: physical.width / factor,
    height: physical.height / factor,
  };
}

export async function getContentBounds(): Promise<ContentBounds> {
  const { width, height } = await getLogicalWindowSize();
  return {
    x: SIDEBAR_WIDTH,
    y: TAB_BAR_HEIGHT,
    width: Math.max(width - SIDEBAR_WIDTH, 320),
    height: Math.max(height - TAB_BAR_HEIGHT, 200),
  };
}

export async function layoutShell(): Promise<void> {
  const { width, height } = await getLogicalWindowSize();
  const shell = getCurrentWebview();
  await shell.setPosition(new LogicalPosition(0, 0));
  await shell.setSize(new LogicalSize(width, height));
}

export async function layoutContentWebview(webview: Webview): Promise<void> {
  const bounds = await getContentBounds();
  await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
  await webview.setSize(new LogicalSize(bounds.width, bounds.height));
}
