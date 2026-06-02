import { Resource } from '../models/Resource.js';

const RESOURCE_INDEX = 'opusheart-resources';

/**
 * Search for the community resource directory.
 *
 * Backed by Elasticsearch when `ELASTICSEARCH_URL` is set (the docker-compose
 * `search` profile runs one), with fuzzy, relevance-ranked matching. When it is
 * NOT set, or ES is unreachable, search falls back to MongoDB so the endpoint
 * always works — ES is an enhancement, never a hard dependency. Indexing is
 * best-effort: a search outage never blocks a content write.
 */
export class SearchService {
  private clientPromise: Promise<any> | null = null;

  private get url(): string {
    return process.env['ELASTICSEARCH_URL'] || '';
  }

  enabled(): boolean {
    return Boolean(this.url);
  }

  private async client(): Promise<any> {
    if (!this.clientPromise) {
      const node = this.url;
      this.clientPromise = import('@elastic/elasticsearch').then(({ Client }) => new Client({ node }));
    }
    return this.clientPromise;
  }

  async ensureIndices(): Promise<void> {
    if (!this.enabled()) return;
    const client = await this.client();
    const exists = await client.indices.exists({ index: RESOURCE_INDEX });
    if (!exists) {
      await client.indices.create({
        index: RESOURCE_INDEX,
        mappings: {
          properties: {
            name: { type: 'text' },
            description: { type: 'text' },
            provider: { type: 'text' },
            category: { type: 'keyword' },
            tags: { type: 'keyword' },
            languages: { type: 'keyword' },
            approved: { type: 'boolean' },
          },
        },
      });
    }
  }

  private resourceDoc(r: any): Record<string, unknown> {
    const j = typeof r.toJSON === 'function' ? r.toJSON() : r;
    return {
      name: j.name,
      description: j.description,
      provider: j.provider,
      category: j.category,
      tags: j.tags ?? [],
      languages: j.languages ?? [],
      approved: j.approved !== false,
    };
  }

  async indexResource(resource: any): Promise<void> {
    if (!this.enabled()) return;
    try {
      const client = await this.client();
      await client.index({
        index: RESOURCE_INDEX,
        id: String(resource._id ?? resource.id),
        document: this.resourceDoc(resource),
      });
    } catch {
      // Best-effort: never block a content write on search indexing.
    }
  }

  async removeResource(id: string): Promise<void> {
    if (!this.enabled()) return;
    try {
      const client = await this.client();
      await client.delete({ index: RESOURCE_INDEX, id: String(id) }, { ignore: [404] });
    } catch {
      // Best-effort.
    }
  }

  /** Bulk-load the index from MongoDB (called on startup, and re-runnable). */
  async reindexAll(): Promise<number> {
    if (!this.enabled()) return 0;
    await this.ensureIndices();
    const resources = await Resource.find({ approved: true });
    for (const r of resources) await this.indexResource(r);
    return resources.length;
  }

  async search(
    q: string,
    opts: { category?: string; limit?: number } = {},
  ): Promise<{ backend: 'elasticsearch' | 'database'; results: Array<Record<string, unknown>> }> {
    const limit = Math.min(opts.limit ?? 20, 50);

    if (this.enabled()) {
      try {
        const client = await this.client();
        const filter: any[] = [{ term: { approved: true } }];
        if (opts.category) filter.push({ term: { category: opts.category } });
        const resp = await client.search({
          index: RESOURCE_INDEX,
          size: limit,
          query: {
            bool: {
              must: q
                ? [{ multi_match: { query: q, fields: ['name^3', 'provider^2', 'description', 'tags'], fuzziness: 'AUTO' } }]
                : [{ match_all: {} }],
              filter,
            },
          },
        });
        const results = resp.hits.hits.map((h: any) => ({ id: h._id, type: 'resource', score: h._score, ...h._source }));
        return { backend: 'elasticsearch', results };
      } catch {
        // ES unreachable — fall through to the MongoDB backend.
      }
    }

    // MongoDB fallback — the resource text index when there's a query, else recent.
    const filter: Record<string, unknown> = { approved: true };
    if (opts.category) filter['category'] = opts.category;
    if (q) filter['$text'] = { $search: q };
    const docs = await Resource.find(filter).limit(limit).exec();
    return {
      backend: 'database',
      results: docs.map((d) => ({ id: String(d._id), type: 'resource', ...d.toJSON() })),
    };
  }
}

export const searchService = new SearchService();
