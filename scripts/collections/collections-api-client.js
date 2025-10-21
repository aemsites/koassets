/**
 * Dynamic Media Collections API Client (JavaScript)
 * Centralized collections client with authorization filtering
 */

// Import configuration and utilities from separate modules
import { hasCollectionAccess, assertCollectionAccess } from './collections-auth.js';

// Re-export utilities for convenience
export { hasCollectionAccess, assertCollectionAccess };

// Algolia search configuration constants
const ALGOLIA_SEARCH_DEFAULTS = {
  HITS_PER_PAGE: 40,
  MAX_VALUES_PER_FACET: 10,
  HIGHLIGHT_PRE_TAG: '__ais-highlight__',
  HIGHLIGHT_POST_TAG: '__/ais-highlight__',
  DEFAULT_ACCESS_LEVEL: 'private',
  DEFAULT_PAGE: 0,
  SYSTEM_USER_PLACEHOLDER: '{{SYSTEM_USER_ID}}',
};

// Algolia facet field names
const FACET_FIELDS = {
  ACCESS_LEVEL: 'collectionMetadata.accessLevel',
  REPO_CREATED_BY: 'repositoryMetadata.repo-createdBy',
};

/**
 * Dynamic Media Collections API Client
 */
export class DynamicMediaCollectionsClient {
  constructor(config) {
    this.accessToken = config.accessToken?.replace(/^Bearer /, '');
    this.baseURL = `${window.location.origin}/api`;
    this.user = config.user; // Store user for auth filtering
  }

  isIMSAuthenticated() {
    return this.accessToken !== undefined;
  }

  /**
   * Generic request method that handles both IMS and fetch authentication patterns
   * @private
   */
  async makeRequest(config) {
    const {
      url,
      method = 'GET',
      data,
      params,
      headers = {},
      allowUndefinedResponse = false,
    } = config;

    // eslint-disable-next-line no-console
    console.log(`🔍 [Collections Client] Making ${method} request to: ${url}`);

    // for transition period, if logged in both ways, prefer IMS route
    if (this.isIMSAuthenticated()) {
      // eslint-disable-next-line no-console
      console.log('🔑 [Collections Client] Using IMS authentication');
      try {
        let fetchUrl = `${this.baseURL}${url}`;
        if (params) {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
              searchParams.append(key, String(value));
            }
          });
          if (searchParams.toString()) {
            fetchUrl += `?${searchParams.toString()}`;
          }
        }

