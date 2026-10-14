/** Track only the initiating pointer; cancellation ends the gesture without committing it. */
export function trackPointer(start: { pointerId: number }, onMove: (e: PointerEvent) => void, onEnd?: (committed: boolean) => void) {
  const mine = (e: PointerEvent) => e.pointerId === start.pointerId;
  const move = (e: PointerEvent) => {
    if (mine(e)) onMove(e);
  };
  const release = (e: PointerEvent) => {
    if (mine(e)) end(true);
  };
  const cancel = (e: PointerEvent) => {
    if (mine(e)) end(false);
  };
  const blur = () => end(false);
  const end = (committed: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', blur);
    onEnd?.(committed);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', blur);
}

/** A finger may scroll the sheet; select only if it is released without moving or being cancelled. */
export function trackTap(start: { pointerId: number; clientX: number; clientY: number }, onTap: () => void) {
  let moved = false;
  trackPointer(start, (event) => {
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > 8) moved = true;
  }, (committed) => {
    if (committed && !moved) onTap();
  });
}
