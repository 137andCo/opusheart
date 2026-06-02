import { z } from 'zod';

/**
 * The page-builder block model — the single source of truth for the content
 * blocks a page can contain. The web renderer, the dashboard editor, and the
 * server all consume this, so a block's shape, defaults, and validation live in
 * exactly one place.
 */

export type BlockType = 'hero' | 'heading' | 'paragraph' | 'image';

export const heroBlockSchema = z.object({
  type: z.literal('hero'),
  eyebrow: z.string().max(120).default(''),
  heading: z.string().max(200).default(''),
  subheading: z.string().max(500).default(''),
  ctaLabel: z.string().max(80).default(''),
  ctaHref: z.string().max(2000).default(''),
  align: z.enum(['left', 'center']).default('left'),
});

export const headingBlockSchema = z.object({
  type: z.literal('heading'),
  text: z.string().max(300).default(''),
  level: z.number().int().min(2).max(4).default(2),
});

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string().default(''),
});

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().max(2000).default(''),
  alt: z.string().max(300).default(''),
  caption: z.string().max(300).default(''),
});

export const blockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  headingBlockSchema,
  paragraphBlockSchema,
  imageBlockSchema,
]);

export const pageContentSchema = z.array(blockSchema);

export type HeroBlock = z.infer<typeof heroBlockSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type Block = z.infer<typeof blockSchema>;

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  create: () => Block;
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  hero: {
    type: 'hero',
    label: 'Hero',
    description: 'A bold opening section: eyebrow, heading, subheading, and a call to action.',
    create: (): HeroBlock => ({ type: 'hero', eyebrow: '', heading: '', subheading: '', ctaLabel: '', ctaHref: '', align: 'left' }),
  },
  heading: {
    type: 'heading',
    label: 'Heading',
    description: 'A section heading (H2–H4).',
    create: (): HeadingBlock => ({ type: 'heading', text: '', level: 2 }),
  },
  paragraph: {
    type: 'paragraph',
    label: 'Paragraph',
    description: 'A block of body text.',
    create: (): ParagraphBlock => ({ type: 'paragraph', text: '' }),
  },
  image: {
    type: 'image',
    label: 'Image',
    description: 'An image with alt text and an optional caption.',
    create: (): ImageBlock => ({ type: 'image', src: '', alt: '', caption: '' }),
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_DEFINITIONS) as BlockType[];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && value in BLOCK_DEFINITIONS;
}

export function createBlock(type: BlockType): Block {
  return BLOCK_DEFINITIONS[type].create();
}

/**
 * Allow only safe URL schemes for block links (hero CTAs etc.) — blocks
 * javascript:/data:/vbscript: and other script-bearing schemes. Returns the
 * href if safe, otherwise null.
 */
export function safeBlockHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(h) ? h : null;
}

export const BUILDER_VERSION = '0.1.0';
