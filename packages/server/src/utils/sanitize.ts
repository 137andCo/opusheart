import sanitizeHtmlLib from 'sanitize-html';

/**
 * Server-side HTML sanitization for any user-authored rich text that is later
 * rendered with v-html (page builder blocks, broadcast message bodies, sermon
 * notes/outline). Backed by the `sanitize-html` parser — NOT a regex stripper,
 * which is bypassable via malformed tags, attribute splitting, and mutation XSS.
 *
 * Policy: a conservative allow-list of formatting + media tags, safe URL schemes
 * only (no javascript:/data:/vbscript:), no event handlers, and forced
 * rel="noopener noreferrer nofollow" on links to prevent reverse tabnabbing.
 */
const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: [
    'a', 'b', 'i', 'u', 'em', 'strong', 'p', 'br', 'hr', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'sub', 'sup',
    'figure', 'figcaption', 'img', 'video', 'audio', 'source',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    video: ['src', 'controls', 'width', 'height', 'poster', 'preload'],
    audio: ['src', 'controls', 'preload'],
    source: ['src', 'type'],
    '*': ['class'],
  },
  // Only safe URL schemes. Notably excludes javascript:, vbscript:, and data:
  // (data: URIs on <img>/<svg> are a known XSS vector).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
    source: ['http', 'https'],
    video: ['http', 'https'],
    audio: ['http', 'https'],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
  },
};

export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string' || html.length === 0) return '';
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}

/**
 * Sanitize page-builder content blocks in place (each block may carry a `text`
 * or `html` string field).
 */
export function sanitizePageContent(content: unknown[]): unknown[] {
  if (!Array.isArray(content)) return [];
  return content.map((block: any) => {
    const sanitized = { ...block };
    if (typeof sanitized.text === 'string') {
      sanitized.text = sanitizeHtml(sanitized.text);
    }
    if (typeof sanitized.html === 'string') {
      sanitized.html = sanitizeHtml(sanitized.html);
    }
    return sanitized;
  });
}
