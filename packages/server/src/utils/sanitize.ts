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
 * Sanitize one page-builder block, recursing into its nested `content` children.
 * The block schema is tiptap-style — a `text`/`html` payload can sit several
 * levels deep (e.g. bulletList > listItem > paragraph > text), so a top-level-
 * only pass would leave nested user text unsanitized.
 */
function sanitizeBlock(block: any): any {
  if (!block || typeof block !== 'object') return block;
  const sanitized = { ...block };
  if (typeof sanitized.text === 'string') {
    sanitized.text = sanitizeHtml(sanitized.text);
  }
  if (typeof sanitized.html === 'string') {
    sanitized.html = sanitizeHtml(sanitized.html);
  }
  if (Array.isArray(sanitized.content)) {
    sanitized.content = sanitized.content.map(sanitizeBlock);
  }
  return sanitized;
}

/**
 * Sanitize page-builder content blocks, descending into nested content so every
 * user-authored text/html node at any depth is cleaned.
 */
export function sanitizePageContent(content: unknown[]): unknown[] {
  if (!Array.isArray(content)) return [];
  return content.map(sanitizeBlock);
}
