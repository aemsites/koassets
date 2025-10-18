/**
 * Get Rights Hierarchy Tool
 * Get hierarchical list of markets or media channels for rights checking
 */

import { getMediaRights, getMarketRights } from '../utils/api-client.js';

export const definition = {
  name: 'get_rights_hierarchy',
  description: 'Get a hierarchical list of available markets or media channels for rights checking. Returns the complete tree structure with IDs needed for check_asset_rights tool.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['markets', 'mediaChannels'],
        description: 'Type of rights hierarchy to retrieve: "markets" (geographic markets) or "mediaChannels" (media types like TV, Digital, Print)'
      }
    },
    required: ['type']
  }
};

/**
 * Recursively flatten rights hierarchy into a more usable format
 */
function flattenRightsHierarchy(attributes, type) {
  const flattened = [];

  function traverse(item, parentPath = '', level = 0) {
    const node = {
      id: item.id,
      rightId: item.right.rightId,
      name: item.right.description,
      shortDescription: item.right.shortDescription,
      code: item.right.code,
      externalId: item.externalId,
      enabled: item.enabled,
      level,
      path: parentPath ? `${parentPath} > ${item.right.description}` : item.right.description,
      hasChildren: item.childrenLst && item.childrenLst.length > 0
    };

    flattened.push(node);

    if (item.childrenLst && item.childrenLst.length > 0) {
      item.childrenLst.forEach(child => {
        traverse(child, node.path, level + 1);
      });
    }
  }

  attributes.forEach(attr => traverse(attr));
  return flattened;
}

export async function handler(args, env, request) {
  const { type } = args;

  if (!type || !['markets', 'mediaChannels'].includes(type)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'type must be either "markets" or "mediaChannels"'
          }, null, 2)
        }
      ],
      isError: true
    };
  }

  try {
    let response;
    if (type === 'markets') {
      response = await getMarketRights(env, request);
    } else {
      response = await getMediaRights(env, request);
    }

    if (!response || !response.attribute) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                type,
                hierarchy: [],
                count: 0
              }
            }, null, 2)
          }
        ]
      };
    }

    const flattened = flattenRightsHierarchy(response.attribute, type);

    const result = {
      success: true,
      data: {
        type,
        hierarchy: flattened,
        count: flattened.length,
        topLevel: flattened.filter(item => item.level === 0),
        usage: {
          description: `Use the 'id' field from these items in the ${type === 'markets' ? 'markets' : 'mediaChannels'} array when calling check_asset_rights`,
          example: type === 'markets' 
            ? { markets: [flattened[0]?.id, flattened[1]?.id] }
            : { mediaChannels: [flattened[0]?.id, flattened[1]?.id] }
        }
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error('Get rights hierarchy error:', error);
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

