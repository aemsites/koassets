#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { sanitize, sanitizeFileName, buildFileNameWithId } = require('./sanitize-utils.js');

const AEM_AUTHOR = 'https://author-p64403-e544653.adobeaemcloud.com';
let CONTENT_PATH = '/content/share/us/en/all-content-stores';
// let CONTENT_PATH = '/content/share/us/en/all-content-stores/global-coca-cola-uplift';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

// Load AUTH_COOKIE from config file
let AUTH_COOKIE;
try {
  const authConfig = fs.readFileSync(path.join(__dirname, 'da.config'), 'utf8').trim();
  const [, cookieValue] = authConfig.match(/AUTH_COOKIE=(.*)/);
  AUTH_COOKIE = cookieValue;
  if (!AUTH_COOKIE) {
    throw new Error('AUTH_COOKIE not found in da.config');
  }
} catch (error) {
  console.error(`❌ Error loading AUTH_COOKIE from da.config: ${error.message}`);
  process.exit(1);
}

// File paths
const lastContentPathToken = CONTENT_PATH.split('/').pop();
const OUTPUT_DIR = path.join(__dirname, lastContentPathToken, 'extracted-results');

// Image URL configuration
const BASE_URL = `${CONTENT_PATH}/`;

// Dynamic paths - will be discovered at runtime
const DISCOVERED_BASE_PATH = null;

// Function to download file from AEM
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      reject(new Error(`Invalid URL: ${url} - ${error.message}`));
      return;
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Cookie: AUTH_COOKIE,
        'User-Agent': 'Node.js AEM Content Extractor',
      },
    };

    const req = https.request(options, (res) => {
      // Handle redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;

        // If redirect URL is relative, make it absolute
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `https://${urlObj.hostname}${redirectUrl}`;
        }

        // Recursively follow the redirect
        downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
        return;
      }

      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const data = Buffer.concat(chunks);
          if (outputPath) {
            fs.writeFileSync(outputPath, data);
            console.log(`✅ Downloaded: ${path.basename(outputPath)} (${data.length} bytes)`);
          } else {
            console.log(`✅ Downloaded (skipped saving): ${path.basename(url)}`);
          }
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Function to ensure images directory exists
function ensureImagesDir() {
  const imagesDir = path.join(OUTPUT_DIR, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`📁 Created images directory: ${imagesDir}`);
  }
  return imagesDir;
}

// Function to download and save image if it doesn't already exist
async function downloadAndSaveImage(imageUrl, fileName, itemId) {
  const imagesDir = ensureImagesDir();
  // Build filename with itemId prepended
  const finalFileName = buildFileNameWithId(itemId, fileName);
  const imagePath = path.join(imagesDir, sanitizeFileName(finalFileName));

  // Check if image already exists
  if (fs.existsSync(imagePath)) {
    console.log(`⏭️  Image already exists, skipping: ${fileName}`);
    return imagePath;
  }

  try {
    await downloadFile(imageUrl, imagePath);
    return imagePath;
  } catch (error) {
    console.error(`❌ Failed to download image ${imageUrl}: ${error.message}`);
    return null;
  }
}

console.log('📋 ALL ITEMS WITH IMAGE URLS');
console.log('=============================');
console.log('');

