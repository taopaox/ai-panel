import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Webview } from "@tauri-apps/api/webview";
import {
  MIN_PANE_WIDTH,
  SIDEBAR_WIDTH_EXPANDED,
  SPLITTER_WIDTH,
  TAB_BAR_HEIGHT,
} from "../types";

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

export function contentAreaSize(
  windowWidth: number,
  windowHeight: number,
  sidebarWidth: number,
): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(windowWidth - sidebarWidth, 320),
    height: Math.max(windowHeight - TAB_BAR_HEIGHT, 200),
  };
}

export function normalizeRatios(ratios: number[]): number[] {
  if (ratios.length === 0) {
    return [1];
  }
  const safe = ratios.map((ratio) => (ratio > 0 ? ratio : 0));
  const sum = safe.reduce((total, ratio) => total + ratio, 0);
  if (sum <= 0) {
    return safe.map(() => 1 / safe.length);
  }
  return safe.map((ratio) => ratio / sum);
}

export function equalRatios(count: number): number[] {
  const n = Math.max(count, 1);
  return Array.from({ length: n }, () => 1 / n);
}

export function splitRatioAt(ratios: number[], index: number): number[] {
  const next = normalizeRatios(ratios);
  const current = next[index];
  if (current === undefined) {
    const share = 1 / (next.length + 1);
    return normalizeRatios([...next.map((ratio) => ratio * (1 - share)), share]);
  }
  const half = current / 2;
  next[index] = half;
  next.splice(index + 1, 0, half);
  return normalizeRatios(next);
}

export function mergeRatioAt(ratios: number[], index: number): number[] {
  const next = [...ratios];
  if (next.length <= 1) {
    return [1];
  }
  if (index > 0) {
    next[index - 1] += next[index] ?? 0;
    next.splice(index, 1);
  } else {
    next[1] = (next[1] ?? 0) + (next[0] ?? 0);
    next.splice(0, 1);
  }
  return normalizeRatios(next);
}

export function paneWidths(contentWidth: number, ratios: number[]): number[] {
  const normalized = normalizeRatios(ratios);
  const count = normalized.length;
  if (count <= 1) {
    return [contentWidth];
  }

  const available = Math.max(contentWidth - (count - 1) * SPLITTER_WIDTH, count);
  const raw = normalized.map((ratio) => ratio * available);
  const widths = raw.map((width) => Math.max(Math.round(width), 1));
  const used = widths.slice(0, -1).reduce((total, width) => total + width, 0);
  widths[count - 1] = Math.max(available - used, 1);
  return widths;
}

export function paneBoundsList(
  windowWidth: number,
  windowHeight: number,
  ratios: number[],
  sidebarWidth: number,
): ContentBounds[] {
  const area = contentAreaSize(windowWidth, windowHeight, sidebarWidth);
  const widths = paneWidths(area.width, ratios);
  let x = sidebarWidth;
  return widths.map((width, index) => {
    const bounds: ContentBounds = {
      x,
      y: TAB_BAR_HEIGHT,
      width,
      height: area.height,
    };
    x += width + (index < widths.length - 1 ? SPLITTER_WIDTH : 0);
    return bounds;
  });
}

export function applySplitterDrag(
  widths: number[],
  splitterIndex: number,
  delta: number,
  minWidth = MIN_PANE_WIDTH,
): number[] {
  const next = [...widths];
  const left = next[splitterIndex];
  const right = next[splitterIndex + 1];
  if (left === undefined || right === undefined) {
    return next;
  }
  const pair = left + right;
  const floor = Math.min(minWidth, Math.floor(pair / 2));
  const nextLeft = Math.min(Math.max(left + delta, floor), pair - floor);
  next[splitterIndex] = nextLeft;
  next[splitterIndex + 1] = pair - nextLeft;
  return next;
}

export function widthsToRatios(widths: number[]): number[] {
  return normalizeRatios(widths);
}

export async function getContentBounds(
  sidebarWidth = SIDEBAR_WIDTH_EXPANDED,
): Promise<ContentBounds> {
  const { width, height } = await getLogicalWindowSize();
  return paneBoundsList(width, height, [1], sidebarWidth)[0];
}

export async function layoutShell(): Promise<void> {
  const { width, height } = await getLogicalWindowSize();
  const shell = getCurrentWebview();
  await shell.setPosition(new LogicalPosition(0, 0));
  await shell.setSize(new LogicalSize(width, height));
}

export async function layoutContentWebview(
  webview: Webview,
  bounds: ContentBounds,
): Promise<void> {
  await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
  await webview.setSize(new LogicalSize(bounds.width, bounds.height));
}
