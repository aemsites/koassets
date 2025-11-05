#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Find all directories matching the pattern *-content-stores*
 * @returns {string[]} Array of matching directory names
 */
function findContentStoreDirectories() {
  const currentDir = process.cwd();
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && entry.name.includes('-content-stores'))
    .map((entry) => entry.name)
    .sort();
}

// Parse command line arguments
const args = process.argv.slice(2);
const showAll = args.includes('--all');
const contentStoreName = args.find((arg) => !arg.startsWith('--'));
let contentStoreNames = [];

if (!contentStoreName) {
  // If no argument provided, find all *-content-stores* directories
  contentStoreNames = findContentStoreDirectories();

  if (contentStoreNames.length === 0) {
    console.error('❌ No directories matching pattern "*-content-stores*" found');
    console.error('💡 Make sure you are running this script from the directory containing content store folders.');
    process.exit(1);
  }

  console.log(`📂 No content store specified. Found ${contentStoreNames.length} content store(s):`);
  contentStoreNames.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
  });
  if (showAll) {
    console.log('📋 Show all mode: enabled\n');
  } else {
    console.log('📋 Show mode: first 3 URLs (use --all to see all)\n');
  }
} else {
  // If argument provided, use just that one
  contentStoreNames = [contentStoreName];
  if (showAll) {
    console.log('📋 Show all mode: enabled\n');
  }
}

/**
 * Normalize URL by removing protocol and domain
 * @param {string} url - The URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  let normalized = url;

  // Strip protocol and domain - handles multiple cases:
  // - https://example.com/path -> /path
  // - http://example.com/path -> /path
  // - //example.com/path -> /path
  // - example.com/path -> /path (if it contains domain-like pattern)

  // First, handle protocol-based URLs
  normalized = normalized.replace(/^https?:\/\/[^/]+/, '');

  // Handle protocol-relative URLs (//example.com/path)
  normalized = normalized.replace(/^\/\/[^/]+/, '');

  // If URL doesn't start with / after above replacements, it might be a bare domain
  // Check if it looks like a domain (contains dots and doesn't start with /)
  if (!normalized.startsWith('/') && /^[^/]*\.[^/]+\//.test(normalized)) {
    // Extract path after first slash
    normalized = normalized.substring(normalized.indexOf('/'));
  }

  // Ensure we have at least a / if we ended up with empty string
  if (!normalized) {
    normalized = '/';
  }

  // Decode HTML entities to ensure consistent comparison
  // Use a more robust approach to avoid double-unescaping issues
  const entityMap = {
    '&quot;': '"',
    '&#39;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&', // Must be last to avoid double-decoding
  };

  // Replace entities in order, with &amp; last
  Object.keys(entityMap).forEach((entity) => {
    if (entity !== '&amp;') {
      normalized = normalized.replace(new RegExp(entity, 'g'), entityMap[entity]);
    }
  });
  // Finally replace &amp; only if it's not part of another entity
  normalized = normalized.replace(/&amp;(?!quot;|#39;|lt;|gt;)/g, '&');

  return normalized;
}

/**
 * Extract href URLs from HTML text content
 * @param {string} htmlText - HTML content to parse
 * @returns {string[]} Array of found href URLs
 */
function extractHrefUrls(htmlText) {
  const hrefUrls = [];

  // Regular expression to match href attributes in HTML
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match = hrefRegex.exec(htmlText);

  while (match !== null) {
    const url = match[1];
    // Only include if it looks like a valid URL (starts with http, https, or /)
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      hrefUrls.push(url);
    }
    match = hrefRegex.exec(htmlText);
  }

  return hrefUrls;
}

/**
 * Recursively extract all URL values from a JSON object and normalize them
 * Extracts from: linkURL, url, analyticsUrl, xdm:linkURL, imageResourceUrl,
 * storageUrl, clickableUrl keys, and href attributes in text content
 * Counts unique (URL, key) combinations: same URL with same key only counts once
 * @param {any} obj - The object to search
 * @param {Map<string, Set<string>>} linkUrlKeys - Map to store normalized URL -> Set of keys
 * @param {Map<string, string>} originalUrls - Map to store normalized -> original URL mapping
 */
