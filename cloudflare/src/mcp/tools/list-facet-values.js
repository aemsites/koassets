/**
 * List Facet Values Tool
 * Get available values for filtering facets (brands, categories, formats, etc.)
 */

import { searchAssets } from '../utils/api-client.js';

export const definition = {
  name: 'list_facet_values',
  description:
    'Get available filter values for a specific facet/field (e.g., brands, categories, formats). Useful for discovering what filters are available before searching.',
  inputSchema: {
    type: 'object',
    properties: {
      facetName: {
        type: 'string',
        description:
          'The facet to retrieve values for. Examples: "tccc-brand" (brands), "dc-format" (categories), "tccc-assetStatus" (asset status)',
        enum: [
          'tccc-brand',
          'tccc-subBrand',
          'dc-format',
          'tccc-category',
          'tccc-assetStatus',
          'tccc-readyToUse',
          'tccc-tags',
          'tccc-campaignName',
          'tccc-marketCovered',
          'tccc-mediaCovered',
        ],
      },
      searchTerm: {
        type: 'string',
        description: 'Optional search term to filter facet values',
      },
      maxValues: {
        type: 'number',
        description: 'Maximum number of values to return. Default: 100',
        default: 100,
      },
    },
    required: ['facetName'],
  },
};

export async function handler(args, env, request) {
  const { facetName, searchTerm = '', maxValues = 100 } = args;

  if (!facetName) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'facetName is required',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    // Perform a search with zero results but requesting facet data
    const response = await searchAssets(
      searchTerm,
      {
        facets: [facetName],
        hitsPerPage: 0,
        page: 0,
      },
      env,
      request,
    );

    const results = response?.results?.[0];
    if (!results || !results.facets) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: {
                  facetName,
                  values: [],
                  count: 0,
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Extract facet values and counts
    const facetData = results.facets[facetName] || {};
    const facetEntries = Object.entries(facetData)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count) // Sort by count descending
      .slice(0, maxValues);

    const result = {
      success: true,
      data: {
        facetName,
        values: facetEntries,
        count: facetEntries.length,
        totalCount: Object.keys(facetData).length,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('List facet values error:', error);
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
