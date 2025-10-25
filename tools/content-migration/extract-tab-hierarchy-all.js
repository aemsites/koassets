#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { sanitizeFileName, buildFileNameWithId } = require('./sanitize-utils.js');

const AEM_AUTHOR = 'https://author-p64403-e544653.adobeaemcloud.com';
let CONTENT_PATH = '/content/share/us/en/all-content-stores';
// let CONTENT_PATH = '/content/share/us/en/all-content-stores/global-coca-cola-uplift';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

// Load AUTH_COOKIE from config file
let AUTH_COOKIE;
try {
  const authConfig = fs.readFileSync(path.join(__dirname, 'auth.config'), 'utf8').trim();
  const [, cookieValue] = authConfig.match(/AUTH_COOKIE=(.*)/);
  AUTH_COOKIE = cookieValue;
  if (!AUTH_COOKIE) {
    throw new Error('AUTH_COOKIE not found in auth.config');
  }
} catch (error) {
  console.error(`❌ Error loading AUTH_COOKIE from auth.config: ${error.message}`);
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

    // Download all tabs as models and combine
    const allTabsData = [];
    for (let i = 0; i < tabsPaths.length; i++) {
      const tabsUrl = `${AEM_AUTHOR}${CONTENT_PATH}${tabsPaths[i]}.model.json`;
      console.log(`\n📥 Downloading tabs ${i + 1}/${tabsPaths.length}: ${tabsUrl}`);
      try {
        const tabsContent = await downloadFile(tabsUrl, null); // Pass null for intermediate files
        allTabsData.push(JSON.parse(tabsContent));
      } catch (err) {
        console.log(`  ⚠️  Failed to download this tabs: ${err.message}`);
      }
    }

    if (allTabsData.length === 0) {
      throw new Error('Could not download any tabs data');
    }

    console.log(`\n✅ Downloaded ${allTabsData.length} tabs model(s)`);

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
        combinedTabsData[':items'][uniqueKey] = items[key];
      });
    });

    console.log(`📌 Combined all tabs into ${combinedTabsData[':itemsOrder'].length} items\n`);
    const mainTabsData = combinedTabsData;

    // Create a map of all titles to their sling:resourceType from JCR
    const jcrTitleMap = {};
    const jcrLinkUrlMap = {}; // Map of (title|parentKey) -> linkURL
    const jcrTextMap = {}; // Map of (title|parentKey) -> text content
    const jcrButtonsWithoutLinkUrl = {}; // Track buttons that DON'T have linkURL
    function indexJCRByTitle(obj, parentPath = '', parentKey = '') {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
        if (!key.startsWith(':') && typeof obj[key] === 'object') {
          const rt = obj[key]['sling:resourceType'];
          const title = obj[key]['cq:panelTitle'] || obj[key]['jcr:title'] || obj[key].title;
          const { linkURL } = obj[key];

          if (title && rt) {
            jcrTitleMap[String(title).trim()] = rt;
          }

          // Capture linkURL for button items
          if (title && rt && rt.includes('button')) {
            const titleKey = String(title).trim();
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
            const titleKey = String(title).trim();
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
          if (title && jcrTitleMap[String(title).trim()]) {
            items[key]['sling:resourceType'] = jcrTitleMap[String(title).trim()];
          }
          if (items[key][':items']) enrichByTitle(items[key][':items']);
        }
      }
    }
    enrichByTitle(mainTabsData[':items']);

    // Continue with parsing
    // eslint-disable-next-line no-use-before-define
    parseHierarchyFromModel(mainTabsData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap);
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
          const linkURL = jcrLinkUrlMap[String(title).trim()];
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
        const linkURL = jcrLinkUrlMap[String(title).trim()];
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

