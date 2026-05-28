import { Sermon, type ISermonDocument } from '../models/Sermon.js';
import { SermonSeries, type ISermonSeriesDocument } from '../models/SermonSeries.js';
import { AppError } from '../utils/errors.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import type { CreateSermonInput } from '@opusheart/shared/schemas/sermon.schema.js';

// Sermon notes/outline are rendered with v-html on the PUBLIC site, so they must
// be sanitized server-side before storage to prevent stored XSS.
function sanitizeSermonFields<T extends Record<string, any>>(data: T): T {
  const out: any = { ...data };
  if (typeof out.notes === 'string') out.notes = sanitizeHtml(out.notes);
  if (typeof out.outline === 'string') out.outline = sanitizeHtml(out.outline);
  return out;
}

export class SermonService {
  // ── Sermon CRUD ──────────────────────────────────────────

  async create(data: CreateSermonInput, createdBy: string): Promise<ISermonDocument> {
    return Sermon.create({ ...sanitizeSermonFields(data), createdBy });
  }

  async findById(id: string): Promise<ISermonDocument> {
    const sermon = await Sermon.findById(id).populate('series');
    if (!sermon) throw new AppError('Sermon not found', 404, 'SERMON_NOT_FOUND');
    return sermon;
  }

  async findAll(query: {
    series?: string;
    speaker?: string;
    search?: string;
    published?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    sermons: ISermonDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.series) filter['series'] = query.series;
    if (query.speaker) filter['speaker'] = query.speaker;
    if (query.published !== undefined) filter['published'] = query.published;
    if (query.search) filter['$text'] = { $search: query.search };

    const [sermons, total] = await Promise.all([
      Sermon.find(filter).populate('series').sort({ date: -1 }).skip((page - 1) * limit).limit(limit),
      Sermon.countDocuments(filter),
    ]);

    return { sermons, total, page, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, data: Partial<CreateSermonInput>): Promise<ISermonDocument> {
    const sermon = await Sermon.findById(id);
    if (!sermon) throw new AppError('Sermon not found', 404, 'SERMON_NOT_FOUND');
    Object.assign(sermon, sanitizeSermonFields(data));
    await sermon.save();
    return sermon;
  }

  async delete(id: string): Promise<void> {
    const sermon = await Sermon.findById(id);
    if (!sermon) throw new AppError('Sermon not found', 404, 'SERMON_NOT_FOUND');
    await sermon.deleteOne();
  }

  // ── Published / public queries ───────────────────────────

  async findPublished(query: {
    series?: string;
    speaker?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    sermons: ISermonDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.findAll({ ...query, published: true });
  }

  async findBySeries(seriesId: string): Promise<ISermonDocument[]> {
    return Sermon.find({ series: seriesId }).sort({ seriesOrder: 1 }).limit(200);
  }

  // ── Podcast RSS feed ─────────────────────────────────────

  async generatePodcastFeed(instanceName: string, instanceUrl: string): Promise<string> {
    const sermons = await Sermon.find({
      podcastInclude: true,
      audioUrl: { $exists: true, $ne: '' },
      published: true,
    }).sort({ date: -1 }).limit(500);

    const items = sermons
      .map((s) => {
        const pubDate = s.date.toUTCString();
        const desc = escapeXml(s.description);
        const title = escapeXml(s.title);
        return `    <item>
      <title>${title}</title>
      <description>${desc}</description>
      <enclosure url="${escapeXml(s.audioUrl!)}" type="audio/mpeg" />
      <pubDate>${pubDate}</pubDate>
    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(instanceName)} Sermons</title>
    <link>${escapeXml(instanceUrl)}/sermons</link>
    <description>Sermon podcast from ${escapeXml(instanceName)}</description>
${items}
  </channel>
</rss>`;
  }

  // ── Series CRUD ──────────────────────────────────────────

  async createSeries(data: { title: string; description?: string; imageUrl?: string; startDate: Date; endDate?: Date }, createdBy: string): Promise<ISermonSeriesDocument> {
    return SermonSeries.create({ ...data, createdBy });
  }

  async findSeriesById(id: string): Promise<ISermonSeriesDocument> {
    const series = await SermonSeries.findById(id);
    if (!series) throw new AppError('Series not found', 404, 'SERIES_NOT_FOUND');
    return series;
  }

  async findAllSeries(): Promise<ISermonSeriesDocument[]> {
    return SermonSeries.find().sort({ startDate: -1 }).limit(200);
  }

  async updateSeries(id: string, data: Partial<{ title: string; description: string; imageUrl: string; startDate: Date; endDate: Date }>): Promise<ISermonSeriesDocument> {
    const series = await SermonSeries.findById(id);
    if (!series) throw new AppError('Series not found', 404, 'SERIES_NOT_FOUND');
    Object.assign(series, data);
    await series.save();
    return series;
  }

  async deleteSeries(id: string): Promise<void> {
    const series = await SermonSeries.findById(id);
    if (!series) throw new AppError('Series not found', 404, 'SERIES_NOT_FOUND');
    await series.deleteOne();
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const sermonService = new SermonService();
