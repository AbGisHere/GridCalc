import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackPointer } from '@/components/pointer';

function pointer(type: string, pointerId = 1, pointerType = 'touch') {
  const event = new Event(type);
  Object.assign(event, { pointerId, pointerType });
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

  it('tracks compatibility mouse presses without accepting touch input', () => {
    const move = vi.fn();
    const end = vi.fn();
    trackPointer({ clientX: 10 }, move, end);
    pointer('pointermove');
    pointer('pointerup');
    expect(end).not.toHaveBeenCalled();
    pointer('pointermove', 4, 'mouse');
    pointer('pointerup', 4, 'mouse');
    expect(move).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledExactlyOnceWith(true);
  });
});
