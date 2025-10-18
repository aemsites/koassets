/**
 * MCP Prompts
 * Provides pre-configured prompt templates for common asset management tasks
 */

/**
 * List available prompts
 */
export async function listPrompts(_env) {
  return [
    {
      name: 'find-brand-assets',
      description: 'Find assets for a specific brand and optionally filter by category',
      arguments: [
        {
          name: 'brand',
          description: 'Brand name (e.g., Coca-Cola, Sprite, Fanta)',
          required: true,
        },
        {
          name: 'category',
          description: 'Asset category (e.g., Image, Video, Document)',
          required: false,
        },
        {
          name: 'limit',
          description: 'Maximum number of results to return',
          required: false,
        },
      ],
    },
    {
      name: 'check-usage-rights',
      description: 'Check if assets can be used in specific markets and media channels',
      arguments: [
        {
          name: 'assetIds',
          description: 'Comma-separated list of asset IDs',
          required: true,
        },
        {
          name: 'market',
          description: 'Target market name (e.g., United States, Mexico)',
          required: true,
        },
        {
          name: 'media',
          description: 'Media channel (e.g., Digital, TV, Print)',
          required: true,
        },
        {
          name: 'startDate',
          description: 'Usage start date (YYYY-MM-DD)',
          required: true,
        },
        {
          name: 'endDate',
          description: 'Usage end date (YYYY-MM-DD)',
          required: true,
        },
      ],
    },
    {
      name: 'explore-brand',
      description: 'Explore all available assets for a brand with statistics',
      arguments: [
        {
          name: 'brand',
          description: 'Brand name to explore',
          required: true,
        },
      ],
    },
    {
      name: 'find-campaign-assets',
      description: 'Find all assets related to a specific campaign',
      arguments: [
        {
          name: 'campaign',
          description: 'Campaign name',
          required: true,
        },
        {
          name: 'includeCollections',
          description: 'Whether to also search in collections',
          required: false,
        },
      ],
    },
  ];
}

/**
 * Get a specific prompt with arguments filled in
 */
export async function getPrompt(name, args, _env) {
  switch (name) {
    case 'find-brand-assets':
      return buildFindBrandAssetsPrompt(args);

    case 'check-usage-rights':
      return buildCheckUsageRightsPrompt(args);

    case 'explore-brand':
      return buildExploreBrandPrompt(args);

    case 'find-campaign-assets':
      return buildFindCampaignAssetsPrompt(args);

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

/**
 * Build prompt for finding brand assets
 */
function buildFindBrandAssetsPrompt(args) {
  const { brand, category, limit = 24 } = args;

  if (!brand) {
    throw new Error('brand argument is required');
  }

  let prompt = `Find assets for the brand "${brand}"`;

  if (category) {
    prompt += ` in the category "${category}"`;
  }

  prompt += `.

Please use the search_assets tool with the following parameters:
- facetFilters: { brand: ["${brand}"]${category ? `, category: ["${category}"]` : ''} }
- hitsPerPage: ${limit}

After getting the results, provide a summary that includes:
1. Total number of assets found
2. List of the first 10 assets with their titles and asset IDs
3. Breakdown by format/category if available
4. Any notable patterns in the assets (e.g., recent uploads, rights status)`;

  return {
    description: `Finding assets for brand: ${brand}${category ? ` (category: ${category})` : ''}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prompt,
        },
      },
    ],
  };
}

/**
 * Build prompt for checking usage rights
 */
function buildCheckUsageRightsPrompt(args) {
  const { assetIds, market, media, startDate, endDate } = args;

  if (!assetIds || !market || !media || !startDate || !endDate) {
    throw new Error('assetIds, market, media, startDate, and endDate arguments are required');
  }

  const assetIdArray = assetIds.split(',').map((id) => id.trim());

  const prompt = `Check usage rights for ${assetIdArray.length} asset(s) in market "${market}" for media channel "${media}" from ${startDate} to ${endDate}.

Please follow these steps:
1. First, use get_rights_hierarchy tool to find the ID for market "${market}" (type: markets)
2. Then, use get_rights_hierarchy tool to find the ID for media channel "${media}" (type: mediaChannels)
3. Convert the dates to Unix epoch timestamps:
   - Start date: ${startDate}
   - End date: ${endDate}
4. Finally, use check_asset_rights tool with:
   - assetIds: ${JSON.stringify(assetIdArray)}
   - markets: [<market ID from step 1>]
   - mediaChannels: [<media ID from step 2>]
   - airDate: <epoch from step 3>
   - pullDate: <epoch from step 3>

After getting the results, provide a clear summary:
1. How many assets are authorized vs restricted
2. For any restricted assets, explain why
3. Recommendations for next steps`;

  return {
    description: `Checking usage rights for ${assetIdArray.length} asset(s)`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prompt,
        },
      },
    ],
  };
}

/**
 * Build prompt for exploring a brand
 */
function buildExploreBrandPrompt(args) {
  const { brand } = args;

  if (!brand) {
    throw new Error('brand argument is required');
  }

  const prompt = `Provide a comprehensive overview of assets for the brand "${brand}".

Please gather the following information:
1. Use search_assets to get total count and recent assets for "${brand}"
2. Use list_facet_values for "tccc-category" filtered by the brand to see asset types
3. Use search_collections to find any collections related to "${brand}"

Provide a summary that includes:
- Total number of assets
- Breakdown by asset type (images, videos, etc.)
- Most common formats
- Any recent additions (last 30 days if available)
- Related collections
- Notable campaigns or themes`;

  return {
    description: `Exploring brand: ${brand}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prompt,
        },
      },
    ],
  };
}

/**
 * Build prompt for finding campaign assets
 */
function buildFindCampaignAssetsPrompt(args) {
  const { campaign, includeCollections = 'true' } = args;

  if (!campaign) {
    throw new Error('campaign argument is required');
  }

  const shouldIncludeCollections = includeCollections === 'true' || includeCollections === true;

  let prompt = `Find all assets related to the campaign "${campaign}".

Please:
1. Use search_assets with query "${campaign}" to find assets`;

  if (shouldIncludeCollections) {
    prompt += `
2. Use search_collections with query "${campaign}" to find campaign collections
3. If collections are found, search within those collections for assets`;
  }

  prompt += `

Provide a summary that includes:
- Total number of assets found
- Asset types and formats
- Key visuals (list top 5-10 assets)${shouldIncludeCollections ? '\n- Related collections and their contents' : ''}
- Any rights or usage information`;

  return {
    description: `Finding assets for campaign: ${campaign}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: prompt,
        },
      },
    ],
  };
}
