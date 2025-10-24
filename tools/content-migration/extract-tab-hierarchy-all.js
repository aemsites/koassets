#!/usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { sanitizeFileName, buildFileNameWithId } = require('./sanitize-utils.js');

const AEM_AUTHOR = 'https://author-p64403-e544653.adobeaemcloud.com';
const CONTENT_PATH = '/content/share/us/en/all-content-stores';

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
const OUTPUT_DIR = path.join(__dirname, 'extracted-results');
const INPUT_FILE = path.join(OUTPUT_DIR, 'parent-tabs.model.json');

// Image URL configuration
const BASE_URL = `${CONTENT_PATH}/`;

// Dynamic paths - will be discovered at runtime
let DISCOVERED_BASE_PATH = null;

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
          fs.writeFileSync(outputPath, data);
          console.log(`✅ Downloaded: ${path.basename(outputPath)} (${data.length} bytes)`);
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

// Function to discover parent tabs path dynamically
async function discoverParentTabsPath() {
  console.log('🔍 Discovering parent tabs component path...');

  // Find parent tabs path (similar to bash script logic)
  function findTabsPath(obj, currentPath = '') {
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const item = obj[key];
        const newPath = currentPath ? `${currentPath}/${key}` : key;

        // Check if this is a tabs component
        if (item && typeof item === 'object'
                      && item['sling:resourceType'] === 'tccc-dam/components/tabs') {
          // Check if this looks like a parent (not nested in item_*)
          if (!newPath.includes('/item_')) {
            return `/jcr:content/${newPath}`;
          }
        }

        // Recursively search
        if (item && typeof item === 'object') {
          const found = findTabsPath(item, newPath);
          if (found) return found;
        }
      }
    }
    return null;
  }

  // First, fetch the JCR content structure
  const jcrUrl = `${AEM_AUTHOR}${CONTENT_PATH}/jcr:content.infinity.json`;
  console.log(`📡 Fetching JCR structure from: ${jcrUrl}`);

  try {
    const jcrContent = await downloadFile(jcrUrl, path.join(OUTPUT_DIR, 'temp-jcr-content.json'));
    const jcrData = JSON.parse(jcrContent);

    const parentTabsPath = findTabsPath(jcrData);

    if (parentTabsPath) {
      console.log(`✅ Found parent tabs at: ${parentTabsPath}`);

      // Extract the dynamic base path (everything except the final /tabs part)
      // Also convert jcr:content to _jcr_content for URL usage
      DISCOVERED_BASE_PATH = parentTabsPath.replace(/\/tabs$/, '').replace('/jcr:content', '_jcr_content');
      console.log(`🔍 Discovered base path: ${DISCOVERED_BASE_PATH}`);

      // Clean up temp file
      fs.unlinkSync(path.join(OUTPUT_DIR, 'temp-jcr-content.json'));
      return parentTabsPath;
    }
    throw new Error('No parent tabs component found');
  } catch (error) {
    console.error(`❌ Failed to discover parent tabs path: ${error.message}`);
    return null;
  }
}

