import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Webview } from "@tauri-apps/api/webview";
import { SIDEBAR_WIDTH } from "../types";

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
    y: 0,
    width: Math.max(width - SIDEBAR_WIDTH, 320),
    height,
  };
}

export async function layoutSidebar(): Promise<void> {
  const { height } = await getLogicalWindowSize();
  const sidebar = getCurrentWebview();
  await sidebar.setPosition(new LogicalPosition(0, 0));
  await sidebar.setSize(new LogicalSize(SIDEBAR_WIDTH, height));
}

export async function layoutContentWebview(webview: Webview): Promise<void> {
  const bounds = await getContentBounds();
  await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
  await webview.setSize(new LogicalSize(bounds.width, bounds.height));
}
