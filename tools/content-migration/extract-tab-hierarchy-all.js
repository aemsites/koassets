#!/usr/bin/env node

/* eslint-disable no-console, no-shadow, no-restricted-syntax, no-inner-declarations, no-underscore-dangle, no-plusplus, no-await-in-loop, no-undef, no-unused-vars, global-require, no-lonely-if, prefer-destructuring, radix, max-len */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { sanitizeFileName, buildFileNameWithId } = require('./sanitize-utils.js');
const { PATH_SEPARATOR } = require('./constants.js');

// Help and usage information
function showHelp() {
  console.log(`
📋 AEM Content Hierarchy Extractor
==================================

DESCRIPTION:
  Extracts hierarchical content structure from AEM and downloads associated images.
  Creates a clean JSON hierarchy with all teaser images and banner images downloaded.

USAGE:
  node extract-tab-hierarchy-all.js [CONTENT_PATH]

EXAMPLES:
  # Extract default content store (/content/share/us/en/all-content-stores)
  node extract-tab-hierarchy-all.js
  
  # Extract main content store (explicit)
  node extract-tab-hierarchy-all.js /content/share/us/en/all-content-stores
  
  # Extract specific campaign
  node extract-tab-hierarchy-all.js /content/share/us/en/all-content-stores/global-coca-cola-uplift

OUTPUTS:
  📁 {hierarchical-dir-name}/extracted-results/
  ├── hierarchy-structure.json          # Main structured output
  ├── jcr-content.json                 # Raw JCR data from AEM
  ├── most-comprehensive-tabs.model.json # Raw Sling model data
  └── images/                           # Downloaded teaser & banner images
      ├── teaser-abc123-image1.png
      └── banner-image.png

  Note: {hierarchical-dir-name} follows this convention:
  • all-content-stores                  # For main content stores
  • *-content-stores                    # For other main content stores  
  • all-content-stores__global-coca-cola-uplift    # For child campaigns (parent__child)
  • *-content-stores__campaign-name     # For other child campaigns (parent__child)

FEATURES:
  ✅ Data-driven extraction (no hardcoded logic)
  ✅ Auto-detects content sections and hierarchy
  ✅ Automatic discovery and recursive extraction of linked content stores
  ✅ Downloads all associated images with fallback URLs
  ✅ Parallel downloads for maximum speed
  ✅ Clean key names (removes technical suffixes)
  ✅ Extracts navigation links and metadata
  ✅ Filters out duplicate text components (text/text_copy)

AUTOMATIC DISCOVERY:
  The script automatically discovers and extracts OTHER base content stores:
  
  1. Extracts the specified content path (e.g., /content/share/us/en/all-content-stores)
  2. Analyzes all linkURLs in the extracted hierarchy
  3. Identifies linkURLs pointing to DIFFERENT base content stores
     (must end with '-content-stores' and be different from current store)
  4. Recursively extracts each discovered base content store
  
  Example:
    Running: node extract-tab-hierarchy-all.js /content/share/us/en/all-content-stores
    
    Will extract:
    • all-content-stores/                          (main extraction - specified)
    
    May also discover and extract (if linkURLs point to them):
    • bottler-content-stores/                      (different base store)
    • regional-content-stores/                     (different base store)
    
  Note: Child campaigns (e.g., global-coca-cola-uplift) are NOT automatically
        extracted. You must manually run the script for each child campaign:
        node extract-tab-hierarchy-all.js /content/share/us/en/all-content-stores/global-coca-cola-uplift

REQUIREMENTS:
  - AEM authentication cookie in da.config file
  - Network access to AEM author instance
  - Write permissions to output directory

For more information, see README.md
`);
}

// Check for help flag or missing arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Function to create deterministic ID from a string (simple hash)
function createDeterministicId(input) {
  let hash = 0;
  if (input.length === 0) return '0000000000';

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash; // Convert to 32-bit integer
  }

  // Convert to positive number and then to base36 string
  const positiveHash = Math.abs(hash);
  return positiveHash.toString(36).padStart(10, '0').substring(0, 10);
}

// Function to strip host from URLs and remove file extensions
// Validate if a linkURL is valid (not just random text like "hh")
function isValidLinkURL(url) {
  if (!url || typeof url !== 'string') return false;

  // Must start with http://, https://, or /
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return false;
  }

  // If it starts with /, it must have more than just a few characters
  if (url.startsWith('/') && url.length < 5) {
    return false;
  }

  return true;
}

function stripHostAndExtension(url) {
  if (!url) return url;

  let pathname; let search; let
    hash;

  try {
    const urlObj = new URL(url);
    pathname = urlObj.pathname;
    search = urlObj.search;
    hash = urlObj.hash;
  } catch (e) {
    // If it's not a valid URL (e.g., already a path), treat as pathname
    pathname = url;
    search = '';
    hash = '';
  }

  // Only strip file extension if the entire URL ends with an extension
  // (i.e., no query params or hash after the pathname)
  if (!search && !hash) {
    pathname = pathname.replace(/\.[^/.]+$/, '');
  }

  return pathname + search + hash;
}

