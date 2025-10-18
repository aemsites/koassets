/**
 * API Client for KO Assets
 * Connects to the main Cloudflare worker to access asset APIs
 */

/**
 * Make a request to the KO Assets API
 */
export async function makeApiRequest(endpoint, options = {}, env, request) {
  const baseUrl = env.KOASSETS_API_URL || 'http://localhost:8787';
  const url = `${baseUrl}${endpoint}`;

  console.log('[MCP API Client] ======================');
  console.log('[MCP API Client] Base URL:', baseUrl);
  console.log('[MCP API Client] Endpoint:', endpoint);
  console.log('[MCP API Client] Full URL:', url);
  console.log('[MCP API Client] Method:', options.method || 'GET');

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'KOAssets-MCP-Server/1.0',
    ...options.headers,
  };

  // Forward authentication cookie if present
  const cookie = request?.headers?.get('cookie');
  if (cookie) {
    headers.Cookie = cookie;
    console.log('[MCP API Client] Forwarding auth cookie');
  } else {
    console.log('[MCP API Client] ⚠️ No auth cookie to forward');
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  console.log('[MCP API Client] Making request...');
  const response = await fetch(url, fetchOptions);
  console.log('[MCP API Client] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[MCP API Client] ❌ Error response:', errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
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
