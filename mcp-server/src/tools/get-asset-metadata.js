/**
 * Get Asset Metadata Tool
 * Retrieve detailed metadata for a specific asset
 */

import { getAssetMetadata } from '../utils/api-client.js';

export const definition = {
  name: 'get_asset_metadata',
  description: 'Retrieve comprehensive metadata for a specific asset including technical details, rights information, marketing data, and usage guidelines.',
  inputSchema: {
    type: 'object',
    properties: {
      assetId: {
        type: 'string',
        description: 'The unique identifier of the asset (e.g., "urn:aaid:aem:12345678-1234-1234-1234-123456789abc")',
        pattern: '^urn:aaid:aem:'
      }
    },
    required: ['assetId']
  }
};

export async function handler(args, env, request) {
  const { assetId } = args;

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
    const metadata = await getAssetMetadata(assetId, env, request);

    if (!metadata) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Asset not found'
            }, null, 2)
          }
        ],
        isError: true
      };
    }

    // Structure the metadata into logical categories
    const structuredMetadata = {
      success: true,
      data: {
        assetId: metadata.assetId,
        
        // Basic Information
        basic: {
          name: metadata['repo:name'],
          title: metadata['tccc-title'],
          description: metadata['dc:description'],
          keywords: metadata['tccc-keywords'],
          tags: metadata['tccc-tags']
        },

        // Technical Details
        technical: {
          format: metadata['repo:format'],
          mimeType: metadata['dc:format'],
          size: metadata['repo:size'],
          width: metadata['tiff:ImageWidth'],
          height: metadata['tiff:ImageLength'],
          duration: metadata['xmpDM:duration'],
          resolution: metadata['tccc-resolution']
        },

        // Brand & Marketing
        marketing: {
          brand: metadata['tccc-brand'],
          subBrand: metadata['tccc-subBrand'],
          campaign: metadata['tccc-campaignName'],
          category: metadata['tccc-category']
        },

        // Rights & Usage
        rights: {
          assetStatus: metadata['tccc-assetStatus'],
          readyToUse: metadata['tccc-readyToUse'],
          rightsStatus: metadata['tccc-rightsStatus'],
          rightsStartDate: metadata['tccc-rightsStartDate'],
          rightsEndDate: metadata['tccc-rightsEndDate'],
          marketCovered: metadata['tccc-marketCovered'],
          mediaCovered: metadata['tccc-mediaCovered'],
          expirationDate: metadata['pur-expirationDate']
        },

        // System Information
        system: {
          createDate: metadata['repo-createDate'],
          createdBy: metadata['repo-createdBy'],
          modifyDate: metadata['repo-modifyDate'],
          modifiedBy: metadata['repo-modifiedBy'],
          publishDate: metadata['repo-publishDate']
        },

        // Raw metadata (all fields)
        raw: metadata
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(structuredMetadata, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Get asset metadata error:', error);
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

