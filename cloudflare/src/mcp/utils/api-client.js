/**
 * API Client for KO Assets
 * Makes requests directly to origin APIs (DynamicMedia, Fadel)
 * Avoids HTTP round-trips by importing origin functions directly
 */

import { originDynamicMedia } from '../../origin/dm.js';
import { originFadel } from '../../origin/fadel.js';

/**
 * Make a request to the KO Assets API
 * Routes internally to origin handlers without HTTP round-trip
 */
export async function makeApiRequest(endpoint, options = {}, env, request) {
  console.log('[MCP API Client] ======================');
  console.log('[MCP API Client] Endpoint:', endpoint);
  console.log('[MCP API Client] Method:', options.method || 'GET');

  // Route to appropriate origin handler based on endpoint
  let handler;
  if (endpoint.startsWith('/api/adobe/assets')) {
    handler = originDynamicMedia;
    console.log('[MCP API Client] → Routing to Dynamic Media (internal call)');
  } else if (endpoint.startsWith('/api/fadel')) {
    handler = originFadel;
    console.log('[MCP API Client] → Routing to Fadel (internal call)');
  } else {
    throw new Error(`Unsupported endpoint for MCP: ${endpoint}`);
  }

  // Create a mock request object that mimics an HTTP request
  const mockRequest = new Request(`https://internal${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      // Forward the original cookie for authentication
      'Cookie': request?.headers?.get('cookie') || '',
    },
    body: options.body,
  });

  console.log('[MCP API Client] Making internal call...');
  
  let response;
  try {
    response = await handler(mockRequest, env);
  } catch (error) {
    console.error('[MCP API Client] ❌ Internal call error:', error);
    throw new Error(`Internal API call failed: ${error.message}`);
  }
  
  console.log('[MCP API Client] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[MCP API Client] ❌ Error response:', errorText);
    
    throw new Error(
      `API request failed:\n` +
      `Endpoint: ${endpoint}\n` +
      `Method: ${options.method || 'GET'}\n` +
      `Status: ${response.status} ${response.statusText}\n` +
      `Response: ${errorText}`
    );
  }

  console.log('[MCP API Client] ✅ Request successful');

  // Handle empty responses
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }

  return await response.text();
}

/**
 * Search for assets
 */
export async function searchAssets(query, options = {}, env, request) {
  const {
    facetFilters = [],
    numericFilters = [],
    filters = [],
    hitsPerPage = 24,
    page = 0,
    collectionId = null,
  } = options;

  // Get bucket/index name from environment or use default
  const indexName = env.ALGOLIA_INDEX || '92206-211033'; // Default for stage

  // Build Algolia search request
  const algoliaRequest = {
    requests: [
      {
        indexName,
        params: {
          query: query || '',
          facets: options.facets || [],
          facetFilters,
          numericFilters,
          filters: filters.length > 0 ? filters.map((f) => `(${f})`).join(' AND ') : undefined,
          hitsPerPage,
          page,
          maxValuesPerFacet: 1000,
          highlightPreTag: '__ais-highlight__',
          highlightPostTag: '__/ais-highlight__',
        },
      },
    ],
  };

  if (collectionId) {
    algoliaRequest.requests[0].params.facetFilters.push([`collectionIds:${collectionId}`]);
  }

  return await makeApiRequest(
    '/api/adobe/assets/search',
    {
      method: 'POST',
      body: JSON.stringify(algoliaRequest),
      headers: {
        'x-ch-request': 'search',
      },
    },
    env,
    request,
  );
}

/**
 * Get asset metadata
 */
export async function getAssetMetadata(assetId, env, request) {
  return await makeApiRequest(
    `/api/adobe/assets/${assetId}/metadata`,
    {
      method: 'GET',
    },
    env,
    request,
  );
}

/**
 * Get asset renditions
 */
export async function getAssetRenditions(assetId, env, request) {
  return await makeApiRequest(
    `/api/adobe/assets/${assetId}/renditions`,
    {
      method: 'GET',
    },
    env,
    request,
  );
}

/**
 * Get image presets
 */
export async function getImagePresets(env, request) {
  return await makeApiRequest(
    '/api/adobe/assets/imagePresets',
    {
      method: 'GET',
    },
    env,
    request,
  );
}

/**
 * Search collections
 */
export async function searchCollections(query, options = {}, env, request) {
  const { hitsPerPage = 20, page = 0 } = options;

  const indexName = env.ALGOLIA_INDEX || '92206-211033';

  const algoliaRequest = {
    requests: [
      {
        indexName: `${indexName}_collections`,
        params: {
          query: query || '',
          facets: [],
          hitsPerPage,
          page,
          highlightPreTag: '__ais-highlight__',
          highlightPostTag: '__/ais-highlight__',
        },
      },
    ],
  };

  return await makeApiRequest(
    '/api/adobe/assets/search',
    {
      method: 'POST',
      body: JSON.stringify(algoliaRequest),
      headers: {
        'x-ch-request': 'search',
      },
    },
    env,
    request,
  );
}

/**
 * Get media rights (FADEL)
 */
export async function getMediaRights(env, request) {
  return await makeApiRequest(
    '/api/fadel/rc-api/rights/search/20',
    {
      method: 'POST',
      body: JSON.stringify({ description: '' }),
    },
    env,
    request,
  );
}

/**
 * Get market rights (FADEL)
 */
export async function getMarketRights(env, request) {
  return await makeApiRequest(
    '/api/fadel/rc-api/rights/search/30',
    {
      method: 'POST',
      body: JSON.stringify({ description: '' }),
    },
    env,
    request,
  );
}

/**
 * Check asset rights clearance
 */
export async function checkAssetRights(checkRightsRequest, env, request) {
  return await makeApiRequest(
    '/api/fadel/rc-api/clearance/assetclearance',
    {
      method: 'POST',
      body: JSON.stringify(checkRightsRequest),
    },
    env,
    request,
  );
}
