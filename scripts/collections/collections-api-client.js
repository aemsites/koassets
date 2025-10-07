/**
 * Dynamic Media Collections API Client (JavaScript)
 * Centralized collections client with authorization filtering
 */

// Import configuration and utilities from separate modules
import { API_CONFIG } from './collections-config.js';
import { hasCollectionAccess, assertCollectionAccess } from './collections-auth.js';
import { getBucket } from './collections-utils.js';

// Re-export utilities for convenience
export { getBucket, hasCollectionAccess, assertCollectionAccess };

/**
 * Dynamic Media Collections API Client
 */
export class DynamicMediaCollectionsClient {
  constructor(config) {
    this.bucket = config.bucket;
    this.accessToken = config.accessToken?.replace(/^Bearer /, '');
    this.baseURL = `https://${this.bucket}.adobeaemcloud.com`;
    this.user = config.user; // Store user for auth filtering

    // Determine API key based on bucket using centralized config
    this.apiKey = this.bucket.includes('-cmstg')
      ? API_CONFIG.stagingApiKey
      : API_CONFIG.productionApiKey;
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
            'x-api-key': this.apiKey,
            'x-adobe-accept-experimental': '1',
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

        // Handle JSON responses
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // eslint-disable-next-line no-console
          console.log('✅ [Collections Client] Response:', responseData);
          return responseData;
        }

        // Handle text responses
        if (contentType && (contentType.includes('text/') || contentType.includes('application/text'))) {
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(text);
              return parsed;
            } catch {
              return allowUndefinedResponse ? undefined : text;
            }
          }
          return allowUndefinedResponse ? undefined : text;
        }

        // For unknown content types, attempt JSON parsing as fallback
        try {
          const responseData = await response.json();
          return responseData;
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
          'x-adobe-accept-experimental': '1',
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

        // Handle JSON responses
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // eslint-disable-next-line no-console
          console.log('✅ [Collections Client] Response:', responseData);
          return responseData;
        }

        // Handle text responses
        if (contentType && (contentType.includes('text/') || contentType.includes('application/text'))) {
          const text = await response.text();
          // Try to parse as JSON if it looks like JSON
          if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(text);
              return parsed;
            } catch {
              return allowUndefinedResponse ? undefined : text;
            }
          }
          return allowUndefinedResponse ? undefined : text;
        }

        // For unknown content types, attempt JSON parsing as fallback
        try {
          const responseData = await response.json();
          return responseData;
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
  // Collections API Methods with Auth
  // ==========================================

  /**
   * List all collections (with authorization filtering)
   * @param {Object} options - Query options (limit, offset, etc.)
   * @returns {Promise} Promise with collections list (filtered by user access permissions)
   */
  async listCollections(options = {}) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.listCollections() REQUEST');
      const response = await this.makeRequest({
        url: '/adobe/assets/collections',
        method: 'GET',
        params: options,
      });

      // Apply authorization filtering to the collections
      const filteredItems = assertCollectionAccess(response.items, this.user, 'read');

      return {
        ...response,
        items: filteredItems,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to list collections: ${error.message}`);
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

      return await this.makeRequest({
        url: '/adobe/assets/collections',
        method: 'POST',
        data: requestData,
      });
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
   * @returns {Promise} Promise with collection metadata
   */
  async getCollectionMetadata(collectionId) {
    try {
      // eslint-disable-next-line no-console
      console.trace('DynamicMediaCollectionsClient.getCollectionMetadata() REQUEST');
      const collection = await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'GET',
      });

      // Check read access for this collection
      if (!hasCollectionAccess(collection, this.user, 'read')) {
        throw new Error(`Access denied: You do not have permission to view collection "${collectionId}"`);
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
      return await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'DELETE',
        headers: {
          'If-Match': '*',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete collection "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get collection ETag for updates
   * @param {string} collectionId - Collection ID
   * @returns {Promise<string>} Promise with ETag value
   */
  async getCollectionETag(collectionId) {
    try {
      // Make a direct HEAD request to get ETag from headers
      const url = `/adobe/assets/collections/${collectionId}`;

      if (this.isIMSAuthenticated()) {
        const fetchUrl = `${this.baseURL}${url}`;
        const response = await fetch(fetchUrl, {
          method: 'HEAD',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'x-api-key': this.apiKey,
            'x-adobe-accept-experimental': '1',
          },
        });

        if (response.ok) {
          const etag = response.headers.get('etag');
          return etag || '*';
        }
      } else {
        // Cookie auth fallback - use GET request and ignore body
        await this.makeRequest({
          url,
          method: 'GET',
        });
        // For cookie auth, we can't easily get ETag, so use wildcard
        return '*';
      }

      return '*';
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to get ETag for collection ${collectionId}, using wildcard:`, error);
      return '*'; // Fallback to wildcard
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
      // This also checks read access
      const currentCollection = await this.getCollectionMetadata(collectionId);

      // Check write access before updating
      if (!hasCollectionAccess(currentCollection, this.user, 'write')) {
        throw new Error(`Access denied: You do not have permission to modify collection "${collectionId}"`);
      }

      // Get current ETag for the collection
      const etag = await this.getCollectionETag(collectionId);

      // Merge current metadata with updates (preserve all existing metadata)
      const mergedMetadata = {
        ...currentCollection.collectionMetadata,
        ...updateData, // Only override the fields being updated
      };
      return await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}`,
        method: 'POST',
        data: mergedMetadata,
        headers: {
          'If-Match': etag,
        },
      });
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
      return await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}/items`,
        method: 'GET',
        params: options,
      });
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

      return await this.makeRequest({
        url: `/adobe/assets/collections/${collectionId}/items`,
        method: 'POST',
        data: itemsData,
        headers: {
          'If-Match': '*', // Always allow add/remove operations regardless of ETag
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update collection items for "${collectionId}": ${error.message}`);
      }
      throw error;
    }
  }
}
