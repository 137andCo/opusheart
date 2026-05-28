import { PageTemplate, type IPageTemplateDocument } from '../models/PageTemplate.js';
import { Page, type IPageDocument } from '../models/Page.js';
import { sanitizePageContent } from '../utils/sanitize.js';
import { AppError } from '../utils/errors.js';

export class TemplateService {
  async findAll(vertical?: string): Promise<IPageTemplateDocument[]> {
    const filter: Record<string, unknown> = {};
    if (vertical) {
      filter['vertical'] = vertical;
    }
    return PageTemplate.find(filter).sort({ category: 1, name: 1 }).exec();
  }

  async findById(id: string): Promise<IPageTemplateDocument> {
    const template = await PageTemplate.findById(id);
    if (!template) {
      throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }
    return template;
  }

  async create(data: Record<string, unknown>): Promise<IPageTemplateDocument> {
    if (Array.isArray(data['content'])) {
      data['content'] = sanitizePageContent(data['content']);
    }
    return PageTemplate.create(data);
  }

  async createPageFromTemplate(
    templateId: string,
    pageData: { title: string; slug: string; locale?: string },
    createdBy: string
  ): Promise<IPageDocument> {
    const template = await PageTemplate.findById(templateId);
    if (!template) {
      throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Check slug uniqueness
    const existing = await Page.findOne({ slug: pageData.slug });
    if (existing) {
      throw new AppError('A page with this slug already exists', 409, 'SLUG_EXISTS');
    }

    const page = await Page.create({
      title: pageData.title,
      slug: pageData.slug,
      content: Array.isArray(template.content) ? sanitizePageContent(template.content) : [],
      template: template.name,
      locale: pageData.locale || 'en',
      seo: { noIndex: false },
      createdBy,
    });

    return page;
  }
}
