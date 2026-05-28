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
});
