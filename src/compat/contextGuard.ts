export type WebGLContextGuardHandlers = {
  onLost: () => void;
  onRestored: () => void;
};

export type WebGLContextGuard = {
  isLost: () => boolean;
  /** Clear lost flag after an explicit GPU rebuild when the restored event is missing. */
  markRestored: () => void;
  detach: () => void;
};

/**
 * Listen for WebGL context loss/restore.
 * Calling preventDefault on `webglcontextlost` allows the browser to restore when possible.
 */
export function attachWebGLContextGuard(
  canvas: HTMLCanvasElement,
  handlers: WebGLContextGuardHandlers,
): WebGLContextGuard {
  let lost = false;

  const onLost = (event: Event): void => {
    event.preventDefault();
    lost = true;
    handlers.onLost();
  };

  const onRestored = (): void => {
    lost = false;
    handlers.onRestored();
  };

  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  return {
    isLost: () => lost,
    markRestored: () => {
      lost = false;
    },
    detach: () => {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      canvas.removeEventListener('webglcontextrestored', onRestored, false);
    },
  };
}
