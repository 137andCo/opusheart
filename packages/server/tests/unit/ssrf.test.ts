import { describe, it, expect } from '@jest/globals';
import { isSafePeerUrl, isPrivateIp } from '../../src/services/federation.service.js';

describe('isSafePeerUrl (federation SSRF guard)', () => {
  it('allows public https URLs (IP literals resolve locally, no network needed)', async () => {
    expect(await isSafePeerUrl('https://8.8.8.8')).toBe(true);
    expect(await isSafePeerUrl('https://1.1.1.1/api')).toBe(true);
  });

  it('rejects non-https schemes', async () => {
    expect(await isSafePeerUrl('http://example.org')).toBe(false);
    expect(await isSafePeerUrl('ftp://example.org')).toBe(false);
    expect(await isSafePeerUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects localhost and loopback', async () => {
    expect(await isSafePeerUrl('https://localhost/api')).toBe(false);
    expect(await isSafePeerUrl('https://127.0.0.1')).toBe(false);
    expect(await isSafePeerUrl('https://[::1]')).toBe(false);
  });

  it('rejects private network ranges', async () => {
    expect(await isSafePeerUrl('https://10.0.0.5')).toBe(false);
    expect(await isSafePeerUrl('https://192.168.1.1')).toBe(false);
    expect(await isSafePeerUrl('https://172.16.0.1')).toBe(false);
  });

  it('rejects link-local and cloud metadata endpoint', async () => {
    expect(await isSafePeerUrl('https://169.254.169.254')).toBe(false);
  });

  it('rejects IPv4-mapped IPv6, decimal, hex, and octal IP encodings', async () => {
    expect(await isSafePeerUrl('https://[::ffff:127.0.0.1]')).toBe(false);
    expect(await isSafePeerUrl('https://[::ffff:169.254.169.254]')).toBe(false);
    expect(await isSafePeerUrl('https://2130706433')).toBe(false); // 127.0.0.1 as int
    expect(await isSafePeerUrl('https://0x7f000001')).toBe(false);  // 127.0.0.1 as hex
    expect(await isSafePeerUrl('https://0177.0.0.1')).toBe(false);  // octal first octet
  });

  it('rejects garbage input', async () => {
    expect(await isSafePeerUrl('not a url')).toBe(false);
    expect(await isSafePeerUrl('')).toBe(false);
  });
});

describe('isPrivateIp', () => {
  it('flags private/loopback/link-local/CGNAT/metadata literals', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.5.5',
      '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it('passes public literals', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});
