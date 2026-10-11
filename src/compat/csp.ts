/**
 * Static-host CSP for GitHub Pages / arbitrary static servers.
 * connect-src allows same-origin and HTTPS so a user-configured AI proxy can work;
 * application logic still sends only to the one configured proxy URL.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** Meta tag for hosts that cannot set Content-Security-Policy response headers. */
export function cspMetaTag(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`;
}
