import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackPointer, trackTap } from '@/components/pointer';

function pointer(type: string, pointerId = 1, pointerType = 'touch', clientX = 0, clientY = 0) {
  const event = new Event(type);
  Object.assign(event, { pointerId, pointerType, clientX, clientY });
  window.dispatchEvent(event);
}

describe('pointer gesture completion', () => {
  beforeEach(() => vi.stubGlobal('window', new EventTarget()));
  afterEach(() => vi.unstubAllGlobals());

  it('ignores a second finger and commits only when the initiating finger is released', () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointer({ pointerId: 1 }, move, end);
    pointer('pointermove', 2);
    pointer('pointercancel', 2);
    pointer('pointerup', 2);
    expect(move).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    pointer('pointermove');
    pointer('pointerup');
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledExactlyOnceWith(true);
    pointer('pointermove');
    pointer('pointerup');
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it.each(['pointercancel', 'blur'])('%s cancels without committing and the next gesture works', (type) => {
    const end = vi.fn();
    trackPointer({ pointerId: 1 }, vi.fn(), end);
    pointer('pointermove');
    if (type === 'blur') window.dispatchEvent(new Event('blur'));
    else pointer(type);
    pointer('pointerup');
    expect(end).toHaveBeenCalledExactlyOnceWith(false);
    const next = vi.fn();
    trackPointer({ pointerId: 3 }, vi.fn(), next);
    pointer('pointerup', 3);
    expect(next).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('tracks mouse presses by pointer id without accepting touch input', () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointer({ pointerId: 4 }, move, end);
    pointer('pointermove');
    pointer('pointerup');
    expect(end).not.toHaveBeenCalled();
    pointer('pointermove', 4, 'mouse');
    pointer('pointerup', 4, 'mouse');
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('selects on a stationary touch release, ignoring other fingers', () => {
    const tap = vi.fn();
    trackTap({ pointerId: 1, clientX: 20, clientY: 20 }, tap);
    pointer('pointermove', 2, 'touch', 100, 100);
    pointer('pointerup', 2);
    expect(tap).not.toHaveBeenCalled();
    pointer('pointermove', 1, 'touch', 22, 23);
    pointer('pointerup');
    expect(tap).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(['pointerup', 'pointercancel'])('a swipe ending with %s never selects a cell', (type) => {
    const tap = vi.fn();
    trackTap({ pointerId: 1, clientX: 20, clientY: 20 }, tap);
    pointer('pointermove', 1, 'touch', 20, 60);
    pointer('pointermove', 1, 'touch', 20, 20);
    pointer(type);
    expect(tap).not.toHaveBeenCalled();
    trackTap({ pointerId: 2, clientX: 0, clientY: 0 }, tap);
    pointer('pointerup', 2);
    expect(tap).toHaveBeenCalledExactlyOnceWith();
  });

  it('a cancelled stationary touch does not select', () => {
    const tap = vi.fn();
    trackTap({ pointerId: 1, clientX: 0, clientY: 0 }, tap);
    pointer('pointercancel');
    pointer('pointerup');
    expect(tap).not.toHaveBeenCalled();
  });
});