// Main execution function
async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}`);
  }

  console.log('📥 Downloading jcr:content.infinity.json from AEM...\n');

  try {
    // First find the tabs path by downloading jcr:content structure
    const jcrUrl = `${AEM_AUTHOR}${CONTENT_PATH}/jcr:content.infinity.json`;
    console.log(`📡 Fetching JCR structure: ${jcrUrl}\n`);

    const jcrContent = await downloadFile(jcrUrl, path.join(OUTPUT_DIR, 'jcr-content.json'));
    const jcrData = JSON.parse(jcrContent);

    // Save jcr-content.json in pretty format
    fs.writeFileSync(path.join(OUTPUT_DIR, 'jcr-content.json'), JSON.stringify(jcrData, null, 2));
    console.log('✅ Saved jcr-content.json in pretty format\n');

    // Find all tabs paths in the JCR
    const tabsPaths = findAllTabsPaths(jcrData);
    console.log(`\n📊 Found ${tabsPaths.length} tabs path(s):`);
    tabsPaths.forEach((p) => console.log(`  - ${p}`));

    // Filter out nested tabs (tabs inside tab items) - they should remain nested
    // Nested tabs have '/tabs/' or '/tabs_' in their path (tabs inside tab items)
    const topLevelTabsPaths = tabsPaths.filter((path) => {
      // Count how many times '/tabs' appears in the path after the first occurrence
      const match = path.match(/\/tabs/g);
      return !match || match.length === 1; // Keep only paths with exactly one /tabs
    });

    console.log(`📋 Using top-level tabs only: ${topLevelTabsPaths.length} path(s)\n`);

    // Function to determine which JCR section a tab path belongs to
    function getJCRSectionForTabPath(tabPath, jcrData) {
      // tabPath is like: /jcr:content/root/container/container/container_732554625_/tabs
      // or: /jcr:content/root/container/container_copy_copy_1873410646/container_732554625_/tabs
      // We need to find which ROOT-level container this path traverses through

      const pathParts = tabPath.split('/').filter((p) => p && p !== 'jcr:content' && p !== 'root');
      if (pathParts.length === 0) return null;

      // Get all root-level container keys
      const rootContainer = jcrData.root.container;
      const rootKeys = Object.keys(rootContainer).filter((k) => !k.startsWith(':'));

      // Find the longest matching root-level container key in the path
      let matchedKey = null;
      let maxMatchLength = 0;

      for (const key of rootKeys) {
        // Check if this key appears anywhere in the path
        if (pathParts.includes(key) && key.length > maxMatchLength) {
          matchedKey = key;
          maxMatchLength = key.length;
        }
      }

      if (!matchedKey) {
        // Try matching by sequence - take all path parts until we find a root-level key
        for (let i = 0; i < pathParts.length; i++) {
          if (rootKeys.includes(pathParts[i])) {
            matchedKey = pathParts[i];
            break;
          }
        }
      }

      if (!matchedKey) return null;

      const container = rootContainer[matchedKey];
      if (!container || typeof container !== 'object') {
        return null;
      }

      // Recursively search for a title component within this container
      function findTitleInSubtree(obj) {
        for (const key in obj) {
          if (!key.startsWith(':') && obj[key] && typeof obj[key] === 'object') {
            const item = obj[key];
            if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
              return item['jcr:title'];
            }
            // Recurse into nested objects
            const result = findTitleInSubtree(item);
            if (result) return result;
          }
        }
        return null;
      }

      return findTitleInSubtree(container);
    }

    // Download all tabs as models and combine
    const allTabsData = [];
    for (let i = 0; i < topLevelTabsPaths.length; i++) {
      const tabsUrl = `${AEM_AUTHOR}${CONTENT_PATH}${topLevelTabsPaths[i]}.model.json`;
      console.log(`\n📥 Downloading tabs ${i + 1}/${topLevelTabsPaths.length}: ${tabsUrl}`);
      try {
        const tabsContent = await downloadFile(tabsUrl, null); // Pass null for intermediate files
        const tabsData = JSON.parse(tabsContent);

        // Attach JCR section information
        const jcrSection = getJCRSectionForTabPath(topLevelTabsPaths[i], jcrData);
        if (jcrSection) {
          tabsData.__jcrSection = jcrSection;
        }

        allTabsData.push(tabsData);
      } catch (err) {
        console.log(`  ⚠️  Failed to download this tabs: ${err.message}`);
      }
    }

    if (allTabsData.length === 0) {
      throw new Error('Could not download any tabs data');
    }

    console.log(`\n✅ Downloaded ${allTabsData.length} tabs model(s)`);

    // Track the most comprehensive model (the one with the most items)
    let mostComprehensiveModel = allTabsData[0];
    let maxItemCount = allTabsData[0][':itemsOrder']?.length || 0;

    allTabsData.forEach((tabs, idx) => {
      const itemCount = tabs[':itemsOrder']?.length || 0;
      console.log(`  - Tabs ${idx}: ${itemCount} items`);
      if (itemCount > maxItemCount) {
        maxItemCount = itemCount;
        mostComprehensiveModel = tabs;
      }
    });

    console.log(`\n📊 Most comprehensive model: ${maxItemCount} items`);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'most-comprehensive-tabs.model.json'),
      JSON.stringify(mostComprehensiveModel, null, 2),
    );
    console.log('💾 Saved most comprehensive model to: most-comprehensive-tabs.model.json\n');

    // Combine ALL tabs data to get complete hierarchy
    const combinedTabsData = {
      ':itemsOrder': [],
      ':items': {},
      ':type': 'tccc-dam/components/tabs',
      id: 'combined-tabs',
    };

    // Merge all tabs intelligently
    // Use a unique key for each item from each tabs to preserve all content
    allTabsData.forEach((tabs, idx) => {
      const itemsOrder = tabs[':itemsOrder'] || [];
      const items = tabs[':items'] || {};

      itemsOrder.forEach((key) => {
        // Create a unique key combining original key and tabs index
        // This ensures items with the same name from different tabs don't overwrite each other
        const uniqueKey = `${key}__tabs${idx}`;

        combinedTabsData[':itemsOrder'].push(uniqueKey);
        const item = items[key];
        combinedTabsData[':items'][uniqueKey] = item;

        // Attach JCR section information from the tabs data
        if (tabs.__jcrSection) {
          item.__jcrSection = tabs.__jcrSection;
        }
      });
    });

    console.log(`📌 Combined all tabs into ${combinedTabsData[':itemsOrder'].length} items\n`);
    const mainTabsData = combinedTabsData;

    // Create a map of all titles to their sling:resourceType from JCR
    const jcrTitleMap = {};
    const jcrLinkUrlMap = {}; // Map of (title|parentKey) -> linkURL
    const jcrTextMap = {}; // Map of (title|parentKey) -> text content
    const jcrButtonsWithoutLinkUrl = {}; // Track buttons that DON'T have linkURL
    const jcrPathMap = {}; // Map of key -> full JCR path for image URLs
    const jcrTeaserImageMap = {}; // Map of teaser key -> {fileName, lastModified, jcrPath}
    function indexJCRByTitle(obj, parentPath = '', parentKey = '') {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
        if (!key.startsWith(':') && typeof obj[key] === 'object') {
          const rt = obj[key]['sling:resourceType'];
          const title = obj[key]['cq:panelTitle'] || obj[key]['jcr:title'] || obj[key].title;
          const { linkURL } = obj[key];

          // Store JCR path for teasers and other items
          if (key.startsWith('teaser') || key.startsWith('button')) {
            jcrPathMap[key] = `${parentPath}/${key}`;
          }

          // Store teaser image information ONLY if it has imageResource in model
          if (key.startsWith('teaser') && obj[key].file && obj[key].fileName) {
            // Store all teasers - purely data-driven extraction
            const { fileName } = obj[key];
            // Use teaser's jcr:lastModified for timestamp
            const lastModifiedStr = obj[key]['jcr:lastModified'] || obj[key].file['jcr:lastModified'] || obj[key].file['jcr:created'];
            // Convert to Unix timestamp in milliseconds
            const lastModified = new Date(lastModifiedStr).getTime();

            // Create unique key for each teaser instance (path-based)
            // Extract the path starting from first item_ component to match model paths
            const pathParts = parentPath.split('/');
            const itemIndex = pathParts.findIndex((p) => p.startsWith('item_'));
            const modelPath = itemIndex >= 0 ? `/${pathParts.slice(itemIndex).join('/')}/${key}` : `${parentPath}/${key}`;

            jcrTeaserImageMap[modelPath] = {
              fileName,
              lastModified,
              jcrPath: `${parentPath}/${key}`,
              teaserKey: key,
              // Mark as pending - will be confirmed when checking model
              hasImageResource: false,
            };
          }

          if (title && rt) {
            jcrTitleMap[String(title)] = rt;
          }

          // Capture linkURL for button items
          if (title && rt && rt.includes('button')) {
            const titleKey = String(title);
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${titleKey}|${parentKeyContext}`;

            if (linkURL) {
              // Store buttons WITH linkURL by context key AND title-only
              jcrLinkUrlMap[contextKey] = linkURL;
              jcrLinkUrlMap[titleKey] = linkURL;
            }
            // Note: Don't store buttons WITHOUT linkURL to avoid false positives
            // Only store the ones WITH linkURLs
          }

          // Capture text content from text_* properties OR direct text component items
          if (title) {
            const titleKey = String(title);
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${titleKey}|${parentKeyContext}`;

            let textContent = null;

            // First, check if this item itself is a text component with direct text field
            if (rt && rt.includes('text') && obj[key].text) {
              textContent = obj[key].text;
            } else {
              // Otherwise, look for properties starting with "text_" that contain a "text" field
              for (const textKey in obj[key]) {
                if (textKey.startsWith('text_') && obj[key][textKey].text) {
                  textContent = obj[key][textKey].text;
                  break; // Take the first text_* property found
                }
              }
            }

            if (textContent) {
              // Store text by context key (title|parentKey) and title-only as fallback
              jcrTextMap[contextKey] = textContent;
              if (!jcrTextMap[titleKey]) { // Don't overwrite if title-only already has value
                jcrTextMap[titleKey] = textContent;
              }
            }
          } else if (rt && rt.includes('text') && obj[key].text) {
            // For text components without a title, store by key context
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${key}|${parentKeyContext}`;
            const textContent = obj[key].text;
            jcrTextMap[contextKey] = textContent;
            // Also store by key only as fallback
            if (!jcrTextMap[key]) {
              jcrTextMap[key] = textContent;
            }
          }

          indexJCRByTitle(obj[key], `${parentPath}/${key}`, key);
        }
      }
    }
    indexJCRByTitle(jcrData.root);

    // Apply resource types to tabs model by matching titles
    function enrichByTitle(items) {
      if (!items || typeof items !== 'object') return;
      for (const key in items) {
        if (!key.startsWith(':') && typeof items[key] === 'object') {
          const title = items[key]['cq:panelTitle'] || items[key]['jcr:title'] || items[key].title;
          if (title && jcrTitleMap[String(title)]) {
            items[key]['sling:resourceType'] = jcrTitleMap[String(title)];
          }
          if (items[key][':items']) enrichByTitle(items[key][':items']);
        }
      }
    }
    enrichByTitle(mainTabsData[':items']);

    // Extract jcr:lastModified timestamps from model data for teasers
    function extractTimestampsFromModel(items, basePath = '') {
      if (!items || typeof items !== 'object') return;

      // Process items in order if :itemsOrder exists, otherwise use for...in
      const itemsOrder = items[':itemsOrder'] || Object.keys(items).filter((k) => !k.startsWith(':'));

      for (const key of itemsOrder) {
        if (!key.startsWith(':') && items[key] && typeof items[key] === 'object') {
          const newPath = `${basePath}/${key}`;
          const item = items[key];

          // Check if this is a teaser item with valid image data
          if ((key.startsWith('teaser') || item['sling:resourceType']?.includes('teaser')) && item.imageResource && item.imageResource['jcr:lastModified']) {
            // Create path-based unique key to match JCR indexing
            const uniqueKey = `${newPath}`;

            // Find JCR entry that matches both the component name AND the image filename
            let matchingJcrKey = null;
            const modelFileName = item.imageResource.fileName;

            // Look for JCR entries with matching component name and filename
            for (const [jcrPath, jcrData] of Object.entries(jcrTeaserImageMap)) {
              if (jcrData.teaserKey === key && jcrData.fileName === modelFileName) {
                matchingJcrKey = jcrPath;
                break;
              }
            }

            // Only update if we found a matching JCR entry with the same filename
            if (matchingJcrKey) {
              jcrTeaserImageMap[matchingJcrKey].lastModified = item.imageResource['jcr:lastModified'];
              jcrTeaserImageMap[matchingJcrKey].hasImageResource = true;
              jcrTeaserImageMap[matchingJcrKey].modelPath = uniqueKey; // Store model path for lookup
            }
          }

          // Recurse into nested items
          if (item[':items']) {
            extractTimestampsFromModel(item[':items'], newPath);
          }
        }
      }
    }
    extractTimestampsFromModel(mainTabsData[':items']);

    // Remove teasers from jcrTeaserImageMap that don't have imageResource in model
    const beforeCleanup = Object.keys(jcrTeaserImageMap).length;
    for (const uniqueKey in jcrTeaserImageMap) {
      if (!jcrTeaserImageMap[uniqueKey].hasImageResource) {
        delete jcrTeaserImageMap[uniqueKey];
      }
    }
    const afterCleanup = Object.keys(jcrTeaserImageMap).length;
    if (beforeCleanup !== afterCleanup) {
      console.log(`🧹 Cleaned up ${beforeCleanup - afterCleanup} teasers without imageResource from model`);
    }

    // Continue with parsing
    // eslint-disable-next-line no-use-before-define
    parseHierarchyFromModel(mainTabsData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrData, jcrPathMap, jcrTeaserImageMap);
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

