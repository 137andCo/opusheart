import { churchVertical } from '@opusheart/vertical-church';
import type { VerticalConfig } from '@opusheart/shared';

/**
 * Registry of vertical presets. Church ships as its own package today; community
 * and nonprofit have role labels in @opusheart/shared and will get their own
 * preset packages. An unknown `VERTICAL` falls back to the church preset.
 */
const REGISTRY: Record<string, VerticalConfig> = {
  church: churchVertical,
};

export function getVerticalConfig(vertical: string): VerticalConfig {
  return REGISTRY[vertical] ?? churchVertical;
}

export function listVerticals(): string[] {
  return Object.keys(REGISTRY);
}
