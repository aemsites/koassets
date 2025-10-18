/**
 * Get Asset Renditions Tool
 * Retrieve available renditions/versions of an asset
 */

import { getAssetRenditions, getImagePresets } from '../utils/api-client.js';

export const definition = {
  name: 'get_asset_renditions',
  description: 'Get all available renditions (different sizes, formats, or versions) of a specific asset. Useful for finding download options or preview versions.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'The unique identifier of the asset',
        pattern: '^urn:aaid:aem:'
      },
      includeImagePresets: {
        type: 'boolean',
        description: 'Whether to include available image presets. Default: false',
        default: false
      }
    },
    required: ['assetId']
  }
};

export async function handler(args, env, request) {
  const { assetId, includeImagePresets = false } = args;

  if (!assetId) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'assetId is required'
          }, null, 2)
        }
      ],
      isError: true
    };
  }

  try {
    // Get asset renditions
    const renditionsResponse = await getAssetRenditions(assetId, env, request);
    const renditions = renditionsResponse?.items || [];

    let imagePresets = [];
    if (includeImagePresets) {
      try {
        const presetsResponse = await getImagePresets(env, request);
        imagePresets = presetsResponse?.items || [];
      } catch (error) {
        console.warn('Failed to fetch image presets:', error);
      }
    }

    const result = {
      success: true,
      data: {
        assetId,
        renditions: renditions.map(r => ({
          name: r.name,
          format: r.format,
          size: r.size,
          dimensions: r.dimensions ? {
            width: r.dimensions.width,
            height: r.dimensions.height
          } : null,
          type: r.name === 'original' ? 'original' : 'derivative'
        })),
        renditionsCount: renditions.length
      }
    };

    if (includeImagePresets && imagePresets.length > 0) {
      result.data.imagePresets = imagePresets.map(p => ({
        name: p.name,
        format: p.format,
        dimensions: p.dimensions ? {
          width: p.dimensions.width,
          height: p.dimensions.height
        } : null
      }));
      result.data.imagePresetsCount = imagePresets.length;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Get asset renditions error:', error);
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