function extractLinkUrls(obj, linkUrlKeys, originalUrls) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractLinkUrls(item, linkUrlKeys, originalUrls));
  } else {
    Object.keys(obj).forEach((key) => {
      const urlKeys = ['linkURL', 'url', 'analyticsUrl', 'clickableUrl', 'xdm:linkURL', 'imageResourceUrl'];
      if (urlKeys.includes(key) && typeof obj[key] === 'string') {
        const original = obj[key];
        // Skip 'hh' values
        if (original === 'hh') {
          return;
        }
        const normalized = normalizeUrl(original);
        if (!linkUrlKeys.has(normalized)) {
          linkUrlKeys.set(normalized, new Set());
        }
        linkUrlKeys.get(normalized).add(key);
        originalUrls.set(normalized, original);
      } else if (key === 'text' && typeof obj[key] === 'string') {
        // Extract href URLs from HTML text content
        const hrefUrls = extractHrefUrls(obj[key]);
        hrefUrls.forEach((url) => {
          // Skip 'hh' values
          if (url === 'hh') {
            return;
          }
          const normalized = normalizeUrl(url);
          if (!linkUrlKeys.has(normalized)) {
            linkUrlKeys.set(normalized, new Set());
          }
          linkUrlKeys.get(normalized).add('href');
          originalUrls.set(normalized, url);
        });
      } else {
        extractLinkUrls(obj[key], linkUrlKeys, originalUrls);
      }
    });
  }
}

/**
 * Load and parse JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {any} Parsed JSON object
 */
function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Process a single content store
 * @param {string} storeName - The content store name to process
 * @returns {boolean} True if successful, false if there were issues
 */
