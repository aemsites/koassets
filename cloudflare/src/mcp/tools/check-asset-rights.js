/**
 * Check Asset Rights Tool
 * Verify if assets are cleared for specific markets, media channels, and date ranges
 */

import { checkAssetRights } from '../utils/api-client.js';

export const definition = {
  name: 'check_asset_rights',
  description:
    'Check if specific assets have usage rights cleared for given markets, media channels, and date range. Returns authorization status for each asset.',
  inputSchema: {
    type: 'object',
    properties: {
      assetIds: {
        type: 'array',
        items: {
          type: 'string',
        },
        description: 'Array of asset IDs to check (e.g., ["urn:aaid:aem:12345..."])',
      },
      markets: {
        type: 'array',
        items: {
          type: 'number',
        },
        description: 'Array of market rights IDs (type 30) to check against',
      },
      mediaChannels: {
        type: 'array',
        items: {
          type: 'number',
        },
        description: 'Array of media channel rights IDs (type 20) to check against',
      },
      airDate: {
        type: 'number',
        description: 'Start date for usage (Unix epoch timestamp in seconds)',
      },
      pullDate: {
        type: 'number',
        description: 'End date for usage (Unix epoch timestamp in seconds)',
      },
    },
    required: ['assetIds', 'markets', 'mediaChannels', 'airDate', 'pullDate'],
  },
};

export async function handler(args, env, request) {
  const { assetIds, markets, mediaChannels, airDate, pullDate } = args;

  // Validate required fields
  if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'assetIds array is required and must not be empty',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  if (!markets || !Array.isArray(markets) || markets.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'markets array is required and must not be empty',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  if (!mediaChannels || !Array.isArray(mediaChannels) || mediaChannels.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'mediaChannels array is required and must not be empty',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  if (!airDate || !pullDate) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'airDate and pullDate are required',
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
    // Convert asset IDs from full URN format to short format (remove urn:aaid:aem: prefix)
    const selectedExternalAssets = assetIds.map((id) =>
      id.startsWith('urn:aaid:aem:') ? id.replace('urn:aaid:aem:', '') : id,
    );

    // Build the rights check request
    const checkRequest = {
      inDate: airDate,
      outDate: pullDate,
      selectedExternalAssets,
      selectedRights: {
        20: mediaChannels, // Media rights
        30: markets, // Market rights
      },
    };

    const response = await checkAssetRights(checkRequest, env, request);

    // Handle empty response (204 No Content means all assets are authorized)
    if (response === null || response.status === 204) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                data: {
                  allAuthorized: true,
                  totalAssets: assetIds.length,
                  authorizedAssets: assetIds.length,
                  restrictedAssets: 0,
                  assets: assetIds.map((id) => ({
                    assetId: id,
                    status: 'available',
                    authorized: true,
                  })),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Process the response
    const restOfAssets = response.restOfAssets || [];
    const _restrictedAssetIds = new Set(restOfAssets.map((item) => `urn:aaid:aem:${item.asset.assetExtId}`));

    const result = {
      success: true,
      data: {
        allAuthorized: restOfAssets.length === 0,
        totalAssets: assetIds.length,
        authorizedAssets: assetIds.length - restOfAssets.length,
        restrictedAssets: restOfAssets.length,
        assets: assetIds.map((id) => {
          const restrictedItem = restOfAssets.find((item) => `urn:aaid:aem:${item.asset.assetExtId}` === id);

          if (restrictedItem) {
            return {
              assetId: id,
              assetName: restrictedItem.asset.name,
              status: restrictedItem.notAvailable
                ? 'not_available'
                : restrictedItem.availableExcept
                  ? 'available_except'
                  : 'available',
              authorized: !restrictedItem.notAvailable,
              availableCount: restrictedItem.availableCount,
              notAvailableCount: restrictedItem.notAvailableCount,
              allSelectionCount: restrictedItem.allSelectionCount,
            };
          }

          return {
            assetId: id,
            status: 'available',
            authorized: true,
          };
        }),
        requestedRights: {
          markets,
          mediaChannels,
          dateRange: {
            from: airDate,
            to: pullDate,
          },
        },
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
    console.error('Check asset rights error:', error);
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