        const fetchConfig = {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            ...headers,
          },
        };

        if (data) {
          fetchConfig.body = JSON.stringify(data);
        }

        // eslint-disable-next-line no-console
        console.log('🌐 [Collections Client] Full URL:', fetchUrl);

        const response = await fetch(fetchUrl, fetchConfig);

        if (!response.ok) {
          // eslint-disable-next-line no-console
          console.error('❌ [Collections Client] Request failed:', {
            status: response.status,
            statusText: response.statusText,
            url: fetchUrl,
            authMethod: 'IMS',
          });

          if (allowUndefinedResponse && response.status !== 200) {
            return undefined;
          }
          throw new Error(`Request failed: ${response.statusText}`);
        }

        // Handle different response types
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        // Handle empty responses
        if (contentLength === '0' || response.status === 204) {
          return allowUndefinedResponse ? undefined : {};
        }

        // Handle JSON responses - always return data + headers
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // eslint-disable-next-line no-console
          console.log('✅ [Collections Client] Response:', responseData);

          return {
            data: responseData,
            headers: Object.fromEntries(response.headers.entries()),
          };
        }

        // Handle text responses
        if (contentType && (contentType.includes('text/') || contentType.includes('application/text'))) {
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(text);
              return {
                data: parsed,
                headers: Object.fromEntries(response.headers.entries()),
              };
            } catch {
              return allowUndefinedResponse ? undefined : text;
            }
          }
          return allowUndefinedResponse ? undefined : text;
        }

        // For unknown content types, attempt JSON parsing as fallback
        try {
          const responseData = await response.json();
          return {
            data: responseData,
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch {
          return allowUndefinedResponse ? undefined : {};
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ [Collections Client] Error:', error);
        throw error;
      }
    } else /* if (window.user) */ {
      // eslint-disable-next-line no-console
      console.log('🍪 [Collections Client] Using cookie authentication');
      try {
        const fetchHeaders = {
          ...headers,
        };

        if (method === 'POST' || method === 'PUT') {
          fetchHeaders['Content-Type'] = 'application/json';
        }

        const fetchConfig = {
          method,
          headers: fetchHeaders,
          credentials: 'include', // Include cookies for authentication
        };

        if (data) {
          fetchConfig.body = JSON.stringify(data);
        }

        // Construct URL with params
        let fetchUrl = `/api${url}`;
        if (params) {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
              searchParams.append(key, String(value));
            }
          });
          if (searchParams.toString()) {
            fetchUrl += `?${searchParams.toString()}`;
          }
        }

        // eslint-disable-next-line no-console
        console.log('🌐 [Collections Client] Proxy URL:', fetchUrl);

        const response = await fetch(fetchUrl, fetchConfig);

        if (!response.ok) {
          // eslint-disable-next-line no-console
          console.error('❌ [Collections Client] Request failed:', {
            status: response.status,
            statusText: response.statusText,
            url: fetchUrl,
            authMethod: 'Cookie',
          });

          if (allowUndefinedResponse && response.status !== 200) {
            return undefined;
          }
          throw new Error(`Request failed: ${response.statusText}`);
        }

        // Handle different response types intelligently
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');

        // Handle empty responses
        if (contentLength === '0' || response.status === 204) {
          return allowUndefinedResponse ? undefined : {};
        }

        // Handle JSON responses - always return data + headers
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // eslint-disable-next-line no-console
          console.log('✅ [Collections Client] Response:', responseData);

          return {
            data: responseData,
            headers: Object.fromEntries(response.headers.entries()),
          };
        }

        // Handle text responses
        if (contentType && (contentType.includes('text/') || contentType.includes('application/text'))) {
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(text);
              return {
                data: parsed,
                headers: Object.fromEntries(response.headers.entries()),
              };
            } catch {
              return allowUndefinedResponse ? undefined : text;
            }
          }
          return allowUndefinedResponse ? undefined : text;
        }

        // For unknown content types, attempt JSON parsing as fallback
        try {
          const responseData = await response.json();
          return {
            data: responseData,
            headers: Object.fromEntries(response.headers.entries()),
          };
        } catch {
          return allowUndefinedResponse ? undefined : {};
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('❌ [Collections Client] Error:', error);
        throw error;
      }
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  /**
   * Extract ETag from response headers
   * @param {Object} headers - Response headers object
   * @returns {string|null} ETag value or null
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  getETag(headers) {
    let etag = headers?.etag || headers?.ETag || null;

    // Strip W/ prefix if present (weak ETag indicator)
    // W/"430548e5-0000-0200-0000-68e7236f0000" -> "430548e5-0000-0200-0000-68e7236f0000"
    if (etag && etag.startsWith('W/')) {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.getETag() - fixing weak ETag,', etag);
      etag = etag.substring(2);
    }

    return etag;
  }

  /**
   * Get current epoch time for expiration filtering
   * @returns {number} Current epoch time
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  getSearchEpoch() {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Get non-expired assets filter string
   * @returns {string} Filter string for non-expired assets
   * @private
   */
  getNonExpiredAssetsFilter() {
    return `is_pur-expirationDate = 0 OR pur-expirationDate > ${this.getSearchEpoch()}`;
  }

  // ==========================================
  // Collections API Methods with Auth
  // ==========================================
  /**
   * Search collections using Algolia-style query
   * @param {Object} options - Search options
   * @param {string} [options.query=''] - Search query string
   * @param {number} [options.limit=40] - Number of results per page (hitsPerPage)
   * @param {number} [options.page=0] - Page number (0-based)
   * @param {string} [options.accessLevel='private'] - Filter by access level
   * @returns {Promise<{items: Array, total: number}>} Promise with filtered search results
   */
  async searchCollections(options = {}) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.searchCollections() REQUEST');

      // Extract options with defaults from constants
      const {
        query = '',
        limit = ALGOLIA_SEARCH_DEFAULTS.HITS_PER_PAGE,
        page = ALGOLIA_SEARCH_DEFAULTS.DEFAULT_PAGE,
        accessLevel = ALGOLIA_SEARCH_DEFAULTS.DEFAULT_ACCESS_LEVEL,
      } = options;

      // Build Algolia-style search body
      const searchBody = {
        requests: [
          {
            params: {
              facetFilters: [
                `${FACET_FIELDS.REPO_CREATED_BY}:${ALGOLIA_SEARCH_DEFAULTS.SYSTEM_USER_PLACEHOLDER}`,
                `${FACET_FIELDS.ACCESS_LEVEL}:${accessLevel}`,
              ],
              facets: [
                FACET_FIELDS.ACCESS_LEVEL,
                FACET_FIELDS.REPO_CREATED_BY,
              ],
              highlightPostTag: ALGOLIA_SEARCH_DEFAULTS.HIGHLIGHT_POST_TAG,
              highlightPreTag: ALGOLIA_SEARCH_DEFAULTS.HIGHLIGHT_PRE_TAG,
              hitsPerPage: limit,
              maxValuesPerFacet: ALGOLIA_SEARCH_DEFAULTS.MAX_VALUES_PER_FACET,
              page,
              query,
              tagFilters: '',
            },
          },
        ],
      };

      // eslint-disable-next-line no-console
      console.log('🔍 [Search Collections] Request body:', JSON.stringify(searchBody, null, 2));

      const { data } = await this.makeRequest({
        url: '/adobe/assets/search-collections',
        method: 'POST',
        data: searchBody,
      });

      // Extract first result from Algolia response structure
      const result = data.results?.[0];
      const hits = result?.hits || [];
      const total = result?.nbHits || 0;

      // eslint-disable-next-line no-console
      console.log('🔍 [Search Collections] Response hits:', hits.length);

      // Apply authorization filtering to the collections
      const filteredItems = assertCollectionAccess(hits, this.user, 'read');

      return {
        items: filteredItems,
        total,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search collections: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create a new collection
   * @param {Object} collectionData - Collection metadata (title, description, etc.)
   * @returns {Promise} Promise with created collection data
   */
  async createCollection(collectionData) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.createCollection() REQUEST');

      // Ensure items array is always present (required by API)
      const requestData = {
        ...collectionData,
        items: collectionData.items || [],
      };

      const { data } = await this.makeRequest({
        url: '/adobe/assets/collections',
        method: 'POST',
        data: requestData,
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create collection: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Retrieve collection metadata
   * @param {string} collectionId - Collection ID
   * @returns {Promise} Promise with collection metadata (includes _etag property)
   */
  async getCollectionMetadata(collectionId) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.getCollectionMetadata() REQUEST');
      const { data: collection, headers } = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'GET',
      });

      // Check read access for this collection
      if (!hasCollectionAccess(collection, this.user, 'read')) {
        throw new Error(`Access denied: You do not have permission to view collection "${collectionId}"`);
      }

      // Attach ETag to collection object for later use
      const etag = this.getETag(headers);
      if (etag) {
        // eslint-disable-next-line no-underscore-dangle
        collection._etag = etag;
      }

      return collection;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get collection metadata for "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete a collection
   * @param {string} collectionId - Collection ID
   * @returns {Promise} Promise with deletion result
   */
  async deleteCollection(collectionId) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.deleteCollection() REQUEST');

      // Check write access before deleting
      const collection = await this.getCollectionMetadata(collectionId);
      if (!hasCollectionAccess(collection, this.user, 'write')) {
        throw new Error(`Access denied: You do not have permission to delete collection "${collectionId}"`);
      }

      // Use If-Match: * to delete regardless of ETag value
      const { data } = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'DELETE',
        headers: {
          'If-Match': '*',
        },
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete collection "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update collection metadata
   * @param {string} collectionId - Collection ID
   * @param {Object} updateData - Updated collection metadata (only changed fields)
   * @returns {Promise} Promise with updated collection data
   */
  async updateCollectionMetadata(collectionId, updateData) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.updateCollectionMetadata() REQUEST');

      // First get current collection metadata to preserve existing data
      // This also checks read access AND retrieves the ETag
      const currentCollection = await this.getCollectionMetadata(collectionId);

      // Check write access before updating
      if (!hasCollectionAccess(currentCollection, this.user, 'write')) {
        throw new Error(`Access denied: You do not have permission to modify collection "${collectionId}"`);
      }

      // Use ETag from getCollectionMetadata response
      // eslint-disable-next-line no-underscore-dangle
      const etag = currentCollection._etag;

      // Merge current metadata with updates (preserve all existing metadata)
      const mergedMetadata = {
        ...currentCollection.collectionMetadata,
        ...updateData, // Only override the fields being updated
      };

      const { data } = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'POST',
        data: mergedMetadata,
        headers: {
          'If-Match': etag,
        },
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update collection metadata for "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get collection items (assets in the collection)
   * @param {string} collectionId - Collection ID
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise} Promise with collection items
   */
  async getCollectionItems(collectionId, options = {}) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.getCollectionItems() REQUEST');

      // First get collection metadata to check access (throws if access denied)
      await this.getCollectionMetadata(collectionId);

      // If we got here, access check in getCollectionMetadata passed
      // Now get the items
      const { data } = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}/items`,
        method: 'GET',
        params: options,
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get collection items for "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Update collection items (add/remove assets from collection)
   * @param {string} collectionId - Collection ID
   * @param {Object} itemsData - Items to add/remove with operation type
   * @returns {Promise} Promise with update result
   */
  async updateCollectionItems(collectionId, itemsData) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.updateCollectionItems() REQUEST');

      // Check write access before updating
      const collection = await this.getCollectionMetadata(collectionId);
      if (!hasCollectionAccess(collection, this.user, 'write')) {
        throw new Error(`Access denied: You do not have permission to modify collection "${collectionId}"`);
      }

      const { data } = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}/items`,
        method: 'POST',
        data: itemsData,
        headers: {
          'If-Match': '*', // Always allow add/remove operations regardless of ETag
        },
      });

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update collection items for "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search for assets in a specific collection
   * @param {string} query - Search query string
   * @param {Object} options - Search options
   * @param {string} options.collectionId - Required collection ID to filter by
   * @param {number} [options.hitsPerPage=100] - Number of results per page
   * @param {number} [options.page=0] - Page number (0-based)
   * @param {Array} [options.facets=[]] - Facets to include in results
   * @param {Array} [options.facetFilters=[]] - Facet filters to apply
   * @returns {Promise} Promise with search results containing assets with full metadata
   */
  async searchAssetsInCollection(query = '', options = {}) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.searchAssetsInCollection() REQUEST');

      const {
        collectionId,
        hitsPerPage = 100,
        page = 0,
        facets = [],
        facetFilters = [],
      } = options;

      // Require collection ID
      if (!collectionId) {
        throw new Error('collectionId is required for searchAssetsInCollection');
      }

      // Build facet filters - add collection ID filter
      const combinedFacetFilters = [...facetFilters];
      // Extract UUID from URN format: urn:cid:aem:f3b0f080-9be4-45da-8a48-12015758f31f
      // API expects just the UUID part: f3b0f080-9be4-45da-8a48-12015758f31f
      const collectionUuid = collectionId.includes(':') ? collectionId.split(':')[3] : collectionId;
      combinedFacetFilters.push([`collectionIds:${collectionUuid}`]);

      // Build Algolia-style search body
      const searchBody = {
        requests: [
          {
            params: {
              facets,
              facetFilters: combinedFacetFilters,
              filters: this.getNonExpiredAssetsFilter(),
              highlightPostTag: '__/ais-highlight__',
              highlightPreTag: '__ais-highlight__',
              hitsPerPage,
              maxValuesPerFacet: 1000,
              page,
              query: query || '',
              tagFilters: '',
            },
          },
        ],
      };

      // eslint-disable-next-line no-console
      console.log('🔍 [Search Assets] Request body:', JSON.stringify(searchBody, null, 2));

      const { data } = await this.makeRequest({
        url: '/adobe/assets/search',
        method: 'POST',
        data: searchBody,
      });

      // eslint-disable-next-line no-console
      console.log('✅ [Search Assets] Response:', data);

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search assets: ${error.message}`);
      }
      throw error;
    }
  }
}
