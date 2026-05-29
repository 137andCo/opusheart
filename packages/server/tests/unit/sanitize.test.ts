import { describe, it, expect } from '@jest/globals';
import { sanitizeHtml, sanitizePageContent } from '../../src/utils/sanitize.js';

describe('sanitizeHtml', () => {
  it('strips <script> tags and their content', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips inline event-handler attributes', () => {
    const out = sanitizeHtml('<img src="https://x/y.png" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('strips javascript: URLs on links', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain('javascript:');
  });

  it('discards svg/onload payloads entirely', () => {
    const out = sanitizeHtml('<svg onload=alert(1)></svg>');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('<svg');
  });

  it('strips data: URIs (img XSS vector)', () => {
    const out = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).not.toContain('data:');
  });

  it('keeps safe formatting tags', () => {
    expect(sanitizeHtml('<strong>bold</strong>')).toContain('<strong>');
  });

  it('forces rel=noopener on links (reverse-tabnabbing)', () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('handles non-string / empty input safely', () => {
    expect(sanitizeHtml('')).toBe('');
    // @ts-expect-error testing runtime guard
    expect(sanitizeHtml(null)).toBe('');
  });

  it('sanitizes page-builder content blocks', () => {
    const blocks = sanitizePageContent([{ type: 'text', html: '<script>bad</script><em>ok</em>' }]);
    const json = JSON.stringify(blocks);
    expect(json).not.toContain('<script>');
    expect(json).toContain('<em>');
  });

  it('sanitizes DEEPLY NESTED block content, not just top-level', () => {
    const blocks = sanitizePageContent([
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              { type: 'paragraph', content: [{ type: 'text', html: '<img src=x onerror=alert(1)><em>ok</em>' }] },
            ],
          },
        ],
      },
    ]);
    const json = JSON.stringify(blocks);
    expect(json).not.toContain('onerror');
    expect(json).toContain('<em>');
  });
});

describe('sanitizeMongo (prototype pollution)', () => {
  // Re-import the scrubber indirectly: it mutates in place via the middleware.
  it('strips __proto__/constructor/prototype and $-/dotted keys from the body', async () => {
    const { sanitizeMongo } = await import('../../src/middleware/sanitizeMongo.js');
    const body: Record<string, unknown> = JSON.parse(
      '{"name":"ok","__proto__":{"admin":true},"constructor":{"x":1},"$where":"1","a.b":2,"nested":{"$gt":""}}',
    );
    const req = { body, params: {}, query: {} } as any;
    sanitizeMongo(req, {} as any, () => {});

    expect(req.body.name).toBe('ok');
    expect(Object.prototype.hasOwnProperty.call(req.body, '__proto__')).toBe(false);
    // own `constructor` key removed (the property still resolves up the prototype
    // chain to Object.prototype.constructor — that's expected and harmless).
    expect(Object.prototype.hasOwnProperty.call(req.body, 'constructor')).toBe(false);
    expect(req.body.$where).toBeUndefined();
    expect(req.body['a.b']).toBeUndefined();
    expect(req.body.nested).toEqual({});
    // global prototype not polluted
    expect(({} as any).admin).toBeUndefined();
  });
});