// Function to get the right teaser path from the teaser path map during traversal
// (This function is kept for potential future use, but currently unused)

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

  // Check if file exists, if not download it
  if (!fs.existsSync(INPUT_FILE)) {
    console.log(`📥 File ${INPUT_FILE} not found, attempting to download...`);

    try {
      // Discover parent tabs path dynamically
      const parentTabsPath = await discoverParentTabsPath();

      if (!parentTabsPath) {
        console.error('❌ Could not find parent tabs component');
        process.exit(1);
      }

      // Download parent-tabs.model.json
      const parentTabsUrl = `${AEM_AUTHOR}${CONTENT_PATH}${parentTabsPath}.model.json`;
      console.log(`📡 Downloading from: ${parentTabsUrl}`);

      await downloadFile(parentTabsUrl, INPUT_FILE);
    } catch (error) {
      console.error(`❌ Failed to download file: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(`✅ Using existing file: ${INPUT_FILE}`);
  }

  // Continue with parsing...
  // eslint-disable-next-line no-use-before-define
  parseCompleteHierarchy();
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
        const item = itemsData[itemKey];
        if (!item) return;

        // Build current path for context
        let currentPath = parentPath;

        if (itemKey !== ':items' && itemKey !== ':itemsOrder') {
          currentPath += `/${itemKey}`;
        }

        // Get title using fallback chain
        // eslint-disable-next-line no-use-before-define
        const title = getTitle(item, itemKey);

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

        // Determine type
        let itemType = 'tab'; // default
        if (isTeaserWithImage) {
          itemType = 'image';
        }

        // Build the JSON item
        const jsonItem = {
          title,
          path: currentDisplayPath,
        };

        // Add ID if different from title
        if (title !== itemKey) {
          jsonItem.id = item.id;
        }

        jsonItem.type = itemType;

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

        // Add children if they exist
        if (hasChildren) {
          const childItems = buildJsonItems(contentItems, currentPath, currentDisplayPath);
          if (childItems.length > 0) {
            jsonItem.items = childItems;
          }
        }

        result.push(jsonItem);
      });
    }

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

    // Skip structural containers
    if (childKey === 'tabs' || childKey.match(/^tabs_.*$/)
            || childKey === 'container' || childKey.startsWith('container_')) {
      return getContentItems(onlyChild);
    }
  }

  return items;
}

function parseCompleteHierarchy() {
  console.log('📖 Extracting item titles and image URLs...');

  // Read and parse JSON
  let jsonData;
  try {
    const jsonContent = fs.readFileSync(INPUT_FILE, 'utf8');
    jsonData = JSON.parse(jsonContent);
  } catch (error) {
    console.log(`❌ Error parsing JSON: ${error.message}`);
    process.exit(1);
  }

  // Helper function to find main container path
  function findMainContainerPath(obj, basePath = '') {
    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i += 1) {
      const [key, value] = entries[i];
      const currentPath = `${basePath}/${key}`;

      if (key.startsWith('container_') && typeof value === 'object' && value[':items']) {
        // Check if this container has tabs inside it
        // eslint-disable-next-line no-use-before-define
        const hasTabsInside = checkForTabsRecursively(value[':items']);
        if (hasTabsInside) {
          return `${currentPath}/container`;
        }
      }

      if (typeof value === 'object' && value[':items']) {
        const found = findMainContainerPath(value[':items'], currentPath);
        if (found) return found;
      }
    }
    return null;
  }

  // Helper function to check for tabs recursively
  function checkForTabsRecursively(obj) {
    if (!obj || typeof obj !== 'object') return false;

    const entries = Object.entries(obj);
    for (let i = 0; i < entries.length; i += 1) {
      const [key, value] = entries[i];
      if (key === 'tabs' || key.match(/^tabs_.*$/)) {
        return true;
      }
      if (typeof value === 'object' && value[':items']) {
        if (checkForTabsRecursively(value[':items'])) {
          return true;
        }
      }
    }
    return false;
  }

  // Ensure we have discovered the base path
  if (!DISCOVERED_BASE_PATH) {
    console.log('⚠️  Base path not discovered, trying to extract from existing file...');
    // Try to infer from the existing content structure
    if (jsonData && jsonData[':items']) {
      // Look for the first container path pattern
      const firstItemKey = Object.keys(jsonData[':items'])[0];
      if (firstItemKey) {
        // Assume pattern: /jcr:content/root/container/container_XXXX/container
        DISCOVERED_BASE_PATH = '/jcr:content/root/container';

        // Try to find the main container that contains tabs
        const containerPath = findMainContainerPath(jsonData[':items'], '_jcr_content/root');
        if (containerPath) {
          DISCOVERED_BASE_PATH = containerPath;
          console.log(`🔍 Inferred base path: ${DISCOVERED_BASE_PATH}`);
        } else {
          // Try a simpler approach - look for any container_ pattern in the JSON
          console.log('🔍 Trying alternative container discovery...');
          const jsonStr = JSON.stringify(jsonData);
          const containerMatch = jsonStr.match(/container_\d+_\d+/);
          if (containerMatch) {
            DISCOVERED_BASE_PATH = `_jcr_content/root/container/${containerMatch[0]}/container`;
            console.log(`🔍 Found container pattern: ${DISCOVERED_BASE_PATH}`);
          } else {
            console.log('⚠️  Could not determine container path, using minimal default');
            DISCOVERED_BASE_PATH = '_jcr_content/root';
          }
        }
      }
    }
  }

  // First, find all teasers and their correct JCR paths
  function findTeasersRecursively(items, currentJcrPath = '', teasers = []) {
    if (!items || typeof items !== 'object') return teasers;

    const itemsOrder = items[':itemsOrder'] || Object.keys(items[':items'] || items);
    const itemsData = items[':items'] || items;

    if (itemsOrder && itemsData) {
      itemsOrder.forEach((itemKey) => {
        const item = itemsData[itemKey];
        if (!item) return;

        // Build JCR path for this item
        let newJcrPath = currentJcrPath;
        if (itemKey.startsWith('item_')) {
          newJcrPath += `/${itemKey}`;
        } else if (itemKey === 'tabs' || itemKey.match(/^tabs_.*$/)) {
          newJcrPath += `/${itemKey}`;
        } else if (itemKey === 'container' || itemKey.startsWith('container_')) {
          newJcrPath += `/${itemKey}`;
        }

        // If this is a teaser, add it to our list
        if (isTeaser(item, itemKey)) {
          teasers.push({
            key: itemKey,
            item,
            jcrPath: `${DISCOVERED_BASE_PATH}/tabs${newJcrPath}`,
            title: item.title,
          });
        }

        // Recursively process children
        if (item[':items']) {
          findTeasersRecursively(item, newJcrPath, teasers);
        }
      });
    }

    return teasers;
  }

  const allTeasers = findTeasersRecursively(jsonData);
  const teaserPathMap = {};
  allTeasers.forEach((teaser) => {
    // Use composite key: item.id + key to uniquely identify each teaser
    const compositeKey = `${teaser.item.id}:${teaser.key}`;
    teaserPathMap[compositeKey] = {
      key: teaser.key,
      item: teaser.item,
      jcrPath: teaser.jcrPath,
      title: teaser.title,
    };
  });

  console.log('');
  console.log('📍 Teaser Path Map Keys:');
  Object.keys(teaserPathMap).slice(0, 5).forEach((key) => {
    console.log(`  - ${key}`);
  });
  console.log(`  ... and ${Object.keys(teaserPathMap).length - 5} more`);
  console.log('');

  // Generate JSON structure
  const jsonStructure = buildJsonStructure(jsonData, teaserPathMap);

  // Save JSON structure to file
  const jsonOutputPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonStructure, null, 2));
  console.log(`💾 JSON structure saved to: ${jsonOutputPath}`);

  console.log('');
  console.log('📋 OUTPUTS SAVED');
  console.log('===============');
  console.log(`📋 JSON structure: ${jsonOutputPath}`);
}

// Run the main function
main().catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
});
