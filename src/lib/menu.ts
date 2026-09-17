import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface PopupMenuItem {
  id: string;
  text: string;
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
}

export interface PopupPoint {
  x: number;
  y: number;
}

export function popupSeparator(): PopupMenuItem {
  return { id: "popup:sep", text: "", separator: true };
}

export function popupPointFromEvent(event: MouseEvent): PopupPoint {
  return { x: event.clientX, y: event.clientY };
}

export async function showPopup(
  items: PopupMenuItem[],
  position?: PopupPoint,
): Promise<string | null> {
  const unique = items.map((item, index) =>
    item.separator
      ? { ...item, id: `popup:sep-${index}` }
      : item,
  );
  let picked: string | null = null;
  let resolvePick: ((id: string) => void) | undefined;
  const late = new Promise<string>((resolve) => {
    resolvePick = resolve;
  });
  const stop = await listen<string>("menu-action", (event) => {
    if (
      event.payload.startsWith("popup:") &&
      !event.payload.startsWith("popup:sep")
    ) {
      picked = event.payload;
      resolvePick?.(event.payload);
    }
  });
  try {
    const result = await invoke<string | null>("popup_menu", {
      items: unique,
      x: position?.x ?? null,
      y: position?.y ?? null,
    });
    if (result) {
      return result;
    }
    if (picked) {
      return picked;
    }
    return await Promise.race([
      late,
      new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 200);
      }),
    ]);
  } finally {
    stop();
  }
}

export function onMenuAction(
  handler: (id: string) => void,
): Promise<() => void> {
  return listen<string>("menu-action", (event) => {
    handler(event.payload);
  });
}
