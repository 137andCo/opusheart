import { FeatureConfig } from '../models/FeatureConfig.js';
import type { AppConfig } from '../config/index.js';

export type FeatureKey = 'giving' | 'attendance' | 'memberCare' | 'sms' | 'connect' | 'ai' | 'sermons' | 'groups' | 'resourceHub' | 'communication' | 'events';

export class FeatureService {
  private cache: Map<string, boolean> = new Map();
  private cacheLoadedAt = 0;
  private readonly cacheTtlMs = 60_000; // 1 minute cache

  constructor(private config: AppConfig) {}

  async isEnabled(feature: FeatureKey): Promise<boolean> {
    await this.ensureCache();
    // DB overrides take precedence over env/config
    if (this.cache.has(feature)) {
      return this.cache.get(feature)!;
    }
    // Fall back to config (loaded from env)
    return this.config.features[feature] ?? false;
  }

  async setFeature(feature: FeatureKey, enabled: boolean, updatedBy?: string): Promise<void> {
    await FeatureConfig.findOneAndUpdate(
      { key: feature },
      { key: feature, enabled, updatedBy },
      { upsert: true, returnDocument: 'after' }
    );
    this.cache.set(feature, enabled);
  }

  async getAllFeatures(): Promise<Record<FeatureKey, boolean>> {
    await this.ensureCache();
    const features: Record<string, boolean> = { ...this.config.features };
    for (const [key, value] of this.cache) {
      features[key] = value;
    }
    return features as Record<FeatureKey, boolean>;
  }

  private async ensureCache(): Promise<void> {
    if (Date.now() - this.cacheLoadedAt < this.cacheTtlMs) return;
    try {
      const configs = await FeatureConfig.find().lean();
      this.cache.clear();
      for (const config of configs) {
        this.cache.set(config.key, config.enabled);
      }
      this.cacheLoadedAt = Date.now();
    } catch {
      // On DB error, fall through to env config
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheLoadedAt = 0;
  }
}
