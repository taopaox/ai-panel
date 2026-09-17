import { ref } from "vue";

const MOVE_THRESHOLD = 8;

export function usePointerReorder() {
  const dragId = ref("");
  const dropId = ref("");
  const dragging = ref(false);

  let session: {
    kind: string;
    id: string;
    startY: number;
    pointerId: number;
    started: boolean;
  } | null = null;
  let skipClick = false;

  function consumeClick(): boolean {
    if (!skipClick) {
      return false;
    }
    skipClick = false;
    return true;
  }

  function begin(kind: string, id: string, event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const current = event.currentTarget;
    if (!(current instanceof HTMLElement)) {
      return;
    }
    const hit =
      event.target instanceof Element
        ? event.target.closest("button, input, a")
        : null;
    if (hit && hit !== current) {
      return;
    }
    session = {
      kind,
      id,
      startY: event.clientY,
      pointerId: event.pointerId,
      started: false,
    };
    current.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent, attr: string): void {
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    if (!session.started) {
      if (Math.abs(event.clientY - session.startY) < MOVE_THRESHOLD) {
        return;
      }
      session.started = true;
      dragging.value = true;
      dragId.value = session.id;
      skipClick = true;
    }
    const rows = document.querySelectorAll(`[${attr}]`);
    let nextId = "";
    let best = Infinity;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const dist = Math.abs(event.clientY - (rect.top + rect.bottom) / 2);
      if (dist < best) {
        best = dist;
        nextId = row.getAttribute(attr) ?? "";
      }
    }
    dropId.value = nextId;
  }

  async function finish(
    event: PointerEvent,
    commit: (kind: string, from: string, to: string) => Promise<void>,
  ): Promise<void> {
    if (!session || event.pointerId !== session.pointerId) {
      return;
    }
    const current = event.currentTarget;
    if (current instanceof HTMLElement && current.hasPointerCapture(event.pointerId)) {
      current.releasePointerCapture(event.pointerId);
    }
    const { kind, id, started } = session;
    const to = dropId.value;
    session = null;
    dragging.value = false;
    dragId.value = "";
    dropId.value = "";
    if (started) {
      skipClick = true;
      if (to && to !== id) {
        await commit(kind, id, to);
      }
    }
  }

  return {
    dragId,
    dropId,
    dragging,
    consumeClick,
    begin,
    move,
    finish,
  };
}