function processContentStore(storeName) {
  const baseDir = `${storeName}/extracted-results`;
  const cachesDir = path.join(baseDir, 'caches');
  const hierarchyFile = path.join(baseDir, 'hierarchy-structure.json');

  console.log(`🔍 Extracting linkURL values from: ${storeName}`);
  console.log(`📁 Base directory: ${baseDir}\n`);

  // Check if base directory exists
  if (!fs.existsSync(baseDir)) {
    console.log(`⚠️  Skipping - directory not found: ${baseDir}`);
    console.log('💡 Make sure the content store name is correct and the extracted-results directory exists.');
    return true; // Skip but don't treat as failure
  }

  // Check if caches directory exists
  if (!fs.existsSync(cachesDir)) {
    console.log(`⚠️  Skipping - caches directory not found: ${cachesDir}`);
    return true; // Skip but don't treat as failure
  }

  // Find all tabs*.json files in caches directory
  const tabsFiles = fs.readdirSync(cachesDir)
    .filter((file) => file.startsWith('tabs') && file.endsWith('.json'))
    .map((file) => path.join(cachesDir, file))
    .sort();

  if (tabsFiles.length === 0) {
    console.log(`⚠️  Skipping - no tabs*.json files found in: ${cachesDir}`);
    return true; // Skip but don't treat as failure
  }

  // Find all other JSON files in caches directory (non-tabs files)
  const otherCacheFiles = fs.readdirSync(cachesDir)
    .filter((file) => !file.startsWith('tabs') && file.endsWith('.json'))
    .map((file) => path.join(cachesDir, file))
    .sort();

  // Check if hierarchy file exists
  if (!fs.existsSync(hierarchyFile)) {
    console.log(`⚠️  Skipping - hierarchy file not found: ${hierarchyFile}`);
    return true; // Skip but don't treat as failure
  }

  console.log(`📄 Found ${tabsFiles.length} tabs*.json file(s):`);
  tabsFiles.forEach((file) => {
    console.log(`   - ${path.basename(file)}`);
  });
  console.log('');

  // Load hierarchy file
  const hierarchyData = loadJsonFile(hierarchyFile);
  if (!hierarchyData) {
    console.log('⚠️  Skipping - failed to parse hierarchy file');
    return true; // Skip but don't treat as failure
  }

  // Extract linkURLs from tabs files
  const tabsUrlKeys = new Map();
  const tabsOriginalUrls = new Map();

  tabsFiles.forEach((tabsFile) => {
    const tabsData = loadJsonFile(tabsFile);
    if (tabsData) {
      extractLinkUrls(tabsData, tabsUrlKeys, tabsOriginalUrls);
    }
  });

  // Extract linkURLs from other cache files (if any)
  const otherCacheUrlKeys = new Map();
  const otherCacheOriginalUrls = new Map();

  if (otherCacheFiles.length > 0) {
    otherCacheFiles.forEach((cacheFile) => {
      const cacheData = loadJsonFile(cacheFile);
      if (cacheData) {
        extractLinkUrls(cacheData, otherCacheUrlKeys, otherCacheOriginalUrls);
      }
    });
  }

  // Extract linkURLs from hierarchy file
  const hierarchyUrlKeys = new Map();
  const hierarchyOriginalUrls = new Map();
  extractLinkUrls(hierarchyData, hierarchyUrlKeys, hierarchyOriginalUrls);

  // Get unique URLs from each source
  const tabsLinks = new Set(tabsUrlKeys.keys());
  const hierarchyLinks = new Set(hierarchyUrlKeys.keys());

  // Calculate total occurrences (count unique URL+key combinations)
  const tabsTotal = Array.from(tabsUrlKeys.values())
    .reduce((sum, keySet) => sum + keySet.size, 0);
  const hierarchyTotal = Array.from(hierarchyUrlKeys.values())
    .reduce((sum, keySet) => sum + keySet.size, 0);

  // Convert sets to sorted arrays for better readability
  const sortedTabsLinks = Array.from(tabsLinks).sort();
  const sortedHierarchyLinks = Array.from(hierarchyLinks).sort();

  // Display results
  console.log('📊 EXTRACTION RESULTS');
  console.log('====================');
  console.log(`📄 tabs*.json files: ${sortedTabsLinks.length} unique linkURLs (${tabsTotal} total)`);
  console.log(`📄 hierarchy-structure.json: ${sortedHierarchyLinks.length} unique linkURLs (${hierarchyTotal} total)`);

  // Calculate URL differences (don't print yet, need to check other cache files first)
  // Find URLs that are in tabs but not in hierarchy
  const missingInHierarchy = sortedTabsLinks.filter((url) => !hierarchyLinks.has(url));

  // Find URLs that are in hierarchy but not in tabs
  const extraInHierarchy = sortedHierarchyLinks.filter((url) => !tabsLinks.has(url));

  // Find URLs that are common between tabs and hierarchy
  const commonUrls = sortedTabsLinks.filter((url) => hierarchyLinks.has(url));

  // Check other cache files first if there are URLs in hierarchy but not in tabs
  let extraNotInAnyCache = extraInHierarchy;

  if (extraInHierarchy.length > 0 && otherCacheFiles.length > 0) {
    // Filter out URLs that are found in other cache files
    extraNotInAnyCache = extraInHierarchy.filter((url) => !otherCacheUrlKeys.has(url));
  }

  // NOW print the comparison analysis after checking all sources
  console.log('\n🔍 COMPARISON ANALYSIS');
  console.log('======================');

  const hasMismatches = missingInHierarchy.length > 0 || extraNotInAnyCache.length > 0;

  if (!hasMismatches) {
    console.log('✅ All matched');
  } else {
    // Report URLs in tabs but not in hierarchy
    if (missingInHierarchy.length > 0) {
      console.log(`\n⚠️  linkURLs in tabs*.json but MISSING FROM ${hierarchyFile}: ${missingInHierarchy.length}`);
      const urlsToShow = showAll ? missingInHierarchy : missingInHierarchy.slice(0, 3);
      urlsToShow.forEach((url, index) => {
        const originalUrl = tabsOriginalUrls.get(url) || url;
        console.log(`   ${index + 1}. ${url}`);
        if (originalUrl !== url) {
          console.log(`       (original: ${originalUrl})`);
        }
      });
      if (!showAll && missingInHierarchy.length > 3) {
        console.log(`      ... and ${missingInHierarchy.length - 3} more (use --all to see all)`);
      }
    }

    // Report URLs in hierarchy but not in ANY cache file
    if (extraNotInAnyCache.length > 0) {
      console.log(`\n🆕 linkURLs in ${hierarchyFile} but MISSING FROM all cache files: ${extraNotInAnyCache.length}`);
      const urlsToShow = showAll ? extraNotInAnyCache : extraNotInAnyCache.slice(0, 3);
      urlsToShow.forEach((url, index) => {
        const originalUrl = hierarchyOriginalUrls.get(url) || url;
        console.log(`   ${index + 1}. ${url}`);
        if (originalUrl !== url) {
          console.log(`       (original: ${originalUrl})`);
        }
      });
      if (!showAll && extraNotInAnyCache.length > 3) {
        console.log(`      ... and ${extraNotInAnyCache.length - 3} more (use --all to see all)`);
      }
    }
  }

  // Count validation - check that hierarchy count matches source files
  console.log('\n🔢 COUNT VALIDATION');
  console.log('===================');

  const countMismatches = [];
  hierarchyLinks.forEach((url) => {
    const tabsKeySet = tabsUrlKeys.get(url);
    const otherCacheKeySet = otherCacheUrlKeys.get(url);
    const hierarchyKeySet = hierarchyUrlKeys.get(url);
    const tabsCount = tabsKeySet ? tabsKeySet.size : 0;
    const otherCacheCount = otherCacheKeySet ? otherCacheKeySet.size : 0;
    const hierarchyCount = hierarchyKeySet ? hierarchyKeySet.size : 0;

    // Hierarchy count should match tabs count,
    // or if tabs is 0, should match other cache count
    const matchesTabs = hierarchyCount === tabsCount;
    const matchesOtherCache = (tabsCount === 0
      && otherCacheCount > 0
      && hierarchyCount === otherCacheCount);

    if (!matchesTabs && !matchesOtherCache) {
      countMismatches.push({
        url,
        tabsCount,
        otherCacheCount,
        hierarchyCount,
        tabsKeys: tabsKeySet ? Array.from(tabsKeySet).join(', ') : '',
        otherCacheKeys: otherCacheKeySet ? Array.from(otherCacheKeySet).join(', ') : '',
        hierarchyKeys: hierarchyKeySet ? Array.from(hierarchyKeySet).join(', ') : '',
      });
    }
  });

  if (countMismatches.length === 0) {
    console.log('✅ All hierarchy URL counts match source files!');
  } else {
    console.log(`⚠️  Found ${countMismatches.length} URL(s) where hierarchy count doesn't match any source:\n`);
    const urlsToShow = showAll ? countMismatches : countMismatches.slice(0, 10);
    urlsToShow.forEach((mismatch, index) => {
      const originalUrl = hierarchyOriginalUrls.get(mismatch.url) || mismatch.url;
      // Show normalized URL (what's actually compared)
      console.log(`   ${index + 1}. ${mismatch.url}`);
      // Show original if different from normalized
      if (originalUrl !== mismatch.url) {
        console.log(`       (original: ${originalUrl})`);
      }
      console.log(`      tabs*.json: ${mismatch.tabsCount} (keys: ${mismatch.tabsKeys})`);
      if (mismatch.otherCacheCount > 0) {
        console.log(`      other cache files: ${mismatch.otherCacheCount} (keys: ${mismatch.otherCacheKeys})`);
      }
      console.log(`      ${hierarchyFile}: ${mismatch.hierarchyCount} (keys: ${mismatch.hierarchyKeys}) ❌`);
    });
    if (!showAll && countMismatches.length > 10) {
      console.log(`      ... and ${countMismatches.length - 10} more (use --all to see all)`);
    }

    // Fail immediately on count mismatches
    console.log(`\n❌ VALIDATION FAILED: ${countMismatches.length} URL(s) have invalid counts in hierarchy`);
    console.log('❌ Exiting with code 1 due to count mismatches');
    return false;
  }

  // Summary statistics
  console.log('\n📈 SUMMARY STATISTICS');
  console.log('====================');
  const totalUniqueUrls = new Set([...tabsLinks, ...hierarchyLinks]).size;
  console.log(`Total unique linkURLs across all files: ${totalUniqueUrls}`);
  const maxLength = Math.max(sortedTabsLinks.length, sortedHierarchyLinks.length);
  const overlapPercentage = (commonUrls.length / maxLength) * 100;
  console.log(`URL match overlap: ${overlapPercentage.toFixed(1)}%`);

  const hasMissingUrls = missingInHierarchy.length > 0 || extraNotInAnyCache.length > 0;
  const hasCountMismatches = countMismatches.length > 0;

  // Consider it a perfect match if all hierarchy URLs are in SOME cache file
  // (either tabs or other cache files) and counts match
  const allHierarchyUrlsFound = extraNotInAnyCache.length === 0 && missingInHierarchy.length === 0;
  const isPerfectMatch = allHierarchyUrlsFound && !hasCountMismatches;
  if (isPerfectMatch) {
    console.log('✅ Perfect match! All linkURLs are functionally equivalent with valid counts.');
  } else {
    if (missingInHierarchy.length > 0) {
      console.log(`⚠️  ${missingInHierarchy.length} linkURL(s) from tabs*.json are MISSING FROM ${hierarchyFile}`);
    }
    if (extraNotInAnyCache.length > 0) {
      console.log(`🆕 ${extraNotInAnyCache.length} linkURL(s) from ${hierarchyFile} are MISSING FROM all cache files`);
    }
    if (hasCountMismatches) {
      console.log(`🔢 ${countMismatches.length} linkURL(s) in ${hierarchyFile} have INVALID COUNTS (don't match any source)`);
    }
  }

  console.log('\n✨ Analysis complete!');

  // Return status based on missing URLs or count mismatches
  if (hasMissingUrls) {
    console.log('❌ Found missing URLs');
    return false;
  }
  console.log('✅ Perfect match');
  return true;
}

/**
 * Main function to process all content stores
 */
function main() {
  const results = [];

  contentStoreNames.forEach((storeName) => {
    const success = processContentStore(storeName);
    results.push({ storeName, success });

    // Exit immediately on failure
    if (!success) {
      console.log(`\n❌ Stopping due to failure in: ${storeName}`);
      process.exit(1);
    }

    // Add separator between content stores if processing multiple
    if (contentStoreNames.length > 1) {
      console.log(['', '='.repeat(80), ''].join('\n'));
    }
  });

  // Summary if processing multiple stores (only reached if all succeed)
  if (contentStoreNames.length > 1) {
    console.log('📊 OVERALL SUMMARY');
    console.log('==================');
    console.log(`✅ All ${contentStoreNames.length} content store(s) processed successfully`);
    console.log('');
  }

  // Exit with success code (only reached if all succeed)
  console.log('✅ Exiting with code 0 - all content stores processed successfully');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractLinkUrls, loadJsonFile };
