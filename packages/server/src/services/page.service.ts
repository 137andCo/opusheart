import { Page, type IPageDocument } from '../models/Page.js';
import { AppError } from '../utils/errors.js';
import { sanitizePageContent } from '../utils/sanitize.js';

interface PageQuery {
  status?: string;
  search?: string;
  locale?: string;
  page: number;
  limit: number;
}

interface PaginatedResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PageService {
  async create(data: Record<string, unknown>, createdBy: string): Promise<IPageDocument> {
    // Check slug uniqueness (also enforced by DB index)
    const slug = data['slug'] as string;
    const existing = await Page.findOne({ slug });
    if (existing) {
      throw new AppError('A page with this slug already exists', 409, 'SLUG_EXISTS');
    }

    // Sanitize content to prevent stored XSS
    if (Array.isArray(data['content'])) {
      data['content'] = sanitizePageContent(data['content']);
    }

    const page = await Page.create({
      ...data,
      createdBy,
    });

    return page;
  }

  async findById(id: string): Promise<IPageDocument> {
    const page = await Page.findById(id);
    if (!page) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }
    return page;
  }

  async findBySlug(slug: string): Promise<IPageDocument> {
    const page = await Page.findOne({ slug, status: 'published' });
    if (!page) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }
    return page;
  }

  async findAll(query: PageQuery): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.locale) {
      filter['locale'] = query.locale;
    }
    if (query.search) {
      const searchRegex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [
        { title: searchRegex },
        { slug: searchRegex },
      ];
    }

    const [data, total] = await Promise.all([
      Page.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      Page.countDocuments(filter),
    ]);

    return {
      data: data.map(p => p.toJSON()),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, data: Record<string, unknown>, updatedBy: string): Promise<IPageDocument> {
    const page = await Page.findById(id);
    if (!page) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    // If status is changing to published, set publishedAt and publishedBy
    if (data['status'] === 'published' && page.status !== 'published') {
      data['publishedAt'] = new Date();
      data['publishedBy'] = updatedBy;
    }

    // Check slug uniqueness if slug is being changed
    if (data['slug'] && data['slug'] !== page.slug) {
      const newSlug = data['slug'] as string;
      const slugExists = await Page.findOne({ slug: newSlug, _id: { $ne: id } });
      if (slugExists) {
        throw new AppError('A page with this slug already exists', 409, 'SLUG_EXISTS');
      }
    }

    // Sanitize content to prevent stored XSS
    if (Array.isArray(data['content'])) {
      data['content'] = sanitizePageContent(data['content']);
    }

    Object.assign(page, data);
    await page.save();
    return page;
  }

  async delete(id: string): Promise<void> {
    const page = await Page.findById(id);
    if (!page) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    page.status = 'archived';
    await page.save();
  }

  async publish(id: string, publishedBy: string): Promise<IPageDocument> {
    const page = await Page.findById(id);
    if (!page) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    page.status = 'published';
    page.publishedAt = new Date();
    page.publishedBy = publishedBy as any;
    await page.save();
    return page;
  }

  async duplicate(id: string, createdBy: string): Promise<IPageDocument> {
    const original = await Page.findById(id);
    if (!original) {
      throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    // Generate a unique slug
    let newSlug = `${original.slug}-copy`;
    let counter = 1;
    while (await Page.findOne({ slug: newSlug })) {
      newSlug = `${original.slug}-copy-${counter}`;
      counter++;
    }

    const duplicate = await Page.create({
      title: `${original.title} (Copy)`,
      slug: newSlug,
      content: original.content,
      status: 'draft',
      template: original.template,
      seo: original.seo,
      locale: original.locale,
      createdBy,
    });

    return duplicate;
  }
}
