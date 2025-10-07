/**
 * Collections Utility Functions
 * Shared utilities for collection data transformation and management
 */

import { DEFAULT_BUCKET, DEBUG_COLLECTIONS } from './collections-config.js';

/**
 * Transform API collection format to internal format
 * Converts the Dynamic Media API collection structure to the format used by the UI
 *
 * @param {Object} apiCollection - Collection object from API
 * @returns {Object} Transformed collection object for UI use
 */
export function transformApiCollectionToInternal(apiCollection) {
  if (!apiCollection) return null;

  const metadata = apiCollection.collectionMetadata || {};
  const repoMetadata = apiCollection.repositoryMetadata || {};
  const koMetadata = metadata['ko:metadata'] || {};

  return {
    id: apiCollection.collectionId || apiCollection.id,
    name: metadata.title || metadata['dam:collectionTitle'] || 'Untitled Collection',
    description: metadata.description || metadata['dam:collectionDescription'] || '',
    lastUpdated: repoMetadata['repo:modifyDate'] || metadata['jcr:lastModified'],
    dateLastUsed: repoMetadata['repo:modifyDate']
      ? new Date(repoMetadata['repo:modifyDate']).getTime()
      : Date.now(),
    dateCreated: repoMetadata['repo:createDate'] || metadata['jcr:created'],
    createdBy: repoMetadata['repo:createdBy'],
    modifiedBy: repoMetadata['repo:modifiedBy'],
    accessLevel: metadata.accessLevel || 'private',
    itemCount: apiCollection.itemCount || 0,
    thumbnailUrl: metadata['dam:thumbnailUrl'] || '',
    acl: koMetadata['ko:acl'] || null,
    contents: [],
    favorite: false,
    // Keep original API data for reference
    apiData: apiCollection,
  };
}

/**
 * Get Dynamic Media bucket from APP_CONFIG or use default
 * @returns {string} The bucket identifier
 */
export function getBucket() {
  const bucket = window.APP_CONFIG?.BUCKET || DEFAULT_BUCKET;

  if (DEBUG_COLLECTIONS && bucket === DEFAULT_BUCKET) {
    console.log('[Collections] Using default bucket (APP_CONFIG.BUCKET not set):', bucket);
  }

  return bucket;
}
