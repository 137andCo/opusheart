import { Theme, type IThemeDocument } from '../models/Theme.js';

const DEFAULT_THEME: Record<string, unknown> = {
  primaryColor: '#1e40af',
  secondaryColor: '#f59e0b',
  fontFamily: 'Inter, sans-serif',
  customCss: '',
};

/**
 * Sanitize admin-authored custom CSS.
 *
 * RENDERING CONTRACT: the returned string is only ever safe to inject into a
 * dedicated, scoped `<style>` element — it must NEVER be reflected into an HTML
 * attribute or element body, where it would no longer be CSS.
 *
 * A blocklist regex can't fully parse CSS, so instead of trying to allow some
 * url()/scheme combinations we remove the dangerous primitives WHOLESALE:
 *  - every url(...) value -> url() — kills external resource loads entirely
 *    (data:/javascript: payloads, plus selector-based exfiltration and
 *    third-party font/image tracking),
 *  - @import (external stylesheet load / exfil),
 *  - expression()/behavior/-moz-binding (legacy script-in-CSS),
 *  - </style> and HTML comment markers (style-context breakout).
 * Legitimate @media / @keyframes / @font-face rules survive; only their url()s
 * are neutralized.
 */
function sanitizeCss(css: string): string {
  let sanitized = css.replace(/\0/g, '');
  // Neutralize EVERY url(...) — no external or inline resource loading at all.
  sanitized = sanitized.replace(/url\s*\([^)]*\)?/gi, 'url()');
  sanitized = sanitized.replace(/@import\b/gi, '/* blocked */');
  sanitized = sanitized.replace(/expression\s*\(/gi, '/* blocked */(');
  sanitized = sanitized.replace(/behavior\s*:/gi, '/* blocked */:');
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, '/* blocked */:');
  sanitized = sanitized.replace(/<\/?style\b[^>]*>/gi, '/* blocked */');
  sanitized = sanitized.replace(/<!--/g, '/* blocked */');
  sanitized = sanitized.replace(/-->/g, '/* blocked */');
  return sanitized;
}

export class ThemeService {
  async getTheme(): Promise<Record<string, unknown>> {
    const theme = await Theme.findOne().sort({ createdAt: -1 });
    if (!theme) {
      return { ...DEFAULT_THEME };
    }
    return theme.toJSON() as unknown as Record<string, unknown>;
  }

  async updateTheme(data: Record<string, unknown>): Promise<IThemeDocument> {
    // Sanitize customCss if provided
    if (typeof data['customCss'] === 'string') {
      data['customCss'] = sanitizeCss(data['customCss']);
    }

    // Upsert pattern — only one active theme per instance
    const existing = await Theme.findOne().sort({ createdAt: -1 });
    if (existing) {
      Object.assign(existing, data);
      await existing.save();
      return existing;
    }

    return Theme.create({ ...DEFAULT_THEME, ...data } as any);
  }
}
