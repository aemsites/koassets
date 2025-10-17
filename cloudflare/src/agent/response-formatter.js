/**
 * Response Formatter
 * Formats MCP tool results for display in chat UI
 */

/**
 * Format search_assets response
 */
export function formatAssetResponse(data) {
  try {
    // Handle both nested and direct data structures
    const hits = data.data?.hits || data.hits || [];
    const nbHits = data.data?.nbHits || data.nbHits || hits.length;

    return {
      total: nbHits,
      count: hits.length,
      assets: hits.slice(0, 12).map(hit => ({
        id: hit.assetId || hit.objectID || hit.id,
        title: hit.title || hit['dc:title'] || 'Untitled Asset',
        thumbnail: hit.thumbnail || hit.thumbnailUrl || hit.url || '',
        brand: hit.brand || '',
        category: hit.category || hit['dam:assetType'] || '',
        format: hit.format || hit['dc:format'] || '',
        created: hit.created || hit['xmp:CreateDate'] || '',
        description: hit.description || hit['dc:description'] || '',
      })),
    };
  } catch (error) {
    console.error('[Format Asset Error]', error);
    return {
      total: 0,
      count: 0,
      assets: [],
    };
  }
}

/**
 * Format check_asset_rights response
 */
export function formatRightsResponse(data) {
  try {
    const rightsData = data.data || data;

    return {
      allAuthorized: rightsData.allAuthorized || false,
      totalAssets: rightsData.totalAssets || 0,
      authorizedAssets: rightsData.authorizedAssets || 0,
      restrictedAssets: rightsData.restrictedAssets || 0,
      assets: (rightsData.assets || []).map(asset => ({
        id: asset.assetId,
        title: asset.title || asset.assetId,
        authorized: asset.authorized || false,
        restrictions: asset.restrictions || [],
        markets: asset.markets || [],
        mediaChannels: asset.mediaChannels || [],
      })),
    };
  } catch (error) {
    console.error('[Format Rights Error]', error);
    return {
      allAuthorized: false,
      totalAssets: 0,
      authorizedAssets: 0,
      restrictedAssets: 0,
      assets: [],
    };
  }
}

/**
 * Format metadata response
 */
export function formatMetadataResponse(data) {
  try {
    const metadata = data.data || data;

    return {
      assetId: metadata.assetId || metadata.id,
      title: metadata.title || metadata['dc:title'],
      description: metadata.description || metadata['dc:description'],
      brand: metadata.brand,
      category: metadata.category || metadata['dam:assetType'],
      format: metadata.format || metadata['dc:format'],
      created: metadata.created || metadata['xmp:CreateDate'],
      modified: metadata.modified || metadata['xmp:ModifyDate'],
      rights: metadata.rights || {},
      intendedUse: metadata.intendedUse || [],
      markets: metadata.markets || [],
      mediaChannels: metadata.mediaChannels || [],
      tags: metadata.tags || [],
      customFields: metadata.customFields || {},
    };
  } catch (error) {
    console.error('[Format Metadata Error]', error);
    return null;
  }
}



