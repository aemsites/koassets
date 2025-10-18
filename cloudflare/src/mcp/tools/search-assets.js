/**
 * Search Assets Tool
 * Search for digital assets using keywords and filters
 */

import { searchAssets } from '../utils/api-client.js';

export const definition = {
  name: 'search_assets',
  description:
    'Search for digital assets (images, videos, documents) using keywords and filters. Returns a list of assets with metadata including brand, category, format, rights information, and URLs.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term or keyword to find assets. Can be empty to retrieve all assets with filters applied.',
      },
      facetFilters: {
        type: 'object',
        description: 'Filter assets by metadata facets',
        properties: {
          brand: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by brand names (e.g., ["Coca-Cola", "Sprite"])',
          },
          category: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by category (e.g., ["Image", "Video", "Document"])',
          },
          format: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by file format (e.g., ["image/jpeg", "video/mp4"])',
          },
          assetStatus: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by asset status',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by tags or keywords',
          },
        },
      },
      dateRange: {
        type: 'object',
        description: 'Filter by date range',
        properties: {
          field: {
            type: 'string',
            enum: ['repo-createDate', 'repo-modifyDate', 'tccc-rightsStartDate', 'tccc-rightsEndDate'],
            description: 'Date field to filter on',
          },
          from: {
            type: 'number',
            description: 'Start date as Unix epoch timestamp (seconds)',
          },
          to: {
            type: 'number',
            description: 'End date as Unix epoch timestamp (seconds)',
          },
        },
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (0-based). Default: 0',
        default: 0,
      },
      hitsPerPage: {
        type: 'number',
        description: 'Number of results per page. Default: 24, Max: 100',
        default: 24,
      },
    },
  },
};

export async function handler(args, env, request) {
  const { query = '', facetFilters = {}, dateRange, page = 0, hitsPerPage = 24 } = args;

  // Transform facetFilters object to Algolia format
  // Algolia expects: [[brand1, brand2], [category1]]
  const algoliaFacetFilters = [];

  for (const [facetKey, values] of Object.entries(facetFilters)) {
    if (Array.isArray(values) && values.length > 0) {
      // Map common facet names to their technical IDs
      const facetIdMap = {
        brand: 'tccc-brand',
        category: 'dc-format',
        format: 'dc-format',
        assetStatus: 'tccc-assetStatus',
        tags: 'tccc-tags',
      };

      const facetId = facetIdMap[facetKey] || facetKey;
      const filterGroup = values.map((value) => `${facetId}:${value}`);
      algoliaFacetFilters.push(filterGroup);
    }
  }

  // Build numeric filters for date ranges
  const numericFilters = [];
  if (dateRange?.field) {
    if (dateRange.from !== undefined) {
      numericFilters.push(`${dateRange.field} >= ${dateRange.from}`);
    }
    if (dateRange.to !== undefined) {
      numericFilters.push(`${dateRange.field} <= ${dateRange.to}`);
    }
  }

  // Add non-expired filter
  const currentEpoch = Math.floor(Date.now() / 1000);
  const filters = [`is_pur-expirationDate = 0 OR pur-expirationDate > ${currentEpoch}`];

  try {
    const response = await searchAssets(
      query,
      {
        facetFilters: algoliaFacetFilters,
        numericFilters,
        filters,
        hitsPerPage: Math.min(hitsPerPage, 100),
        page,
      },
      env,
      request,
    );

    // Extract results from Algolia response
    const results = response?.results?.[0];
    if (!results) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: {
                  hits: [],
                  nbHits: 0,
                  page: 0,
                  nbPages: 0,
                  hitsPerPage: hitsPerPage,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Format response for MCP
    const formattedResults = {
      success: true,
      data: {
        hits: results.hits.map((hit) => ({
          assetId: hit.assetId,
          name: hit['repo:name'],
          title: hit['tccc-title'] || hit['repo:name'],
          description: hit['dc:description'],
          brand: hit['tccc-brand'],
          category: hit['dc-format'],
          format: hit['repo:format'],
          size: hit['repo:size'],
          width: hit['tiff:ImageWidth'],
          height: hit['tiff:ImageLength'],
          createDate: hit['repo-createDate'],
          modifyDate: hit['repo-modifyDate'],
          assetStatus: hit['tccc-assetStatus'],
          readyToUse: hit['tccc-readyToUse'],
          rightsStartDate: hit['tccc-rightsStartDate'],
          rightsEndDate: hit['tccc-rightsEndDate'],
          url: hit._url || `asset://${hit.assetId}`,
        })),
        nbHits: results.nbHits,
        page: results.page,
        nbPages: results.nbPages,
        hitsPerPage: results.hitsPerPage,
        query: query,
        appliedFilters: {
          facetFilters: algoliaFacetFilters,
          numericFilters,
          filters,
        },
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResults, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('Search assets error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
