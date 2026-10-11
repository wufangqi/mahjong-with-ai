import { describe, expect, it } from 'vitest';
import { CONTENT_SECURITY_POLICY, cspMetaTag } from './csp';

describe('CONTENT_SECURITY_POLICY', () => {
  it('allows same-origin and HTTPS connect-src for optional external AI proxies', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src[^;]*'self'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src[^;]*https:/);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/connect-src[^;]*\*/);
  });

  it('blocks framing and default third-party script hosts', () => {
    expect(CONTENT_SECURITY_POLICY).toMatch(/default-src 'self'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/frame-ancestors 'none'/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/object-src 'none'/);
  });

  it('builds a meta tag for static hosts that cannot set response headers', () => {
    const tag = cspMetaTag();
    expect(tag).toContain('http-equiv="Content-Security-Policy"');
    expect(tag).toContain(CONTENT_SECURITY_POLICY);
  });
});