const AEM_AUTHOR = 'https://author-p64403-e544653.adobeaemcloud.com';
// Default content path
const DEFAULT_CONTENT_PATH = '/content/share/us/en/all-content-stores';

// Get content path from command line argument or use default
const CONTENT_PATH = process.argv[2] || DEFAULT_CONTENT_PATH;

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

// File paths - Create hierarchical directory name
function createHierarchicalDirName(contentPath) {
  const pathParts = contentPath.split('/').filter((p) => p);
  const contentName = pathParts[pathParts.length - 1];
  const parentName = pathParts[pathParts.length - 2];

  // If no parent, use just the content name
  if (!parentName) {
    return contentName;
  }

  // Check if parent looks like a content store (ends with '-content-stores' or is 'all-content-stores')
  const isContentStoreParent = parentName === 'all-content-stores' || parentName.endsWith('-content-stores');

  // Check if current name looks like a main content store
  const isMainContentStore = contentName === 'all-content-stores' || contentName.endsWith('-content-stores');

  // If this is a main content store, always use just that name
  if (isMainContentStore) {
    return contentName;
  }

  // Use double underscore to show hierarchy: parent__child (for content store children)
  if (isContentStoreParent) {
    return `${parentName}__${contentName}`;
  }

  // For other cases, use just the content name
  return contentName;
}

const hierarchicalDirName = createHierarchicalDirName(CONTENT_PATH);
const OUTPUT_DIR = path.join(__dirname, hierarchicalDirName, 'extracted-results');

// Image URL configuration
const BASE_URL = `${CONTENT_PATH}/`;

// Dynamic paths - will be discovered at runtime
// const DISCOVERED_BASE_PATH = null;

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

