/** Player-facing copy for the WebGL2 compatibility page. */
export const WEBGL2_UNSUPPORTED_MESSAGE =
  '本应用需要支持 WebGL2 的桌面浏览器（当前 Chrome、Edge、Firefox 或 Safari）。未检测到可用的 WebGL2，无法进入牌局。';

export type CanvasLike = {
  getContext(
    contextId: 'webgl2',
    options?: WebGLContextAttributes,
  ): WebGL2RenderingContext | null;
};

/** Probe whether this canvas (or a temporary one) can create a WebGL2 context. */
export function isWebGL2Available(canvas?: CanvasLike | null): boolean {
  try {
    const el =
      canvas ??
      (typeof document !== 'undefined'
        ? document.createElement('canvas')
        : null);
    if (!el) return false;
    const gl = el.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    return gl != null;
  } catch {
    return false;
  }
}

/** Show the dedicated WebGL2 unsupported page and mark the boot as failed. */
export function showWebGL2UnsupportedPage(doc: Document = document): void {
  const title = doc.querySelector('#error h2');
  const body = doc.querySelector('#error p');
  const root = doc.getElementById('error');
  if (title) title.textContent = '不支持 WebGL2';
  if (body) body.textContent = WEBGL2_UNSUPPORTED_MESSAGE;
  if (root) root.setAttribute('data-testid', 'webgl2-unsupported');
  doc.body.classList.add('failed');
  doc.body.classList.remove('loading');
  const loading = doc.getElementById('boot-loading');
  if (loading) loading.hidden = true;
}