// Function to build JSON structure
function buildJsonStructure(jsonData, teaserPathMap) {
  if (!jsonData || !jsonData[':items']) return [];

  function buildJsonItems(items, parentPath = '', displayPath = '') {
    if (!items || typeof items !== 'object') return [];

    const result = [];
    const itemsOrder = items[':itemsOrder'] || Object.keys(items[':items'] || items);
    const itemsData = items[':items'] || items;

    if (itemsOrder && itemsData) {
      itemsOrder.forEach((itemKey) => {
        // Skip renamed duplicate items at root level (e.g., item_1_source1)
        if (parentPath === '' && itemKey.match(/_source\d+$/)) {
          return;
        }

        const item = itemsData[itemKey];
        if (!item) return;

        // Skip internal/structural keys
        if (itemKey.startsWith(':')) {
          return;
        }

        // Get title using fallback chain
        // eslint-disable-next-line no-use-before-define
        const title = extractTitleFromItem(item, itemKey);

        // Build display path (hierarchy path for user viewing)
        const currentDisplayPath = displayPath ? `${displayPath} > ${title.trim()}` : title.trim();

        // Check if this is a teaser with image
        // eslint-disable-next-line no-use-before-define
        const isTeaserWithImage = isTeaser(item, itemKey);

        // Get content items (skipping structural containers)
        // eslint-disable-next-line no-use-before-define
        const contentItems = getContentItems(item);
        const hasChildren = contentItems && contentItems[':items']
                                  && Object.keys(contentItems[':items']).length > 0;

        // Build current path for context
        let currentPath = parentPath;

        if (itemKey !== ':items' && itemKey !== ':itemsOrder') {
          currentPath += `/${itemKey}`;
        }

        // Determine type
        let itemType = 'item'; // default
        if (isTeaserWithImage) {
          itemType = 'image';
        } else if (!hasChildren) {
          // Items without children are links
          itemType = 'link';
        } else {
          // Check if this has tab children (structure indicates tabs)
          const childKeys = Object.keys(contentItems[':items'] || {});
          const hasTabsChild = childKeys.some((k) => k === 'tabs' || k.match(/^tabs_.*$/));

          if (hasTabsChild) {
            itemType = 'tabs';
          } else {
            // Has children but no tabs component = dropdown or container
            itemType = 'dropdown';
          }
        }

        // Build the JSON item
        const jsonItem = {
          title,
          path: currentDisplayPath,
          type: itemType,
        };

        // Add ID if different from title
        if (title !== itemKey && item.id) {
          jsonItem.id = item.id;
        }

        // Add linkURL if available from item itself (Sling Model data only)
        // Otherwise use ID-based matching (most accurate), then title-based
        if (item.linkURL) {
          jsonItem.linkURL = item.linkURL;
        } else if (item.id && jcrLinkUrlMap[item.id]) {
          // Try ID-based matching first (most accurate for duplicate titles)
          jsonItem.linkURL = jcrLinkUrlMap[item.id];
        } else {
          // Use title-based matching (only items WITH linkURLs are in the map)
          const linkURL = jcrLinkUrlMap[String(title)];
          if (linkURL) {
            jsonItem.linkURL = linkURL;
          }
        }

        // Add image URL if it's a teaser with image
        if (isTeaserWithImage) {
          // Get teaser by composite key: item.id + itemKey
          const compositeKey = `${item.id}:${itemKey}`;
          const matchingTeaser = teaserPathMap[compositeKey];
          if (matchingTeaser) {
            // eslint-disable-next-line no-use-before-define
            const imageUrl = buildImageUrl(item, itemKey, matchingTeaser.jcrPath);
            if (imageUrl) {
              jsonItem.imageUrl = imageUrl;

              // Download the image with full URL
              const { fileName } = item.imageResource;
              const fullImageUrl = `${AEM_AUTHOR}${imageUrl}`;
              downloadAndSaveImage(fullImageUrl, fileName, item.id).catch((err) => {
                console.error(`⚠️  Could not download image: ${err.message}`);
              });
            }
          }
        }

        // Add children if they exist - PRESERVE ALL NESTING
        if (hasChildren && contentItems[':items']) {
          const childKeys = Object.keys(contentItems[':items']);
          // Build items from the raw children to preserve all levels
          const childItems = buildJsonItemsFromContainer(contentItems[':items'], currentPath, currentDisplayPath);
          if (childItems.length > 0) {
            jsonItem.items = childItems;
          }
        }

        result.push(jsonItem);
      });
    }

    return result;
  }

  // Helper function to build items from a container, preserving all nesting
  function buildJsonItemsFromContainer(itemsData, parentPath = '', displayPath = '') {
    const result = [];
    const itemsOrder = itemsData[':itemsOrder'] || Object.keys(itemsData);

    itemsOrder.forEach((itemKey) => {
      // Skip internal keys
      if (itemKey.startsWith(':')) {
        return;
      }

      const item = itemsData[itemKey];
      if (!item) return;

      // Get title
      // eslint-disable-next-line no-use-before-define
      const title = extractTitleFromItem(item, itemKey);

      // Skip text-only items and instruction items
      if (!title || title.includes('<p>') || title.includes('<') || itemKey.startsWith('text_')) {
        return;
      }

      const currentDisplayPath = displayPath ? `${displayPath} > ${title.trim()}` : title.trim();
      let currentPath = parentPath;

      if (itemKey !== ':items' && itemKey !== ':itemsOrder') {
        currentPath += `/${itemKey}`;
      }

      // Check for children
      const hasChildren = item[':items'] && Object.keys(item[':items']).length > 0;

      // Determine type
      let itemType = 'item';
      if (!hasChildren) {
        itemType = 'link';
      } else {
        const childKeys = Object.keys(item[':items'] || {});
        const hasTabsChild = childKeys.some((k) => k === 'tabs' || k.match(/^tabs_.*$/));
        const hasAccordionChild = childKeys.some((k) => k === 'accordion' || k.match(/^accordion_.*$/));
        const hasContainerChild = childKeys.some((k) => k === 'container' || k.match(/^container_.*$/));

        if (itemKey.startsWith('accordion')) {
          itemType = 'accordion';
        } else if (itemKey.startsWith('teaser')) {
          itemType = 'teaser';
        } else if (hasTabsChild) {
          itemType = 'tabs';
        } else if (hasAccordionChild) {
          itemType = 'accordion-container';
        } else if (hasContainerChild) {
          itemType = 'container';
        } else {
          itemType = 'dropdown';
        }
      }

      const jsonItem = {
        title,
        path: currentDisplayPath,
        type: itemType,
      };

      // Add ID if it exists
      if (item.id && item.id !== itemKey) {
        jsonItem.id = item.id;
      }

      // Add linkURL if available from item itself (Sling Model data only)
      // Otherwise use ID-based matching (most accurate), then title-based
      if (item.linkURL) {
        jsonItem.linkURL = item.linkURL;
      } else if (item.id && jcrLinkUrlMap[item.id]) {
        // Try ID-based matching first (most accurate for duplicate titles)
        jsonItem.linkURL = jcrLinkUrlMap[item.id];
      } else {
        // Use title-based matching (only items WITH linkURLs are in the map)
        const linkURL = jcrLinkUrlMap[String(title)];
        if (linkURL) {
          jsonItem.linkURL = linkURL;
        }
      }

      // Recursively add children
      if (hasChildren) {
        const childItems = buildJsonItemsFromContainer(item[':items'], currentPath, currentDisplayPath);
        if (childItems.length > 0) {
          jsonItem.items = childItems;
        }
      }

      result.push(jsonItem);
    });

    return result;
  }

  return buildJsonItems(jsonData);
}