function parseHierarchyFromModel(modelData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap) {
  console.log('📖 Parsing hierarchy from combined-tabs.model.json...\n');

  // Function to recursively extract hierarchy from :items
  function extractItemsHierarchy(itemsObj, parentKeyPath = '', displayPath = '') {
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

      let title = item['cq:panelTitle'] || item.title || item['jcr:title'] || item.text || key;

      if (!title || String(title).includes('<')) {
        return;
      }

      title = String(title).trim();

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
      const currentKeyPath = parentKeyPath ? `${parentKeyPath}/${key}` : key;

      const hierarchyItem = {
        title,
        path: currentDisplayPath,
        type: itemType,
      };

      if (item.id) {
        hierarchyItem.id = item.id;
      }

      // Use context-aware matching based on JCR key path
      // Extract the immediate parent key (e.g., "/Half Time/container" -> "container")
      const keyPathParts = currentKeyPath.split('/').filter((p) => p);
      const immediateParentKey = keyPathParts.length > 1 ? keyPathParts[keyPathParts.length - 2] : keyPathParts[0];
      const contextKey = `${String(title).trim()}|${immediateParentKey}`;

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

      if (item[':items']) {
        const childrenItems = extractItemsHierarchy(item[':items'], currentKeyPath, currentDisplayPath);
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
    const rawHierarchy = extractItemsHierarchy(modelData[':items']);

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
    mainHierarchy = groupHierarchyBySections(cleanedHierarchy);
  }

  // Function to group items into sections
  function groupHierarchyBySections(items) {
    const grouped = [];

    // Define section mappings based on item titles and preferred tabs index
    // tabsIndex helps when multiple tabs have items with the same title
    const sections = {
      'Toolkits & Internal Documents': { titles: ['Uplift Platform', 'Half Time', 'Be In The Moment'], preferredTabs: 0 },
      Assets: { titles: ['VIS & Design', 'Static Content', 'Audiovisual', 'Transition Bundles'], preferredTabs: 1 },
      'Local Adaptations': { titles: ['Half Time', 'Be In The Moment'], preferredTabs: 4 }, // Prefer tabs 4 (has market items)
    };

    console.log('\n📋 Available top-level items:');
    items.forEach((item) => console.log(`  - ${item.title}`));
    console.log();

    // Function to prepend parent path to all items recursively
    function prependPathToItem(item, parentPath) {
      const updatedItem = { ...item };

      // For level 2 items, prepend the section path if not already present
      if (!item.path.startsWith(parentPath)) {
        updatedItem.path = `${parentPath} > ${item.path}`;
      }

      // Recursively update children
      if (item.items && Array.isArray(item.items)) {
        updatedItem.items = item.items.map((child) => {
          const childCopy = { ...child };

          // For children, we need to avoid duplicating the immediate parent title
          // The child path might start with the parent item's title (e.g., "Half Time > container > ...")
          // We want to prepend the full parent path but avoid duplication
          const parentTitle = item.title;
          if (childCopy.path && childCopy.path.startsWith(`${parentTitle} >`)) {
            // Remove the parent title from the beginning since we're adding the full parent path
            const pathWithoutParentTitle = childCopy.path.substring(`${parentTitle} > `.length);
            childCopy.path = `${updatedItem.path} > ${pathWithoutParentTitle}`;
          } else if (!childCopy.path.startsWith(updatedItem.path)) {
            // Standard prepend if not already present
            childCopy.path = `${updatedItem.path} > ${childCopy.path}`;
          }

          // Recursively process grandchildren with the updated child path
          if (childCopy.items && Array.isArray(childCopy.items)) {
            childCopy.items = childCopy.items.map((subchild) => prependPathToItem(subchild, childCopy.path));
          }

          return childCopy;
        });
      }

      return updatedItem;
    }

    // Create section groups
    for (const [sectionTitle, sectionConfig] of Object.entries(sections)) {
      const itemsInSection = [];

      sectionConfig.titles.forEach((itemTitle) => {
        // Special handling for "Local Adaptations" - prefer items with market/region children
        if (sectionTitle === 'Local Adaptations') {
          // Look for items with market names like "INSWA", "Japan", "Market TBD", etc.
          let matchingItem = items.find((item) => {
            if (item.title !== itemTitle) return false;
            // Check if this item has children with market/region names
            if (item.items && item.items.length > 0) {
              const childTitles = item.items.map((c) => c.title).join(' ');
              const hasMarkets = /INSWA|Japan|Saudi|Korea|Vietnam|Market TBD/.test(childTitles);
              return hasMarkets;
            }
            return false;
          });

          // If not found with market indicators, accept any matching title
          if (!matchingItem) {
            matchingItem = items.find((item) => item.title === itemTitle);
          }

          if (matchingItem) {
            // Prepend section title to the item's path and all children
            const updatedItem = prependPathToItem(matchingItem, sectionTitle);
            itemsInSection.push(updatedItem);
          }
        } else {
          // For other sections, use tabs index preference
          let matchingItem = items.find((item) => {
            const titleMatches = item.title === itemTitle;
            if (!titleMatches) return false;
            // Check if this item is from the preferred tabs
            const tabsMatch = item.__tabsIndex === sectionConfig.preferredTabs;
            return tabsMatch;
          });

          // If not found with preferred tabs, accept any matching title
          if (!matchingItem) {
            matchingItem = items.find((item) => item.title === itemTitle);
          }

          if (matchingItem) {
            // Prepend section title to the item's path and all children
            const updatedItem = prependPathToItem(matchingItem, sectionTitle);
            itemsInSection.push(updatedItem);
          }
        }
      });

      if (itemsInSection.length > 0) {
        grouped.push({
          title: sectionTitle,
          path: sectionTitle,
          type: 'section',
          items: itemsInSection,
        });
      }
    }

    return grouped;
  }

  // Save to file
  const jsonOutputPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(mainHierarchy, null, 2));
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

// Run the main function
main().catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
});