// Function to extract and process linked content stores
async function extractLinkedContentStores(hierarchyStructureFile) {
  console.log('\n🔍 Analyzing linkURLs for other content stores...');

  // Read and parse the hierarchy file
  let hierarchyData;
  try {
    const fileContent = fs.readFileSync(hierarchyStructureFile, 'utf8');
    hierarchyData = JSON.parse(fileContent);
  } catch (error) {
    console.log(`❌ Error reading hierarchy file: ${error.message}`);
    return;
  }

  // Function to recursively extract all linkURLs from the hierarchy
  function extractLinkURLs(obj, linkURLs = new Set()) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => extractLinkURLs(item, linkURLs));
    } else if (typeof obj === 'object' && obj !== null) {
      if (obj.linkURL) {
        linkURLs.add(obj.linkURL);
      }
      Object.values(obj).forEach((value) => extractLinkURLs(value, linkURLs));
    }
    return linkURLs;
  }

  // Extract all linkURLs
  const allLinkURLs = extractLinkURLs(hierarchyData);
  console.log(`📊 Found ${allLinkURLs.size} total linkURLs`);

  // Extract unique content store base paths
  const contentStorePaths = new Set();
  const linkURLArray = Array.from(allLinkURLs);

  linkURLArray.forEach((linkURL) => {
    // Match pattern: /content/share/us/en/{content-store-name}/...
    const match = linkURL.match(/^(\/content\/share\/us\/en\/[^\/]+)/);
    if (match) {
      const basePath = match[1];
      const baseStoreName = basePath.split('/').pop();

      // Skip the current content store (avoid circular extraction)
      const currentStoreName = CONTENT_PATH.split('/').pop();
      if (baseStoreName !== currentStoreName && baseStoreName.endsWith('-content-stores')) {
        contentStorePaths.add(basePath);
      }
    }
  });

  if (contentStorePaths.size === 0) {
    console.log('✅ No other content stores found to extract.');
    return;
  }

  console.log(`🎯 Discovered ${contentStorePaths.size} other content store(s):`);
  Array.from(contentStorePaths).sort().forEach((path, index) => {
    console.log(`  ${index + 1}. ${path}`);
  });

  console.log('\n🚀 Starting extraction for discovered content stores...');

  // Import child_process for running the script
  const { execSync } = require('child_process');

  let successCount = 0;
  let failureCount = 0;

  for (const contentPath of Array.from(contentStorePaths).sort()) {
    console.log(`\n📋 Extracting: ${contentPath}`);
    console.log('-'.repeat(50));

    try {
      // Run the extraction script recursively
      const command = `node extract-tab-hierarchy-all.js "${contentPath}"`;
      const output = execSync(command, {
        cwd: __dirname,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      console.log('✅ SUCCESS');
      // Show the last few meaningful lines (summary section)
      const lines = output.split('\n').filter((line) => line.trim());
      const lastLines = lines.slice(-8); // Show last 8 non-empty lines
      lastLines.forEach((line) => console.log(line));

      successCount++;
    } catch (error) {
      console.log('❌ FAILED');

      // Collect all available error information
      const errorParts = [];

      if (error.stdout) {
        errorParts.push(error.stdout);
      }
      if (error.stderr) {
        errorParts.push(error.stderr);
      }
      if (error.message && !error.stdout && !error.stderr) {
        errorParts.push(error.message);
      }

      const errorOutput = errorParts.join('\n');

      // Show meaningful error context - last few lines before failure
      const lines = errorOutput.split('\n').filter((line) => line.trim());
      const errorLines = lines.slice(-10); // Show last 10 non-empty lines for better context

      if (errorLines.length > 0) {
        console.log('Error details:');
        errorLines.forEach((line) => console.log(`  ${line}`));
      } else {
        console.log(`Error: ${error.message || 'Unknown error'}`);
        if (error.code) {
          console.log(`Exit code: ${error.code}`);
        }
      }

      failureCount++;
    }
  }

  // Final summary for linked extractions
  console.log('\n📊 LINKED CONTENT STORES SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful extractions: ${successCount}`);
  console.log(`❌ Failed extractions: ${failureCount}`);
  console.log(`📁 Total linked stores processed: ${contentStorePaths.size}`);
}

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

    // Button container extraction disabled - buttons are already part of regular tabs structure
    const buttonContainerPaths = [];

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
              // Store buttons WITH linkURL by:
              // 1. Full JCR path (most specific - handles duplicate keys in different containers)
              // 2. Button key (may have collisions if same key in different containers)
              // 3. Context key (title|parentKey)
              // 4. Title-only (fallback, but may have collisions)
              const fullPath = `${parentPath}/${key}`;
              jcrLinkUrlMap[fullPath] = linkURL;
              jcrLinkUrlMap[key] = linkURL;
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
              // Store text by context key (title|parentKey) with path for uniqueness
              // Use current item's path (parentPath/key) not parent's path
              const currentItemPath = `${parentPath}/${key}`;
              const uniqueContextKey = `${titleKey}|${parentKeyContext}|${currentItemPath}`;
              jcrTextMap[uniqueContextKey] = textContent;
              jcrTextMap[contextKey] = textContent;

              // Store by title-only as fallback, but don't overwrite existing content
              if (!jcrTextMap[titleKey]) {
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

              // Also store linkURL if it exists in the model (it's in imageResource)
              if (item.imageResource.linkURL) {
                jcrTeaserImageMap[matchingJcrKey].linkURL = stripHostAndExtension(item.imageResource.linkURL);
              }

              // Also check for linkURL in item.linkURL (strip host and extension)
              if (item.linkURL) {
                jcrTeaserImageMap[matchingJcrKey].linkURL = stripHostAndExtension(item.linkURL);
              }

              // Also check for linkURL in item.link.url (strip host and extension)
              if (item.link && item.link.url) {
                jcrTeaserImageMap[matchingJcrKey].linkURL = stripHostAndExtension(item.link.url);
              }
            }
          }

          // Extract linkURL from any item that has link.url or linkURL (not just teasers)
          if (item.linkURL || (item.link && item.link.url)) {
            // Create path-based unique key to match JCR indexing
            const uniqueKey = `${newPath}`;

            // Create a synthetic JCR key for linkURL storage
            const linkUrlKey = `${newPath}_linkurl`;
            jcrTeaserImageMap[linkUrlKey] = {
              teaserKey: key,
              hasImageResource: false,
              modelPath: uniqueKey,
            };

            // Store linkURL from item.linkURL (strip host and extension)
            if (item.linkURL) {
              jcrTeaserImageMap[linkUrlKey].linkURL = stripHostAndExtension(item.linkURL);
            }

            // Store linkURL from item.link.url (strip host and extension)
            if (item.link && item.link.url) {
              jcrTeaserImageMap[linkUrlKey].linkURL = stripHostAndExtension(item.link.url);
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

    // Remove teasers from jcrTeaserImageMap that don't have imageResource AND don't have linkURL
    const beforeCleanup = Object.keys(jcrTeaserImageMap).length;
    for (const uniqueKey in jcrTeaserImageMap) {
      if (!jcrTeaserImageMap[uniqueKey].hasImageResource && !jcrTeaserImageMap[uniqueKey].linkURL) {
        delete jcrTeaserImageMap[uniqueKey];
      }
    }
    const afterCleanup = Object.keys(jcrTeaserImageMap).length;
    if (beforeCleanup !== afterCleanup) {
      console.log(`🧹 Cleaned up ${beforeCleanup - afterCleanup} teasers without imageResource from model`);
    }

    // Button container processing disabled - buttons are already part of regular tabs structure
    console.log(`📌 Using ${mainTabsData[':itemsOrder'].length} tabs items\n`);

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
        const currentDisplayPath = displayPath ? `${displayPath}${PATH_SEPARATOR}${title.trim()}` : title.trim();

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
        // Check multiple possible locations: item.linkURL, item.link.url
        // Otherwise use ID-based matching (most accurate), then title-based
        if (item.linkURL) {
          jsonItem.linkURL = stripHostAndExtension(item.linkURL); // Strip for item.linkURL
        } else if (item.link && item.link.url) {
          jsonItem.linkURL = stripHostAndExtension(item.link.url); // Strip for item.link.url
        } else if (item.id && jcrLinkUrlMap[item.id]) {
          // Try ID-based matching first (most accurate for duplicate titles)
          jsonItem.linkURL = stripHostAndExtension(jcrLinkUrlMap[item.id]);
        } else {
          // Use title-based matching (only items WITH linkURLs are in the map)
          const linkURL = stripHostAndExtension(jcrLinkUrlMap[String(title)]);
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

      const currentDisplayPath = displayPath ? `${displayPath}${PATH_SEPARATOR}${title.trim()}` : title.trim();
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
      // Check multiple possible locations: item.linkURL, item.link.url
      // Otherwise use ID-based matching (most accurate), then title-based
      if (item.linkURL) {
        jsonItem.linkURL = stripHostAndExtension(item.linkURL); // Strip for item.linkURL
      } else if (item.link && item.link.url) {
        jsonItem.linkURL = stripHostAndExtension(item.link.url); // Strip for item.link.url
      } else if (item.id && jcrLinkUrlMap[item.id]) {
        // Try ID-based matching first (most accurate for duplicate titles)
        jsonItem.linkURL = stripHostAndExtension(jcrLinkUrlMap[item.id]);
      } else {
        // Use title-based matching (only items WITH linkURLs are in the map)
        const linkURL = stripHostAndExtension(jcrLinkUrlMap[String(title)]);
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

      // For text components with HTML content, try to extract a clean title
      if (!title) {
        return;
      }

      if (String(title).includes('<')) {
        // If this is a text component with HTML content, try to extract clean text
        const resourceType = item['sling:resourceType'] || item[':type'] || '';
        if (resourceType.includes('text') && title) {
          // Extract text content from HTML (simple approach - remove tags)
          const cleanTitle = String(title).replace(/<[^>]*>/g, '').trim();

          if (cleanTitle && cleanTitle.length > 0 && cleanTitle.length < 200) {
            title = cleanTitle;
          } else {
            // If we can't extract clean text, use the component key as title
            title = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          }
        } else {
          // For non-text components with HTML, skip them
          return;
        }
      }

      // Check if this is a synthetic button container that should be flattened
      if (key.startsWith('button_container_') && title === key) {
        // This is a synthetic container - skip it but process its children
        // Preserve the JCR section metadata from the synthetic container
        if (item[':items']) {
          const childrenItems = extractItemsHierarchy(item[':items'], `${parentKeyPath}/${key}`, displayPath, jcrPathMap, jcrTeaserImageMap);
          if (childrenItems.length > 0) {
            // Transfer the __jcrSection metadata from the synthetic container to its children
            if (item.__jcrSection) {
              childrenItems.forEach((child) => {
                if (!child.__jcrSection) {
                  child.__jcrSection = item.__jcrSection;
                }
              });
            }
            result.push(...childrenItems);
          }
        }
        return;
      }

      // Don't trim - preserve exact spacing from source data
      title = String(title);

      let itemType = 'item';
      const resourceType = item['sling:resourceType'] || item[':type'] || '';

      if (resourceType.includes('tabs')) {
        itemType = 'tabs';
      } else if (resourceType.includes('accordion')) {
        itemType = 'accordion';
      } else if (resourceType.includes('container')) {
        itemType = 'container';
      } else if (resourceType.includes('text')) {
        itemType = 'text';
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
        else if (idPrefix === 'text') itemType = 'text';
      }

      // Build display path only for output (for user viewing)
      // Avoid duplicates in the path and exclude structural JSON object keys
      const structuralKeys = ['container', 'accordion', 'tabs'];
      const isStructuralKey = structuralKeys.includes(title) || title.startsWith('container_') || title.startsWith('accordion_') || title.startsWith('tabs_');

      let currentDisplayPath = title;
      if (displayPath) {
        const pathParts = displayPath.split(PATH_SEPARATOR);
        // Only add the title if it's not already in the path AND is not a structural key
        if (!pathParts.includes(title) && !isStructuralKey) {
          currentDisplayPath = `${displayPath}${PATH_SEPARATOR}${title}`;
        } else {
          // Skip adding duplicate title or structural segments to path
          currentDisplayPath = displayPath;
        }
      } else {
        // If this is the root level and is a structural key, use empty path
        if (isStructuralKey) {
          currentDisplayPath = '';
        }
      }
      // Build JCR key path for logic (context matching, hierarchy tracking)
      // Make sure it matches the format used in extractTimestampsFromModel
      const currentKeyPath = `${parentKeyPath}/${key}`;

      const hierarchyItem = {
        title,
        path: currentDisplayPath,
        type: itemType,
        key: key.replace(/__tabs\d+$/, ''), // Remove __tabs suffix from key for cleaner output
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

      // Check for linkURL directly in item data first (for synthetic button items)
      if (item.linkURL && isValidLinkURL(item.linkURL)) {
        // Don't double-process URLs that are already processed (start with /)
        if (item.linkURL.startsWith('/')) {
          hierarchyItem.linkURL = item.linkURL;
        } else {
          hierarchyItem.linkURL = stripHostAndExtension(item.linkURL);
        }
      } else if (item.buttonLink && item.buttonLink.url && isValidLinkURL(item.buttonLink.url)) {
        // Handle buttonLink.url (used in Sling model for buttons)
        hierarchyItem.linkURL = stripHostAndExtension(item.buttonLink.url);
      } else if (item.link && item.link.url && isValidLinkURL(item.link.url)) {
        hierarchyItem.linkURL = stripHostAndExtension(item.link.url);
      } else {
        // Only use jcrTeaserImageMap lookup which is indexed by model path (most reliable)
        // Don't use jcrLinkUrlMap fallbacks as they cause false matches when multiple items
        // have the same key (e.g., "button_copy") or title (e.g., "KVs", "Coming Soon")
        for (const [jcrPath, jcrData] of Object.entries(jcrTeaserImageMap)) {
          if (jcrData.modelPath === currentKeyPath && jcrData.linkURL && isValidLinkURL(jcrData.linkURL)) {
            hierarchyItem.linkURL = stripHostAndExtension(jcrData.linkURL);
            break;
          }
        }
      }

      // First, check if text content exists directly in the model item
      if (item.text && itemType === 'text') {
        hierarchyItem.text = item.text;
      } else {
        // Look up text content using JCR context with multiple fallback strategies
        let textContent = null;
        const uniqueContextKey = `${String(title)}|${immediateParentKey}|${currentKeyPath}`;

        // For accordion panel items, ONLY use path-based keys (don't use contextKey which may be overwritten)
        if (itemType === 'container' && immediateParentKey && immediateParentKey.startsWith('accordion') && key === 'item_1' && currentKeyPath) {
          // Search for ALL path-based keys with this parent+title
          const parentContextPattern = `|${immediateParentKey}|`;
          const currentTitle = String(title);
          const pathBasedKeys = Object.keys(jcrTextMap).filter((k) => {
            if (!k.startsWith(`${currentTitle}|`)) return false;
            if (!k.includes(parentContextPattern)) return false;
            const afterParent = k.split(parentContextPattern)[1];
            return afterParent && afterParent.includes('/');
          });

          if (pathBasedKeys.length > 0) {
            // If there are multiple matches, try to find the best match based on path similarity
            if (pathBasedKeys.length > 1) {
              // Extract path segments from currentKeyPath to use for matching
              const pathSegments = currentKeyPath.split('/').filter((s) => s);

              // Score each JCR key based on how many path segments it contains
              const scoredKeys = pathBasedKeys.map((k) => {
                const jcrPath = k.split(parentContextPattern)[1] || '';
                const score = pathSegments.filter((seg) => jcrPath.includes(`/${seg}/`) || jcrPath.includes(`/${seg}`)).length;
                return { key: k, score };
              });

              // Sort by score (descending) and use the best match
              scoredKeys.sort((a, b) => b.score - a.score);
              textContent = jcrTextMap[scoredKeys[0].key];
            } else {
              // Only one match, use it
              textContent = jcrTextMap[pathBasedKeys[0]];
            }
          }
          // Don't fall back to contextKey for accordion items - it's unreliable when there are duplicates
        } else {
          // For non-accordion items, use the regular lookup
          textContent = jcrTextMap[uniqueContextKey] || jcrTextMap[contextKey];
        }

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
      }

      // Generate imageUrl for teaser items
      if (itemType === 'teaser') {
        let imageUrl = null;

        // Check if we have image info from model (only teasers with valid imageResource)
        let teaserImageInfo = null;

        // Find JCR entry that has this model path stored
        for (const [jcrPath, jcrData] of Object.entries(jcrTeaserImageMap)) {
          if (jcrData.modelPath === currentKeyPath && (jcrData.hasImageResource || jcrData.linkURL)) {
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
        // Check if there are text or text_copy children and extract their text content to parent
        const textChild = item[':items'].text || item[':items'].text_copy;
        if (textChild && textChild.text && !hierarchyItem.text) {
          hierarchyItem.text = textChild.text;
        }

        // Filter out ALL text children (text, text_copy, text_copy_copy, etc.) to avoid duplication
        // Text content is now on parent, so we don't need separate text children
        const filteredItems = { ...item[':items'] };
        Object.keys(filteredItems).forEach((childKey) => {
          const childItem = filteredItems[childKey];
          // Remove any child that is a text component
          if (childItem && (childItem['sling:resourceType'] === 'tccc-dam/components/text'
            || childKey === 'text' || childKey.startsWith('text_'))) {
            delete filteredItems[childKey];
          }
        });

        const childrenItems = extractItemsHierarchy(filteredItems, currentKeyPath, currentDisplayPath, jcrPathMap, jcrTeaserImageMap);
        if (childrenItems.length > 0) {
          hierarchyItem.items = childrenItems;
        }
      }

      // Skip containers with titles starting with "container_" but still process their children
      if (itemType === 'container' && title && String(title).startsWith('container_')) {
      // Don't add this container to result, but add its children directly
        if (hierarchyItem.items && hierarchyItem.items.length > 0) {
          result.push(...hierarchyItem.items);
        }
      } else {
        result.push(hierarchyItem);
      }
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

    // Function to remove duplicate consecutive containers with the same title
    function removeDuplicateContainers(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        // Recursively process children first
        if (item.items) {
          item.items = removeDuplicateContainers(item.items);
        }

        // Check if this item has a single child with the same title
        if (item.items && item.items.length === 1) {
          const child = item.items[0];

          // If parent and child have the same title and both are containers/items, merge them
          if (item.title === child.title
              && (item.type === 'container' || item.type === 'item')
              && (child.type === 'container' || child.type === 'item')) {
            // Merge: keep the parent but use the child's children
            return {
              ...item,
              items: child.items || [],
              // Preserve any additional properties from child if they don't exist in parent
              ...(child.id && !item.id ? { id: child.id } : {}),
              ...(child.linkURL && !item.linkURL ? { linkURL: child.linkURL } : {}),
              ...(child.imageUrl && !item.imageUrl ? { imageUrl: child.imageUrl } : {}),
              ...(child.text && !item.text ? { text: child.text } : {}),
            };
          }
        }

        return item;
      });
    }

    // Function to clean up duplicate path segments in the final hierarchy
    function cleanupDuplicatePathSegments(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        const updatedItem = { ...item };

        // Clean up duplicates and filter out structural JSON object keys in the path
        if (updatedItem.path) {
          const pathParts = updatedItem.path.split(PATH_SEPARATOR);
          const uniqueParts = [];
          const structuralKeys = ['container', 'accordion', 'tabs'];

          for (const part of pathParts) {
            // Check if this part is a structural key
            const isStructuralKey = structuralKeys.includes(part) || part.startsWith('container_') || part.startsWith('accordion_') || part.startsWith('tabs_');

            // Only add if it's not already in the unique parts array AND is not a structural key
            if (!uniqueParts.includes(part) && !isStructuralKey) {
              uniqueParts.push(part);
            }
          }

          updatedItem.path = uniqueParts.join(PATH_SEPARATOR);
        }

        // Recursively clean up children
        if (updatedItem.items) {
          updatedItem.items = cleanupDuplicatePathSegments(updatedItem.items);
        }

        return updatedItem;
      });
    }

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
    const deduplicatedHierarchy = removeDuplicateContainers(cleanedHierarchy);
    const groupedHierarchy = groupHierarchyBySections(deduplicatedHierarchy, jcrData);
    mainHierarchy = cleanupDuplicatePathSegments(groupedHierarchy);
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
        // Check if section contains only one item with the same title (redundant nesting)
        if (itemsInSection.length === 1
            && itemsInSection[0].title
            && itemsInSection[0].title.trim() === section.title.trim()) {
          // Flatten: use the container directly as the section, but keep section type
          const flattenedItem = { ...itemsInSection[0] };
          delete flattenedItem.__jcrSection;
          flattenedItem.type = 'section'; // Change type to section
          grouped.push(flattenedItem);
          console.log(`  - ${section.title} (${flattenedItem.items?.length || 0}) [flattened duplicate]`);
        } else {
          // Normal section with multiple items or different titles
          const sectionObj = {
            title: section.title,
            path: section.title,
            type: 'section',
            items: itemsInSection.map((item) => {
              const updatedItem = { ...item };
              // Remove the internal metadata before output
              delete updatedItem.__jcrSection;

              if (!item.path.startsWith(section.title)) {
                updatedItem.path = `${section.title}${PATH_SEPARATOR}${item.path}`;
              }
              if (item.items && Array.isArray(item.items)) {
                updatedItem.items = item.items.map((child) => {
                  const childCopy = { ...child };

                  // Check if child path already starts with the updated parent path
                  if (childCopy.path && childCopy.path.startsWith(updatedItem.path)) {
                    // Path already correct, no changes needed
                    // Just keep the existing path
                  } else if (childCopy.path) {
                    // Child path needs to be updated to include the section prefix
                    childCopy.path = `${updatedItem.path}${PATH_SEPARATOR}${childCopy.path}`;
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
          console.log(`  - ${section.title} (${itemsInSection.length})`);
        }
      }
    });

    console.log(`  - ${grouped.map((s) => `${s.title} (${s.items.length})`).join(', ')}\n`);

    return grouped;
  }

  // Helper function to prepend parent path to items recursively
  function prependPathToItem(item, parentPath) {
    const updatedItem = { ...item };

    if (!item.path.startsWith(parentPath)) {
      updatedItem.path = `${parentPath}${PATH_SEPARATOR}${item.path}`;
    }

    if (item.items && Array.isArray(item.items)) {
      updatedItem.items = item.items.map((child) => {
        const childCopy = { ...child };

        // Check if child path already starts with the updated parent path
        if (childCopy.path && childCopy.path.startsWith(updatedItem.path)) {
          // Path already correct, no changes needed
        } else if (childCopy.path) {
          // Child path needs to be updated to include the parent prefix
          childCopy.path = `${updatedItem.path}${PATH_SEPARATOR}${childCopy.path}`;
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
        const pathParts = item.path.split(PATH_SEPARATOR);
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

    const grouped = Array.from(sectionMap.values()).map((section) => {
      // Check if section contains only one item with the same title (redundant nesting)
      if (section.items.length === 1
          && section.items[0].title
          && section.items[0].title.trim() === section.title.trim()) {
        // Flatten: use the container directly as the section, but keep section type
        const flattenedItem = { ...section.items[0] };
        flattenedItem.type = 'section'; // Change type to section
        return flattenedItem;
      }
      // Normal section with multiple items or different titles
      return {
        title: section.title,
        path: section.title,
        type: 'section',
        items: section.items,
      };
    });

    console.log('\n📋 Auto-detected sections (data-driven from path):');
    grouped.forEach((section) => {
      const itemCount = section.items ? section.items.length : 0;
      const flattened = !section.items ? ' [flattened duplicate]' : '';
      console.log(`  - ${section.title} (${itemCount} items)${flattened}`);
    });
    console.log();

    return grouped.map((section) => {
      // If section was flattened (no items array), return as-is
      if (!section.items) {
        return section;
      }

      // Normal section processing
      return {
        ...section,
        items: section.items.map((item) => {
          if (!item.path.startsWith(section.title)) {
            return prependPathToItem(item, section.title);
          }
          return item;
        }),
      };
    });
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

  // Extract content from JCR containers outside tabs (e.g., standalone sections with buttons)
  function extractNonTabsContent(jcrData) {
    const sections = [];

    if (!jcrData.root || !jcrData.root.container) {
      return sections;
    }

    // Scan all containers at root/container level
    const rootContainer = jcrData.root.container;

    for (const containerKey in rootContainer) {
      const container = rootContainer[containerKey];

      // Skip if not an object or is a tabs component
      if (!container || typeof container !== 'object') continue;
      if (container['sling:resourceType'] === 'tccc-dam/components/tabs') continue;
      if (containerKey.startsWith('jcr:') || containerKey.startsWith('cq:') || containerKey.startsWith('sling:')) continue;

      // Look for title components and their associated content
      const titleComponent = findTitleComponent(container);
      if (titleComponent) {
        // Found a title component - this marks a section
        const sectionTitle = titleComponent['jcr:title'];
        const sectionItems = [];

        // Extract buttons and other components from this container
        extractComponentsFromContainer(container, sectionItems, sectionTitle);

        if (sectionItems.length > 0) {
          sections.push({
            title: sectionTitle,
            path: sectionTitle,
            type: 'section',
            items: sectionItems,
          });
        }
      }
    }

    return sections;
  }

  // Helper to find a title component in a container (searches recursively)
  function findTitleComponent(obj, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return null;

    for (const key in obj) {
      if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;

      const item = obj[key];
      if (item && typeof item === 'object') {
        // Check if this is a title component
        if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
          return item;
        }

        // Recursively search in nested containers
        if (item['sling:resourceType'] === 'tccc-dam/components/container') {
          const found = findTitleComponent(item, depth + 1, maxDepth);
          if (found) return found;
        }
      }
    }
    return null;
  }

  // Helper to extract components (buttons, etc.) from a container
  function extractComponentsFromContainer(container, items, sectionTitle) {
    for (const key in container) {
      if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;

      const component = container[key];
      if (!component || typeof component !== 'object') continue;

      const resourceType = component['sling:resourceType'];

      // Extract buttons
      if (resourceType === 'tccc-dam/components/button') {
        const buttonTitle = component['jcr:title'] || key;
        const buttonItem = {
          title: buttonTitle,
          path: `${sectionTitle}${PATH_SEPARATOR}${buttonTitle}`,
          type: 'button',
          key,
          id: `button-${createDeterministicId(buttonTitle + key)}`,
        };

        // Extract linkURL
        if (component.linkURL) {
          buttonItem.linkURL = stripHostAndExtension(component.linkURL);
        }

        items.push(buttonItem);
      }

      // Recursively search nested containers
      if (resourceType === 'tccc-dam/components/container') {
        extractComponentsFromContainer(component, items, sectionTitle);
      }
    }
  }

  // Extract non-tabs content and merge with main hierarchy
  const nonTabsSections = extractNonTabsContent(jcrData);
  if (nonTabsSections.length > 0) {
    console.log(`\n📦 Found ${nonTabsSections.length} section(s) outside tabs:`);
    nonTabsSections.forEach((section) => {
      console.log(`   - ${section.title} (${section.items.length} items)`);
    });
    // Prepend non-tabs sections to the beginning of the hierarchy
    mainHierarchy = [...nonTabsSections, ...mainHierarchy];
  }

  // Find banner images
  const bannerImages = extractBannerImage(jcrData, CONTENT_PATH);

  // Save to file
  const jsonOutputPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  const hierarchyStructure = {
    items: mainHierarchy,
    linkUrl: CONTENT_PATH,
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

// Function to find containers that contain button components (for sections like "Toolkits & Internal Documents")
function findAllButtonContainerPaths(node, currentPath = '', found = []) {
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

    // Found a container component - check if it contains buttons
    if (resourceType === 'tccc-dam/components/container') {
      const hasButtons = Object.values(item).some((child) => child && typeof child === 'object'
        && child['sling:resourceType'] === 'tccc-dam/components/button');

      if (hasButtons) {
        const fullPath = `/jcr:content/${newPath}`;
        found.push(fullPath);
      }
    }

    // Keep searching
    findAllButtonContainerPaths(item, newPath, found);
  });

  return found;
}

// Function to extract button components from JCR containers
function extractButtonsFromContainer(jcrData, containerPath) {
  // Navigate to the container in JCR data
  const pathParts = containerPath.replace('/jcr:content/', '').split('/');
  let current = jcrData;

  for (const part of pathParts) {
    if (current && current[part]) {
      current = current[part];
    } else {
      return [];
    }
  }

  if (!current || typeof current !== 'object') {
    return [];
  }

  // Extract all button components from this container
  const buttons = [];

  function extractButtonsRecursively(obj, currentPath = '') {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach((key) => {
      const item = obj[key];
      if (!item || typeof item !== 'object') return;

      const resourceType = item['sling:resourceType'] || '';
      const newPath = currentPath ? `${currentPath}/${key}` : key;

      // Found a button component
      if (resourceType === 'tccc-dam/components/button') {
        // Create deterministic ID based on button properties
        const title = item['jcr:title'] || key;
        const idSource = `${title}-${key}-${containerPath}`;
        const deterministicId = createDeterministicId(idSource);

        const button = {
          id: `button-${deterministicId}`,
          title,
          type: 'button',
          key,
        };

        // Add linkURL if present and valid
        if (item.linkURL && isValidLinkURL(item.linkURL)) {
          button.linkURL = stripHostAndExtension(item.linkURL);
        }

        buttons.push(button);
      }

      // Recurse into nested objects
      extractButtonsRecursively(item, newPath);
    });
  }

  extractButtonsRecursively(current);
  return buttons;
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

  // Download function with fallback mechanism
  function downloadImage(imageUrl, index) {
    return new Promise((resolve) => {
      // Helper function to attempt download with a specific URL
      function attemptDownload(urlToTry, isRetry = false) {
        // Prepend AEM_AUTHOR to the imageUrl
        const fullUrl = AEM_AUTHOR + urlToTry;

        // Extract filename from URL
        const urlParts = urlToTry.split('/');
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

            // If this is the first attempt and we got a 404, try fallback URL
            if (!isRetry && response.statusCode === 404) {
              console.log(`❌ Failed ${fullUrl} (HTTP ${response.statusCode}) - trying fallback...`);

              // Create fallback URL by removing teaser-{id}- prefix from filename
              const fallbackUrl = createFallbackUrl(urlToTry);
              if (fallbackUrl && fallbackUrl !== urlToTry) {
                console.log(`🔄 Trying fallback: ${fallbackUrl}`);
                attemptDownload(fallbackUrl, true);
                return;
              }
            }

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

          // If this is the first attempt, try fallback URL
          if (!isRetry) {
            console.log(`❌ Network error ${fullUrl}: ${err.message} - trying fallback...`);

            // Create fallback URL by removing teaser-{id}- prefix from filename
            const fallbackUrl = createFallbackUrl(urlToTry);
            if (fallbackUrl && fallbackUrl !== urlToTry) {
              console.log(`🔄 Trying fallback: ${fallbackUrl}`);
              attemptDownload(fallbackUrl, true);
              return;
            }
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

          // If this is the first attempt, try fallback URL
          if (!isRetry) {
            console.log(`❌ Timeout ${fullUrl} (server not responding) - trying fallback...`);

            // Create fallback URL by removing teaser-{id}- prefix from filename
            const fallbackUrl = createFallbackUrl(urlToTry);
            if (fallbackUrl && fallbackUrl !== urlToTry) {
              console.log(`🔄 Trying fallback: ${fallbackUrl}`);
              attemptDownload(fallbackUrl, true);
              return;
            }
          }

          failed++;
          failedUrls.push({ url: fullUrl, reason: 'Timeout (server not responding)', filename: safeFilename });
          console.log(`❌ Timeout ${fullUrl} (server not responding)`);
          resolve();
        });
      }

      // Helper function to create fallback URL by removing teaser-{id}- prefix
      function createFallbackUrl(originalUrl) {
        const urlParts = originalUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        // Check if filename has teaser-{id}- prefix pattern
        const teaserMatch = filename.match(/^teaser-[a-f0-9]+-(.+)$/);
        if (teaserMatch) {
          // Replace the filename with the version without teaser prefix
          const fallbackFilename = teaserMatch[1];
          const fallbackUrlParts = [...urlParts];
          fallbackUrlParts[fallbackUrlParts.length - 1] = fallbackFilename;
          return fallbackUrlParts.join('/');
        }

        return null; // No fallback possible
      }

      // Start with the original URL
      attemptDownload(imageUrl);
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

  // After successful extraction, check for linked content stores
  const hierarchyFile = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
  await extractLinkedContentStores(hierarchyFile);

  // Force clean exit
  process.exit(0);
}).catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
});
