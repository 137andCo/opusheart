import { Theme, type IThemeDocument } from '../models/Theme.js';

const DEFAULT_THEME: Record<string, unknown> = {
  primaryColor: '#1e40af',
  secondaryColor: '#f59e0b',
  fontFamily: 'Inter, sans-serif',
  customCss: '',
};

/**
 * Strip dangerous CSS constructs that could enable XSS or data exfiltration.
 * Allows normal styling but blocks expressions, JS URLs, external imports, etc.
 */
function sanitizeCss(css: string): string {
  // Remove null bytes
  let sanitized = css.replace(/\0/g, '');
  // Strip CSS expressions (IE) and similar eval constructs
  sanitized = sanitized.replace(/expression\s*\(/gi, '/* blocked */');
  // Strip behavior/binding properties (IE/Firefox XBL)
  sanitized = sanitized.replace(/behavior\s*:/gi, '/* blocked */');
  sanitized = sanitized.replace(/-moz-binding\s*:/gi, '/* blocked */');
  // Strip @import (prevents loading external stylesheets / data exfil)
  sanitized = sanitized.replace(/@import\b/gi, '/* blocked */');
  // Strip url() containing javascript: or data: with scripts
  sanitized = sanitized.replace(/url\s*\(\s*['"]?\s*javascript\s*:/gi, 'url(/* blocked */');
  sanitized = sanitized.replace(/url\s*\(\s*['"]?\s*data\s*:\s*text\/html/gi, 'url(/* blocked */');
  // Strip HTML comment sequences that could break out of style context
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
