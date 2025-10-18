/**
 * MCP Resources
 * Provides resource endpoints for accessing asset data
 */

import { getAssetMetadata } from '../utils/api-client.js';

/**
 * List available resource URI templates
 */
export async function listResources(env) {
  return [
    {
      uri: 'asset://{assetId}',
      name: 'Asset Resource',
      description: 'Access detailed metadata for a specific asset by its ID',
      mimeType: 'application/json'
    },
    {
      uri: 'koassets://help',
      name: 'Help Documentation',
      description: 'Get help and documentation about using the KO Assets MCP server',
      mimeType: 'text/markdown'
    }
  ];
}

/**
 * Read a specific resource
 */
export async function readResource(uri, env, request) {
  // Parse the URI
  const url = new URL(uri);
  
  if (url.protocol === 'asset:') {
    // Asset resource: asset://urn:aaid:aem:12345678...
    const assetId = url.hostname + url.pathname;
    
    if (!assetId || !assetId.startsWith('urn:aaid:aem:')) {
      throw new Error('Invalid asset URI format. Expected: asset://urn:aaid:aem:{uuid}');
    }

    try {
      const metadata = await getAssetMetadata(assetId, env, request);
      
      if (!metadata) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      return [
        {
          uri: uri,
          mimeType: 'application/json',
          text: JSON.stringify(metadata, null, 2)
        }
      ];
    } catch (error) {
      throw new Error(`Failed to read asset resource: ${error.message}`);
    }
  } else if (url.protocol === 'koassets:' && url.hostname === 'help') {
    // Help resource
    const helpText = `# KO Assets MCP Server - Help

## Overview
The KO Assets MCP Server provides access to digital asset management and rights clearance for The Coca-Cola Company's asset library.

## Available Tools

### 1. search_assets
Search for digital assets using keywords and filters.
- **Usage**: Find assets by brand, category, format, dates, etc.
- **Returns**: List of assets with metadata and URLs

### 2. get_asset_metadata
Get detailed metadata for a specific asset.
- **Usage**: Retrieve comprehensive information about an asset
- **Returns**: Structured metadata including technical, marketing, and rights information

### 3. get_asset_renditions
Get available renditions/versions of an asset.
- **Usage**: Find different sizes and formats available for download
- **Returns**: List of renditions with dimensions and formats

### 4. check_asset_rights
Check if assets are cleared for specific usage.
- **Usage**: Verify rights for markets, media channels, and date ranges
- **Returns**: Authorization status for each asset

### 5. list_facet_values
Get available values for filter facets.
- **Usage**: Discover what brands, categories, formats are available
- **Returns**: List of facet values with counts

### 6. get_rights_hierarchy
Get hierarchical list of markets or media channels.
- **Usage**: Find market and media channel IDs for rights checking
- **Returns**: Tree structure of available rights

### 7. search_collections
Search for asset collections.
- **Usage**: Find curated groups of assets
- **Returns**: List of collections with metadata

## Resources

### asset://{assetId}
Direct access to asset metadata via URI.
Example: asset://urn:aaid:aem:12345678-1234-1234-1234-123456789abc

## Authentication
Requests are authenticated via session cookie forwarded from the client.

## API Endpoint
Base URL configured via KOASSETS_API_URL environment variable.

## Examples

### Search for Coca-Cola images
\`\`\`json
{
  "tool": "search_assets",
  "arguments": {
    "query": "",
    "facetFilters": {
      "brand": ["Coca-Cola"],
      "category": ["Image"]
    }
  }
}
\`\`\`

### Check rights for an asset
\`\`\`json
{
  "tool": "check_asset_rights",
  "arguments": {
    "assetIds": ["urn:aaid:aem:12345..."],
    "markets": [123, 456],
    "mediaChannels": [789],
    "airDate": 1704067200,
    "pullDate": 1735689600
  }
}
\`\`\`
`;

    return [
      {
        uri: uri,
        mimeType: 'text/markdown',
        text: helpText
      }
    ];
  }

  throw new Error(`Unknown resource URI scheme: ${url.protocol}`);
}

