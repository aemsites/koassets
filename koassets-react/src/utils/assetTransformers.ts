import { populateAssetFromHit as populateAssetFromHitShared, populateAssetFromMetadata as populateAssetFromMetadataShared, extractFromArrayValue as extractFromArrayValueShared } from '../../../scripts/asset-transformers.js';
import type { Asset, Metadata } from '../types';

/**
 * TypeScript wrapper for shared asset transformers
 * This file provides type-safe access to the shared JavaScript transformers
 */

export function populateAssetFromHit(hit: Record<string, unknown>): Asset {
  return populateAssetFromHitShared(hit) as Asset;
}

export function populateAssetFromMetadata(metadata: Metadata): Asset {
  return populateAssetFromMetadataShared(metadata) as Asset;
}

export function extractFromArrayValue(dataJson: Record<string, unknown>, key: string, fallback?: string): string {
  return extractFromArrayValueShared(dataJson, key, fallback);
}

// Import saveCartItems from shared file
import { saveCartItems as saveCartItemsShared } from '../../../scripts/asset-transformers.js';

export function saveCartItems(items: Array<Record<string, unknown>>): void {
  saveCartItemsShared(items);
}
