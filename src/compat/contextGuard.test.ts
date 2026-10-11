import { describe, expect, it, vi } from 'vitest';
import { attachWebGLContextGuard } from './contextGuard';

function fakeCanvas() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn);
    },
    dispatch(type: string, event: Event) {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
  };
}

describe('attachWebGLContextGuard', () => {
  it('prevents default on context lost so the browser may restore', () => {
    const canvas = fakeCanvas();
    const onLost = vi.fn();
    const onRestored = vi.fn();
    attachWebGLContextGuard(canvas as unknown as HTMLCanvasElement, { onLost, onRestored });

    const lost = new Event('webglcontextlost', { cancelable: true });
    const prevented = vi.spyOn(lost, 'preventDefault');
    canvas.dispatch('webglcontextlost', lost);

    expect(prevented).toHaveBeenCalled();
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('notifies on context restored for GPU resource rebuild', () => {
    const canvas = fakeCanvas();
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const guard = attachWebGLContextGuard(canvas as unknown as HTMLCanvasElement, {
      onLost,
      onRestored,
    });

    canvas.dispatch('webglcontextlost', new Event('webglcontextlost', { cancelable: true }));
    expect(guard.isLost()).toBe(true);

    canvas.dispatch('webglcontextrestored', new Event('webglcontextrestored'));
    expect(onRestored).toHaveBeenCalledTimes(1);
    expect(guard.isLost()).toBe(false);
  });

  it('detach removes listeners', () => {
    const canvas = fakeCanvas();
    const onLost = vi.fn();
    const guard = attachWebGLContextGuard(canvas as unknown as HTMLCanvasElement, {
      onLost,
      onRestored: () => undefined,
    });
    guard.detach();
    canvas.dispatch('webglcontextlost', new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).not.toHaveBeenCalled();
  });

  it('markRestored clears lost when the browser event is missing', () => {
    const canvas = fakeCanvas();
    const guard = attachWebGLContextGuard(canvas as unknown as HTMLCanvasElement, {
      onLost: () => undefined,
      onRestored: () => undefined,
    });
    canvas.dispatch('webglcontextlost', new Event('webglcontextlost', { cancelable: true }));
    expect(guard.isLost()).toBe(true);
    guard.markRestored();
    expect(guard.isLost()).toBe(false);
  });
});