// Global helper functions for both display and JSON generation

// Function to get title with fallback chain: cq:panelTitle || title || id
function getTitle(item, itemId) {
  return item['cq:panelTitle'] || item.title || itemId;
}

// Function to build image URL from teaser component
function buildImageUrl(item, itemKey, jcrPath) {
  if (!item.imageResource || !item.imageResource.fileName || !item.imageResource['jcr:lastModified']) {
    return null;
  }

  const { fileName } = item.imageResource;
  const lastModified = item.imageResource['jcr:lastModified'];

  // Extract file extension from the image filename
  const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
  const imageFormat = `coreimg.85.1600.${fileExtension}`;

  // Build the complete image URL with dynamic format, prepend item.id to fileName
  const fileNameWithId = buildFileNameWithId(item.id, fileName);
  return `${BASE_URL}${jcrPath}/${itemKey}.${imageFormat}/${lastModified}/${fileNameWithId}`;
}

// Function to build image URL for teaser items during hierarchy extraction
function buildTeaserImageUrl(item, key, currentKeyPath, contentPath) {
  if (!item.imageResource || !item.imageResource.fileName) {
    return null;
  }

  const { fileName } = item.imageResource;
  const lastModified = item.imageResource['jcr:lastModified'] || new Date().toISOString();

  // Extract file extension from the image filename
  const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
  const imageFormat = `coreimg.85.1600.${fileExtension}`;

  // Build the teaser image URL
  // URL format: {AEM_AUTHOR}{CONTENT_PATH}{currentKeyPath}/{key}.{imageFormat}/{lastModified}/{fileName}
  return `${AEM_AUTHOR}${contentPath}/${currentKeyPath}/${key}.${imageFormat}/${lastModified}/${fileName}`;
}

// Function to check if item is a teaser with image
function isTeaser(item, itemKey) {
  return itemKey.startsWith('teaser_')
           && item
           && typeof item === 'object'
           && item.title;
}

// Function to skip structural containers and get content items
function getContentItems(items) {
  if (!items || !items[':items']) return null;

  const children = items[':items'];
  const childKeys = Object.keys(children);

  // If only one child and it's a structural container, drill down
  if (childKeys.length === 1) {
    const onlyChild = children[childKeys[0]];
    const childKey = childKeys[0];

    // Skip structural containers and accordions
    if (childKey === 'tabs' || childKey.match(/^tabs_.*$/)
        || childKey === 'container' || childKey.match(/^container.*$/)
        || childKey === 'accordion' || childKey.match(/^accordion.*$/)) {
      return getContentItems(onlyChild);
    }
  }

  return items;
}

