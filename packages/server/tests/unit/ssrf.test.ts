import { describe, it, expect } from '@jest/globals';
import { isSafePeerUrl } from '../../src/services/federation.service.js';

describe('isSafePeerUrl (federation SSRF guard)', () => {
  it('allows public https URLs', () => {
    expect(isSafePeerUrl('https://grace.example.org')).toBe(true);
    expect(isSafePeerUrl('https://opusheart.anotherchurch.com/api')).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(isSafePeerUrl('http://grace.example.org')).toBe(false);
    expect(isSafePeerUrl('ftp://grace.example.org')).toBe(false);
    expect(isSafePeerUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects localhost and loopback', () => {
    expect(isSafePeerUrl('https://localhost/api')).toBe(false);
    expect(isSafePeerUrl('https://127.0.0.1')).toBe(false);
    expect(isSafePeerUrl('https://[::1]')).toBe(false);
  });

  it('rejects private network ranges', () => {
    expect(isSafePeerUrl('https://10.0.0.5')).toBe(false);
    expect(isSafePeerUrl('https://192.168.1.1')).toBe(false);
    expect(isSafePeerUrl('https://172.16.0.1')).toBe(false);
  });

  it('rejects link-local and cloud metadata endpoint', () => {
    expect(isSafePeerUrl('https://169.254.169.254')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isSafePeerUrl('not a url')).toBe(false);
    expect(isSafePeerUrl('')).toBe(false);
  });
});
