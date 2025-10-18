/**
 * Search Collections Tool
 * Search for asset collections (curated groups of assets)
 */

import { searchCollections } from '../utils/api-client.js';

export const definition = {
  name: 'search_collections',
  description: 'Search for asset collections (curated groups of assets organized by theme, campaign, or purpose). Returns collection metadata and IDs that can be used to filter asset searches.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term to find collections by name or description'
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (0-based). Default: 0',
        default: 0
      },
      hitsPerPage: {
        type: 'number',
        description: 'Number of results per page. Default: 20, Max: 100',
        default: 20
      }
    }
  }
};

export async function handler(args, env, request) {
  const { query = '', page = 0, hitsPerPage = 20 } = args;

  try {
    const response = await searchCollections(query, {
      hitsPerPage: Math.min(hitsPerPage, 100),
      page
    }, env, request);

    // Extract results from Algolia response
    const results = response?.results?.[0];
    if (!results) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                collections: [],
                nbHits: 0,
                page: 0,
                nbPages: 0,
                hitsPerPage: hitsPerPage
              }
            }, null, 2)
          }
        ]
      };
    }

    // Format response for MCP
    const formattedResults = {
      success: true,
      data: {
        collections: results.hits.map(hit => ({
          collectionId: hit.collectionId,
          title: hit.collectionMetadata?.title,
          description: hit.collectionMetadata?.description,
          createDate: hit.repositoryMetadata?.['repo-createDate'],
          createdBy: hit.repositoryMetadata?.['repo-createdBy'],
          modifyDate: hit.repositoryMetadata?.['repo-modifyDate'],
          modifiedBy: hit.repositoryMetadata?.['repo-modifiedBy'],
          usage: {
            description: 'Use this collectionId with search_assets tool',
            example: {
              tool: 'search_assets',
              collectionId: hit.collectionId
            }
          }
        })),
        nbHits: results.nbHits,
        page: results.page,
        nbPages: results.nbPages,
        hitsPerPage: results.hitsPerPage,
        query: query
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResults, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Search collections error:', error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
}

