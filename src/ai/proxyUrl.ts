/** True when the proxy URL is allowed for the current runtime policy. */
export function isAllowedProxyUrl(
  raw: string,
  opts: { allowHttpLocalhost: boolean },
): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  if (
    opts.allowHttpLocalhost &&
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    return true;
  }
  return false;
}

/** Join a proxy base URL with the OpenAI-compatible chat completions path. */
export function chatCompletionsUrl(proxyBase: string): string {
  const base = proxyBase.replace(/\/+$/, '');
  if (base.endsWith('/v1/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}