// Function to extract meaningful titles from accordion/wrapper structures
function extractTitleFromItem(item, itemKey) {
  // If item has .text property, use it (best source for actual content)
  if (item.text && typeof item.text === 'string') {
    const textContent = item.text.trim();
    // Skip if it's HTML markup or instruction text
    if (textContent && textContent.length > 0
        && !textContent.includes('<p>')
        && !textContent.toLowerCase().includes('bold and underlined')) {
      return textContent;
    }
  }

  // If item itself has a title, return it
  const directTitle = item['cq:panelTitle'] || item.title;
  if (directTitle && directTitle.trim()) {
    return directTitle.trim();
  }

  // If this is a structural wrapper (accordion/container with single child), dig deeper
  if (item[':items']) {
    const childKeys = Object.keys(item[':items']);
    if (childKeys.length === 1) {
      const onlyChildKey = childKeys[0];
      const onlyChild = item[':items'][onlyChildKey];

      // If child has a good title, return it
      if (onlyChild) {
        const childTitle = onlyChild['cq:panelTitle'] || onlyChild.title;
        if (childTitle && childTitle.trim()) {
          return childTitle.trim();
        }
        // Recursively try to extract from deeper levels
        return extractTitleFromItem(onlyChild, onlyChildKey);
      }
    }
  }

  // Fallback to key name
  return itemKey;
}

// Helper function to determine item type from sling:resourceType
function getItemTypeFromResourceType(item, itemKey = '') {
  const resourceType = item['sling:resourceType'] || '';

  // Map resource type to item type
  if (resourceType.includes('tabs')) {
    return 'tabs';
  }
  if (resourceType.includes('accordion')) {
    return 'accordion';
  }
  if (resourceType.includes('container')) {
    return 'container';
  }
  if (resourceType.includes('button')) {
    return 'button';
  }
  if (resourceType.includes('text')) {
    return 'text';
  }
  if (resourceType.includes('image')) {
    return 'image';
  }

  // Fallback to checking key patterns
  if (itemKey.startsWith('accordion')) {
    return 'accordion';
  }
  if (itemKey.startsWith('teaser')) {
    return 'teaser';
  }
  if (itemKey.startsWith('button')) {
    return 'button';
  }

  return 'item';
}

