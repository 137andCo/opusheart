import { describe, it, expect } from '@jest/globals';
import {
  BLOCK_TYPES,
  BLOCK_DEFINITIONS,
  createBlock,
  isBlockType,
  safeBlockHref,
  blockSchema,
  pageContentSchema,
} from '@opusheart/builder';

describe('@opusheart/builder block model', () => {
  it('exposes the four block types, each with a definition', () => {
    expect(BLOCK_TYPES).toEqual(['hero', 'heading', 'paragraph', 'image']);
    for (const t of BLOCK_TYPES) {
      expect(BLOCK_DEFINITIONS[t].label).toBeTruthy();
      expect(BLOCK_DEFINITIONS[t].description).toBeTruthy();
    }
  });

  it('createBlock returns a schema-valid block of the requested type', () => {
    for (const t of BLOCK_TYPES) {
      const block = createBlock(t);
      expect(block.type).toBe(t);
      expect(blockSchema.safeParse(block).success).toBe(true);
    }
  });

  it('isBlockType guards known vs unknown types', () => {
    expect(isBlockType('hero')).toBe(true);
    expect(isBlockType('image')).toBe(true);
    expect(isBlockType('nope')).toBe(false);
    expect(isBlockType(42)).toBe(false);
  });

  it('safeBlockHref allows safe schemes and blocks script-bearing ones', () => {
    expect(safeBlockHref('/events')).toBe('/events');
    expect(safeBlockHref('#section')).toBe('#section');
    expect(safeBlockHref('https://example.org')).toBe('https://example.org');
    expect(safeBlockHref('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeBlockHref('javascript:alert(1)')).toBeNull();
    expect(safeBlockHref('data:text/html,<script>')).toBeNull();
    expect(safeBlockHref('vbscript:msgbox')).toBeNull();
    expect(safeBlockHref(123)).toBeNull();
    expect(safeBlockHref(undefined)).toBeNull();
  });

  it('pageContentSchema validates an array of blocks and rejects unknown types', () => {
    expect(pageContentSchema.safeParse([createBlock('hero'), createBlock('heading')]).success).toBe(true);
    expect(pageContentSchema.safeParse([{ type: 'unknown' }]).success).toBe(false);
  });
});
