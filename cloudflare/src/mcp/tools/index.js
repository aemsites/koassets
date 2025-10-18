/**
 * MCP Tools - Asset Search and Management
 */

import * as searchAssetsTool from './search-assets.js';
import * as getAssetMetadataTool from './get-asset-metadata.js';
import * as getAssetRenditionsTool from './get-asset-renditions.js';
import * as checkAssetRightsTool from './check-asset-rights.js';
import * as listFacetValuesTool from './list-facet-values.js';
import * as getRightsHierarchyTool from './get-rights-hierarchy.js';
import * as searchCollectionsTool from './search-collections.js';

// Registry of all available tools
const TOOLS = {
  'search_assets': searchAssetsTool,
  'get_asset_metadata': getAssetMetadataTool,
  'get_asset_renditions': getAssetRenditionsTool,
  'check_asset_rights': checkAssetRightsTool,
  'list_facet_values': listFacetValuesTool,
  'get_rights_hierarchy': getRightsHierarchyTool,
  'search_collections': searchCollectionsTool
};

/**
 * List all available tools
 */
export async function listTools(env) {
  return Object.values(TOOLS).map(tool => tool.definition);
}

/**
 * Call a specific tool
 */
export async function callTool(name, args, env, request) {
  const tool = TOOLS[name];
  
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  if (!tool.handler) {
    throw new Error(`Tool ${name} has no handler`);
  }

  try {
    const result = await tool.handler(args, env, request);
    return result;
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    throw new Error(`Tool execution failed: ${error.message}`);
  }
}

