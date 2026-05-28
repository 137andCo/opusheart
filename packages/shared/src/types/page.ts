export type PageStatus = 'draft' | 'published' | 'archived';

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: PageBlock[];
  status: PageStatus;
  template?: string;
  seo: PageSeo;
  locale: string;
  translations: Record<string, string>;
  publishedAt?: Date;
  publishedBy?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageBlock {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PageBlock[];
  text?: string;
  marks?: PageMark[];
}

export interface PageMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PageSeo {
  title?: string;
  description?: string;
  ogImage?: string;
  noIndex: boolean;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  vertical: string;
  thumbnail?: string;
  content: PageBlock[];
  category: string;
}