function parseHierarchyFromModel(modelData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrData, jcrPathMap, jcrTeaserImageMap) {
  console.log('📖 Parsing hierarchy from combined-tabs.model.json...\n');

  // Function to recursively extract hierarchy from :items
  function extractItemsHierarchy(itemsObj, parentKeyPath = '', displayPath = '', jcrPathMap = {}, jcrTeaserImageMap = {}) {
    if (!itemsObj || typeof itemsObj !== 'object') {
      return [];
    }

    const result = [];
    const itemsOrder = itemsObj[':itemsOrder'] || Object.keys(itemsObj).filter((k) => !k.startsWith(':'));

    itemsOrder.forEach((key) => {
      if (key.startsWith(':')) {
        return;
      }

      const item = itemsObj[key];
      if (!item || typeof item !== 'object') {
        return;
      }

      let title = item['cq:panelTitle'] || item.title || item['jcr:title'] || item.text;

      // Skip tabs/tabs_copy components without a custom title - they're just structural
      if (!title && (key === 'tabs' || key.startsWith('tabs_'))) {
        // But still recurse into their nested items, including the structural component in the path
        if (item[':items']) {
          const structuralKeyPath = `${parentKeyPath}/${key}`;
          const childrenItems = extractItemsHierarchy(item[':items'], structuralKeyPath, displayPath, jcrPathMap, jcrTeaserImageMap);
          if (childrenItems.length > 0) {
            result.push(...childrenItems);
          }
        }
        return;
      }

      if (!title) {
        title = key;
      }

      if (!title || String(title).includes('<')) {
        return;
      }

      // Don't trim - preserve exact spacing from source data
      title = String(title);

      let itemType = 'item';
      const resourceType = item['sling:resourceType'] || '';

      if (resourceType.includes('tabs')) {
        itemType = 'tabs';
      } else if (resourceType.includes('accordion')) {
        itemType = 'accordion';
      } else if (resourceType.includes('container')) {
        itemType = 'container';
      } else if (key.startsWith('teaser_')) {
        itemType = 'teaser';
      }

      // Fallback: infer type from ID pattern if sling:resourceType is missing
      if (itemType === 'item' && item.id) {
        const idPrefix = item.id.split('-')[0];
        if (idPrefix === 'button') itemType = 'button';
        else if (idPrefix === 'accordion') itemType = 'accordion';
        else if (idPrefix === 'tabs') itemType = 'tabs';
        else if (idPrefix === 'container') itemType = 'container';
      }

      // Build display path only for output (for user viewing)
      const currentDisplayPath = displayPath ? `${displayPath} > ${title}` : title;
      // Build JCR key path for logic (context matching, hierarchy tracking)
      // Make sure it matches the format used in extractTimestampsFromModel
      const currentKeyPath = `${parentKeyPath}/${key}`;

      const hierarchyItem = {
        title,
        path: currentDisplayPath,
        type: itemType,
      };

      if (item.id) {
        hierarchyItem.id = item.id;
      }

      // Preserve JCR section information if available
      if (item.__jcrSection) {
        hierarchyItem.__jcrSection = item.__jcrSection;
      }

      // Use context-aware matching based on JCR key path
      // Extract the immediate parent key (e.g., "/Half Time/container" -> "container")
      const keyPathParts = currentKeyPath.split('/').filter((p) => p);
      const immediateParentKey = keyPathParts.length > 1 ? keyPathParts[keyPathParts.length - 2] : keyPathParts[0];
      const contextKey = `${String(title)}|${immediateParentKey}`;

      // Look up linkURL using JCR context only - no fallback to title-only
      const linkURL = jcrLinkUrlMap[contextKey];
      if (linkURL) {
        hierarchyItem.linkURL = linkURL;
      }

      // Look up text content using JCR context only
      const textContent = jcrTextMap[contextKey];
      if (textContent) {
        hierarchyItem.text = textContent;
      } else {
        // Fallback: check if text was stored by key (for text components without titles)
        const textByKey = jcrTextMap[key];
        if (textByKey) {
          hierarchyItem.text = textByKey;
        } else {
          // Also try the key with parent context
          const keyContextKey = `${key}|${immediateParentKey}`;
          const textByKeyContext = jcrTextMap[keyContextKey];
          if (textByKeyContext) {
            hierarchyItem.text = textByKeyContext;
          } else if ((itemType === 'container' || key.startsWith('container')) && (key.startsWith('container') || key === 'container')) {
            // Last fallback: for structural containers, check if this key has orphaned text children
            // e.g., "text_copy_copy_copy__1538611243|container_copy_copy_" when looking for "container_copy_copy_"
            const childrenTextKey = Object.keys(jcrTextMap).find((k) => k.endsWith(`|${key}`));
            if (childrenTextKey) {
              hierarchyItem.text = jcrTextMap[childrenTextKey];
            }
          }
        }
      }

      // Generate imageUrl for teaser items
      if (itemType === 'teaser') {
        let imageUrl = null;

        // Check if we have image info from model (only teasers with valid imageResource)
        let teaserImageInfo = null;

        // Find JCR entry that has this model path stored
        for (const [jcrPath, jcrData] of Object.entries(jcrTeaserImageMap)) {
          if (jcrData.modelPath === currentKeyPath && jcrData.hasImageResource) {
            teaserImageInfo = jcrData;
            break;
          }
        }

        if (teaserImageInfo && teaserImageInfo.fileName) {
          const { fileName } = teaserImageInfo;
          const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
          const imageFormat = `coreimg.85.1600.${fileExtension}`;
          const { lastModified } = teaserImageInfo;

          // Build full JCR path
          const jcrPath = `${CONTENT_PATH}/_jcr_content/root${teaserImageInfo.jcrPath}`;

          // Build filename with item ID for uniqueness
          let finalFileName = fileName;
          if (item.id) {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            finalFileName = `${item.id}-${nameWithoutExt}${ext}`;
          }

          imageUrl = `${jcrPath}.${imageFormat}/${lastModified}/${finalFileName}`;
        }

        if (imageUrl) {
          hierarchyItem.imageUrl = imageUrl;
        }
      }

      if (item[':items']) {
        const childrenItems = extractItemsHierarchy(item[':items'], currentKeyPath, currentDisplayPath, jcrPathMap, jcrTeaserImageMap);
        if (childrenItems.length > 0) {
          hierarchyItem.items = childrenItems;
        }
      }

      result.push(hierarchyItem);
    });

    return result;
  }

  // Extract from root :items
  let mainHierarchy = [];
  if (modelData[':items']) {
    const rawHierarchy = extractItemsHierarchy(modelData[':items'], '', '', jcrPathMap, jcrTeaserImageMap);

    // Add tabs index tracking to top-level items based on unique keys
    rawHierarchy.forEach((item) => {
      // Extract tabs index from unique key (e.g., "item_1__tabs0" => 0)
      // Find the first child with an id to check its structure
      function findTabsIndexFromItem(obj) {
        if (!obj) return null;
        // Look for properties that indicate which tabs this came from
        if (obj.id && obj.id.includes('__tabs')) {
          const match = obj.id.match(/__tabs(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        // Check children
        if (obj.items && Array.isArray(obj.items)) {
          for (const child of obj.items) {
            const idx = findTabsIndexFromItem(child);
            if (idx !== null) return idx;
          }
        }
        return null;
      }

      const tabsIndex = findTabsIndexFromItem(item);
      if (tabsIndex !== null) {
        item.__tabsIndex = tabsIndex;
      }
    });

    // Function to unwrap structural containers that don't add semantic value
    function unwrapStructuralContainers(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        // If this is a container/item with a single child that's also a container/item, unwrap it
        if (item.items && item.items.length === 1) {
          const child = item.items[0];

          // Only unwrap if:
          // 1. Child is a generic structural container (name-like "container_*", "container", etc.)
          // 2. AND child is NOT a semantic element like "tabs" or "accordion"
          if ((child.type === 'item' || child.type === 'container')
              && (child.title.startsWith('container') || child.title === 'container')
              && child.type !== 'tabs' && child.type !== 'accordion') {
            // Skip the wrapper and promote grandchildren directly to this level
            if (child.items && child.items.length > 0) {
              return {
                ...item,
                items: unwrapStructuralContainers(child.items),
              };
            }
          }
        }

        // Recursively process children
        if (item.items) {
          item.items = unwrapStructuralContainers(item.items);
        }

        return item;
      });
    }

    const cleanedHierarchy = unwrapStructuralContainers(rawHierarchy);
    mainHierarchy = groupHierarchyBySections(cleanedHierarchy, jcrData);
  }

  // Function to extract sections from JCR structure
  function extractSectionsFromJCR(jcrData) {
    const sections = [];

    if (!jcrData.root || !jcrData.root.container) {
      return null;
    }

    // Recursively search for title components and the containers that follow them
    function searchForTitles(obj, parentPath = '') {
      const foundSections = [];
      const itemsList = [];

      // First pass: collect all direct children in order
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object' && !key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
          itemsList.push({ key, item: obj[key] });
        }
      }

      // Second pass: identify title markers and group subsequent containers
      let currentSection = null;
      itemsList.forEach((entry, index) => {
        const { key, item } = entry;

        // Check if this is a title component (section marker)
        if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
          // Save previous section if exists
          if (currentSection) {
            foundSections.push(currentSection);
          }
          // Start new section
          currentSection = {
            title: item['jcr:title'],
            containerKeys: [],
          };
        } else if (currentSection && (item['sling:resourceType'] === 'tccc-dam/components/container' || item['sling:resourceType'] === 'tccc-dam/components/tabs')) {
          // This container/tabs belongs to the current section
          currentSection.containerKeys.push(key);
        }

        // Recursively search nested items inside containers
        if (item && typeof item === 'object' && item['sling:resourceType'] === 'tccc-dam/components/container') {
          foundSections.push(...searchForTitles(item, `${parentPath}/${key}`));
        }
      });

      if (currentSection) {
        foundSections.push(currentSection);
      }

      return foundSections;
    }

    const foundSections = searchForTitles(jcrData.root.container);

    // Remove duplicates (keep first occurrence of each title)
    const uniqueSections = [];
    const seenTitles = new Set();
    foundSections.forEach((section) => {
      if (!seenTitles.has(section.title)) {
        uniqueSections.push(section);
        seenTitles.add(section.title);
      }
    });

    return uniqueSections.length > 0 ? uniqueSections : null;
  }

  // Function to group items into sections - try JCR-based grouping first, then fallback
  function groupHierarchyBySections(items, jcrData) {
    // Try to extract sections from JCR structure
    let jcrSections = null;
    if (jcrData) {
      jcrSections = extractSectionsFromJCR(jcrData);
      if (jcrSections) {
        console.log('\n🔍 JCR sections detected:', jcrSections.map((s) => s.title).join(', '));
      } else {
        console.log('\n🔍 No JCR sections detected in structure');
      }
    }

    if (jcrSections) {
      const result = groupByJCRSections(items, jcrSections);
      // Only use JCR grouping if it actually produced results
      if (result.length > 0 && result.some((s) => s.items.length > 0)) {
        return result;
      }
    }

    // Fallback: group by first-level path component
    return groupByFirstPathComponent(items);
  }

  // Group items using JCR section structure
  function groupByJCRSections(items, jcrSections) {
    const grouped = [];

    console.log('\n📋 Grouping by JCR section metadata:');

    jcrSections.forEach((section) => {
      // Find all items that belong to this section based on __jcrSection metadata
      const itemsInSection = items.filter((item) => item.__jcrSection === section.title);

      if (itemsInSection.length > 0) {
        const sectionObj = {
          title: section.title,
          path: section.title,
          type: 'section',
          items: itemsInSection.map((item) => {
            const updatedItem = { ...item };
            // Remove the internal metadata before output
            delete updatedItem.__jcrSection;

            if (!item.path.startsWith(section.title)) {
              updatedItem.path = `${section.title} > ${item.path}`;
            }
            if (item.items && Array.isArray(item.items)) {
              updatedItem.items = item.items.map((child) => {
                const childCopy = { ...child };
                const parentTitle = item.title;
                if (childCopy.path && childCopy.path.startsWith(`${parentTitle} >`)) {
                  const pathWithoutParentTitle = childCopy.path.substring(`${parentTitle} > `.length);
                  childCopy.path = `${updatedItem.path} > ${pathWithoutParentTitle}`;
                } else if (!childCopy.path.startsWith(updatedItem.path)) {
                  childCopy.path = `${updatedItem.path} > ${childCopy.path}`;
                }
                if (childCopy.items && Array.isArray(childCopy.items)) {
                  childCopy.items = childCopy.items.map((subchild) => prependPathToItem(subchild, childCopy.path));
                }
                return childCopy;
              });
            }
            return updatedItem;
          }),
        };
        grouped.push(sectionObj);
      }
    });

    console.log(`  - ${grouped.map((s) => `${s.title} (${s.items.length})`).join(', ')}\n`);

    return grouped;
  }

  // Helper function to prepend parent path to items recursively
  function prependPathToItem(item, parentPath) {
    const updatedItem = { ...item };

    if (!item.path.startsWith(parentPath)) {
      updatedItem.path = `${parentPath} > ${item.path}`;
    }

    if (item.items && Array.isArray(item.items)) {
      updatedItem.items = item.items.map((child) => {
        const childCopy = { ...child };
        const parentTitle = item.title;
        if (childCopy.path && childCopy.path.startsWith(`${parentTitle} >`)) {
          const pathWithoutParentTitle = childCopy.path.substring(`${parentTitle} > `.length);
          childCopy.path = `${updatedItem.path} > ${pathWithoutParentTitle}`;
        } else if (!childCopy.path.startsWith(updatedItem.path)) {
          childCopy.path = `${updatedItem.path} > ${childCopy.path}`;
        }
        if (childCopy.items && Array.isArray(childCopy.items)) {
          childCopy.items = childCopy.items.map((subchild) => prependPathToItem(subchild, childCopy.path));
        }
        return childCopy;
      });
    }

    return updatedItem;
  }

  // Fallback: group items by first-level path component (data-driven auto-detection)
  function groupByFirstPathComponent(items) {
    const sectionMap = new Map();

    items.forEach((item) => {
      let sectionKey = null;
      let sectionTitle = null;

      if (item.path) {
        const pathParts = item.path.split(' > ');
        if (pathParts.length > 1) {
          sectionKey = pathParts[0];
          sectionTitle = pathParts[0];
        } else {
          sectionKey = item.title;
          sectionTitle = item.title;
        }
      } else {
        sectionKey = item.title;
        sectionTitle = item.title;
      }

      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, {
          title: sectionTitle,
          items: [],
        });
      }

      sectionMap.get(sectionKey).items.push(item);
    });

    const grouped = Array.from(sectionMap.values()).map((section) => ({
      title: section.title,
      path: section.title,
      type: 'section',
      items: section.items,
    }));

    console.log('\n📋 Auto-detected sections (data-driven from path):');
    grouped.forEach((section) => {
      console.log(`  - ${section.title} (${section.items.length} items)`);
    });
    console.log();

    return grouped.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (!item.path.startsWith(section.title)) {
          return prependPathToItem(item, section.title);
        }
        return item;
      }),
    }));
  }

  // Extract banner image from JCR
  function extractBannerImage(jcrData, contentPath) {
    function findImageComponents(obj, path = '') {
      const results = [];

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}/${key}` : key;

        if (typeof value === 'object' && value !== null) {
          // Check if this is an image component with fileName
          if (value['sling:resourceType'] === 'tccc-dam/components/image' && value.fileName) {
            const lastModified = value['jcr:lastModified'] || value.file?.['jcr:lastModified'] || value.file?.['jcr:created'];
            const timestamp = lastModified ? new Date(lastModified).getTime() : null;

            if (timestamp) {
              // Fix path construction: ensure /root is included
              const jcrPath = currentPath.replace(/^root/, '_jcr_content/root');

              // Use correct image format for banner images (coreimg.png instead of coreimg.85.1600.png)
              const imageFormat = 'coreimg.png';

              // Sanitize filename using utility function
              const sanitizedFileName = sanitizeFileName(value.fileName);

              const imageUrl = `${contentPath}/${jcrPath}.${imageFormat}/${timestamp}/${sanitizedFileName}`;

              results.push({
                path: currentPath,
                fileName: value.fileName,
                imageUrl,
                alt: value.alt,
                resourceType: value['sling:resourceType'],
                lastModified,
                timestamp,
              });
            }
          }

          // Recurse into nested objects
          results.push(...findImageComponents(value, currentPath));
        }
      }

      return results;
    }

    return findImageComponents(jcrData);
  }

  // Find banner images
  const bannerImages = extractBannerImage(jcrData, CONTENT_PATH);

  // Save to file
  const jsonOutputPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  const hierarchyStructure = {
    items: mainHierarchy,
  };

  // Add banner images to root level if any found
  if (bannerImages.length > 0) {
    hierarchyStructure.bannerImages = bannerImages;
    console.log(`🖼️  Found ${bannerImages.length} banner image(s):`);
    bannerImages.forEach((img, index) => {
      console.log(`   ${index + 1}. ${img.fileName} (${img.alt || 'No alt text'})`);
    });
  }

  fs.writeFileSync(jsonOutputPath, JSON.stringify(hierarchyStructure, null, 2));
  console.log('✅ Hierarchy extracted successfully!');
  console.log(`💾 JSON structure saved to: ${jsonOutputPath}`);

  console.log('\n📋 OUTPUTS SAVED');
  console.log('===============');
  console.log(`📋 JSON structure: ${jsonOutputPath}`);

  // Display summary
  function countItems(items) {
    let count = items.length;
    items.forEach((item) => {
      if (item.items) {
        count += countItems(item.items);
      }
    });
    return count;
  }

  const totalItems = countItems(mainHierarchy);
  console.log('\n📊 Hierarchy Summary:');
  console.log(`  Total items (including nested): ${totalItems}`);
  console.log(`  Root level items: ${mainHierarchy.length}`);
  if (mainHierarchy.length > 0) {
    console.log(`  First item: "${mainHierarchy[0].title}" (${mainHierarchy[0].type})`);
  }
}

// Find all tabs paths in JCR recursively
function findAllTabsPaths(node, currentPath = '', found = []) {
  if (!node || typeof node !== 'object') {
    return found;
  }

  const keys = Object.keys(node);

  keys.forEach((key) => {
    const item = node[key];
    if (!item || typeof item !== 'object') {
      return;
    }

    const resourceType = item['sling:resourceType'] || '';
    const newPath = currentPath ? `${currentPath}/${key}` : key;

    // Found a tabs component
    if (resourceType.includes('tabs')) {
      const fullPath = `/jcr:content/${newPath}`;
      found.push(fullPath);
    }

    // Keep searching
    findAllTabsPaths(item, newPath, found);
  });

  return found;
}

// Function to download all imageUrls
async function downloadAllImages(hierarchyData, outputDir) {
  const fs = require('fs');
  const path = require('path');
  const https = require('https');

  // Extract all imageUrls from hierarchy
  function extractImageUrls(obj) {
    const urls = [];
    function traverse(item) {
      if (item.imageUrl) {
        urls.push(item.imageUrl);
      }
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((i) => traverse(i));
      }
    }
    if (Array.isArray(obj)) {
      obj.forEach((item) => traverse(item));
    }
    return urls;
  }

  const imageUrls = extractImageUrls(hierarchyData);
  console.log(`\n🖼️  Found ${imageUrls.length} images to download`);

  // Create images directory
  const imagesDir = path.join(outputDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let downloaded = 0;
  let failed = 0;
  const failedUrls = []; // Track failed URLs for final report

  // Download function
  function downloadImage(imageUrl, index) {
    return new Promise((resolve) => {
      // Prepend AEM_AUTHOR to the imageUrl
      const fullUrl = AEM_AUTHOR + imageUrl;

      // Extract filename from URL
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const safeFilename = sanitizeFileName(filename);
      const filePath = path.join(imagesDir, safeFilename);

      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${safeFilename} (already exists)`);
        downloaded++;
        resolve();
        return;
      }

      const file = fs.createWriteStream(filePath);

      const request = https.get(fullUrl, {
        headers: {
          Cookie: AUTH_COOKIE,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }, (response) => {
        // Clear timeout since we got a response
        request.setTimeout(0);

        // Handle redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
          file.close();
          fs.unlinkSync(filePath); // Delete empty file

          let redirectUrl = response.headers.location;

          // If redirect URL is relative, make it absolute
          if (!redirectUrl.startsWith('http')) {
            const urlObj = new URL(fullUrl);
            redirectUrl = `https://${urlObj.hostname}${redirectUrl}`;
          }

          console.log(`🔄 Following redirect: ${fullUrl} -> ${redirectUrl}`);

          // Follow the redirect
          const redirectRequest = https.get(redirectUrl, {
            headers: {
              Cookie: AUTH_COOKIE,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          }, (redirectResponse) => {
            if (redirectResponse.statusCode === 200) {
              const redirectFile = fs.createWriteStream(filePath);
              redirectResponse.pipe(redirectFile);
              redirectFile.on('finish', () => {
                redirectFile.close();
                downloaded++;
                console.log(`✅ Downloaded ${redirectUrl} -> ${safeFilename}`);
                resolve();
              });
            } else {
              failed++;
              failedUrls.push({ url: redirectUrl, reason: `HTTP ${redirectResponse.statusCode} (after redirect)`, filename: safeFilename });
              console.log(`❌ Failed redirect ${redirectUrl} (HTTP ${redirectResponse.statusCode})`);
              resolve();
            }
          }).on('error', (err) => {
            failed++;
            failedUrls.push({ url: redirectUrl, reason: `Network error on redirect: ${err.message}`, filename: safeFilename });
            console.log(`❌ Network error on redirect ${redirectUrl}: ${err.message}`);
            resolve();
          });

          // Set timeout for redirect request
          redirectRequest.setTimeout(30000, () => {
            redirectRequest.destroy();
            failed++;
            failedUrls.push({ url: redirectUrl, reason: 'Timeout on redirect (server not responding)', filename: safeFilename });
            console.log(`❌ Timeout on redirect ${redirectUrl} (server not responding)`);
            resolve();
          });
        } else if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            downloaded++;
            console.log(`✅ Downloaded ${fullUrl} -> ${safeFilename}`);
            resolve();
          });
        } else {
          // Handle other non-200 status codes (404, 403, etc.)
          file.close();
          fs.unlinkSync(filePath); // Delete empty file
          failed++;
          failedUrls.push({ url: fullUrl, reason: `HTTP ${response.statusCode}`, filename: safeFilename });
          console.log(`❌ Failed ${fullUrl} (HTTP ${response.statusCode})`);
          resolve();
        }
      }).on('error', (err) => {
        // Clear timeout since we got an error response
        request.setTimeout(0);

        // Handle network errors (connection refused, DNS errors, etc.)
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Delete empty file
        }
        failed++;
        failedUrls.push({ url: fullUrl, reason: `Network error: ${err.message}`, filename: safeFilename });
        console.log(`❌ Network error ${fullUrl}: ${err.message}`);
        resolve();
      });

      // Set timeout for network issues (server not responding)
      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        failed++;
        failedUrls.push({ url: fullUrl, reason: 'Timeout (server not responding)', filename: safeFilename });
        console.log(`❌ Timeout ${fullUrl} (server not responding)`);
        resolve();
      });
    });
  }

  // Download all images in parallel for maximum speed
  console.log('🚀 Starting parallel downloads...');

  // Create all download promises
  const downloadPromises = imageUrls.map((url, index) => downloadImage(url, index + 1));

  // Wait for all downloads to complete
  await Promise.all(downloadPromises);

  console.log('✅ All parallel downloads completed!');

  console.log('\n🎉 Download complete!');
  console.log(`   ✅ Successfully downloaded: ${downloaded}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Images saved to: ${imagesDir}`);

  // Log all failed URLs
  if (failedUrls.length > 0) {
    console.log('\n❌ FAILED DOWNLOADS:');
    console.log('==================');
    failedUrls.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.url}`);
      console.log(`   Reason: ${failure.reason}`);
      console.log(`   File: ${failure.filename}`);
      console.log('');
    });
  }
}

// Run the main function
main().then(async () => {
  // After successful extraction, download all images
  const fs = require('fs');
  const path = require('path');
  const hierarchyPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  if (fs.existsSync(hierarchyPath)) {
    const hierarchyStructure = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
    const hierarchyData = hierarchyStructure.items || [];
    const bannerImages = hierarchyStructure.bannerImages || [];

    // Combine teaser images and banner images for download
    const allImagesToDownload = [...hierarchyData];

    // Add banner images to the download list (they already have imageUrl property)
    if (bannerImages.length > 0) {
      console.log(`\n🖼️  Found ${bannerImages.length} banner image(s) to download`);
      allImagesToDownload.push(...bannerImages);
    }

    // Download all images (teasers + banners) using the existing function
    await downloadAllImages(allImagesToDownload, OUTPUT_DIR);
  }

  // Force clean exit
  process.exit(0);
}).catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
});
