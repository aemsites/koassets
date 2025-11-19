import { populateAssetFromHit as populateAssetFromHitShared, populateAssetFromMetadata as populateAssetFromMetadataShared, extractFromArrayValue as extractFromArrayValueShared } from '../../../scripts/asset-transformers.js';
import type { Asset, Metadata } from '../types';

/**
 * TypeScript wrapper for shared asset transformers
 * This file provides type-safe access to the shared JavaScript transformers
 */

/**
 * Extract display value from _hidden property (format: "Display Value|id")
 */
function extractDisplayValueFromHidden(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') return undefined;
  if (value.includes('|')) {
    return value.split('|')[0].trim();
  }
  return value;
}

/**
 * Extract display values from _hidden array property
 */
function extractDisplayValueFromHiddenArray(values: unknown): string | undefined {
  if (!values) return undefined;
  
  if (Array.isArray(values)) {
    return values
      .filter((v) => typeof v === 'string' && v)
      .map((v) => {
        if (v.includes('|')) {
          return v.split('|')[0].trim();
        }
        return v;
      })
      .join(', ');
  }
  
  if (typeof values === 'string' && values.includes('|')) {
    return values.split('|')[0].trim();
  }
  
  return undefined;
}

export function populateAssetFromHit(hit: Record<string, unknown>): Asset {
  const asset = populateAssetFromHitShared(hit) as Asset;
  
  // Override with _hidden values if available (search hit uses tccc- prefix)
  const campaignNameHidden = extractDisplayValueFromHidden(hit['tccc-campaignName_hidden'] as string);
  if (campaignNameHidden) asset.campaignName = campaignNameHidden;
  
  const agencyNameHidden = extractDisplayValueFromHidden(hit['tccc-agencyName_hidden'] as string);
  if (agencyNameHidden) asset.agencyName = agencyNameHidden;
  
  const intendedBottlerCountryHidden = extractDisplayValueFromHiddenArray(hit['tccc-intendedBottlerCountry_hidden']);
  if (intendedBottlerCountryHidden) asset.intendedBottlerCountry = intendedBottlerCountryHidden;
  
  const packageContainerSizeHidden = extractDisplayValueFromHiddenArray(hit['tccc-packageContainerSize_hidden']);
  if (packageContainerSizeHidden) asset.packageOrContainerSize = packageContainerSizeHidden;
  
  return asset;
}

export function populateAssetFromMetadata(metadata: Metadata): Asset {
  const asset = populateAssetFromMetadataShared(metadata) as Asset;
  
  // Override with _hidden values if available (metadata uses tccc: prefix with colon)
  const campaignNameDisplay = extractDisplayValueFromHidden(metadata.assetMetadata?.['tccc:campaignName_hidden'] as string);
  if (campaignNameDisplay) asset.campaignName = campaignNameDisplay;
  
  const agencyNameDisplay = extractDisplayValueFromHidden(metadata.assetMetadata?.['tccc:agencyName_hidden'] as string);
  if (agencyNameDisplay) asset.agencyName = agencyNameDisplay;
  
  const countryDisplay = extractDisplayValueFromHiddenArray(metadata.assetMetadata?.['tccc:intendedBottlerCountry_hidden']);
  if (countryDisplay) asset.intendedBottlerCountry = countryDisplay;
  
  const sizeDisplay = extractDisplayValueFromHiddenArray(metadata.assetMetadata?.['tccc:packageContainerSize_hidden']);
  if (sizeDisplay) asset.packageOrContainerSize = sizeDisplay;
  
  return asset;
}

export function extractFromArrayValue(dataJson: Record<string, unknown>, key: string, fallback?: string): string {
  return extractFromArrayValueShared(dataJson, key, fallback);
}

// Import saveCartItems from shared file
import { saveCartItems as saveCartItemsShared } from '../../../scripts/asset-transformers.js';

export function saveCartItems(items: Array<Record<string, unknown>>): void {
  saveCartItemsShared(items);
}
