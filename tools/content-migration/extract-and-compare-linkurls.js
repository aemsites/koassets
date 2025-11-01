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
 * Normalize URL by removing protocol, domain, and file extension
 * @param {string} url - The URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  // Remove protocol and domain
  let normalized = url.replace(/^https?:\/\/[^/]+/, '');
  // Remove common file extensions only when they're at the very end of the path
  // Match extensions like .html, .php, .jsp, .asp, etc. but not query params like .limit=
  normalized = normalized.replace(/\.(html|htm|php|jsp|asp|aspx|cfm|do|action)(?=\?|$)/, '');
  // Decode HTML entities to ensure consistent comparison (e.g., &amp; -> &)
  normalized = normalized.replace(/&amp;/g, '&');
  normalized = normalized.replace(/&lt;/g, '<');
  normalized = normalized.replace(/&gt;/g, '>');
  normalized = normalized.replace(/&quot;/g, '"');
  normalized = normalized.replace(/&#39;/g, "'");
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
 * Extracts from: linkURL, url keys, and href attributes in text content
 * @param {any} obj - The object to search
 * @param {Map<string, number>} linkUrlCounts - Map to store normalized URL -> count
 * @param {Map<string, string>} originalUrls - Map to store normalized -> original URL mapping
 */
function extractLinkUrls(obj, linkUrlCounts, originalUrls) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractLinkUrls(item, linkUrlCounts, originalUrls));
  } else {
    Object.keys(obj).forEach((key) => {
      if (key === 'linkURL' && typeof obj[key] === 'string') {
        const original = obj[key];
        // Skip 'hh' values
        if (original === 'hh') {
          return;
        }
        const normalized = normalizeUrl(original);
        linkUrlCounts.set(normalized, (linkUrlCounts.get(normalized) || 0) + 1);
        originalUrls.set(normalized, original);
      } else if (key === 'url' && typeof obj[key] === 'string') {
        const original = obj[key];
        // Skip 'hh' values
        if (original === 'hh') {
          return;
        }
        const normalized = normalizeUrl(original);
        linkUrlCounts.set(normalized, (linkUrlCounts.get(normalized) || 0) + 1);
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
          linkUrlCounts.set(normalized, (linkUrlCounts.get(normalized) || 0) + 1);
          originalUrls.set(normalized, url);
        });
      } else {
        extractLinkUrls(obj[key], linkUrlCounts, originalUrls);
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
  const jcrContentFile = path.join(baseDir, 'jcr-content.json');
  const tabsModelFile = path.join(baseDir, 'most-comprehensive-tabs.model.json');
  const hierarchyFile = path.join(baseDir, 'hierarchy-structure.json');

  console.log(`🔍 Extracting linkURL values from: ${storeName}`);
  console.log(`📁 Base directory: ${baseDir}\n`);

  // Check if base directory exists
  if (!fs.existsSync(baseDir)) {
    console.log(`⚠️  Skipping - directory not found: ${baseDir}`);
    console.log('💡 Make sure the content store name is correct and the extracted-results directory exists.');
    return true; // Skip but don't treat as failure
  }

  // Check if required files exist
  const requiredFiles = [
    { path: jcrContentFile, name: 'jcr-content.json' },
    { path: tabsModelFile, name: 'most-comprehensive-tabs.model.json' },
    { path: hierarchyFile, name: 'hierarchy-structure.json' },
  ];

  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file.path));
  if (missingFiles.length > 0) {
    console.log('⚠️  Skipping - missing required files:');
    missingFiles.forEach((file) => console.log(`   - ${file.name}: ${file.path}`));
    return true; // Skip but don't treat as failure
  }

  // Load JSON files
  const jcrContentData = loadJsonFile(jcrContentFile);
  const tabsModelData = loadJsonFile(tabsModelFile);
  const hierarchyData = loadJsonFile(hierarchyFile);

  if (!jcrContentData || !tabsModelData || !hierarchyData) {
    console.log('⚠️  Skipping - failed to parse one or more JSON files');
    return true; // Skip but don't treat as failure
  }

  // Extract linkURLs from each file with counts
  const jcrContentCounts = new Map();
  const tabsModelCounts = new Map();
  const hierarchyCounts = new Map();

  // Maps to store original URLs (normalized -> original)
  const jcrOriginalUrls = new Map();
  const tabsOriginalUrls = new Map();
  const hierarchyOriginalUrls = new Map();

  extractLinkUrls(jcrContentData, jcrContentCounts, jcrOriginalUrls);
  extractLinkUrls(tabsModelData, tabsModelCounts, tabsOriginalUrls);
  extractLinkUrls(hierarchyData, hierarchyCounts, hierarchyOriginalUrls);

  // Get unique URLs from each file
  const jcrContentLinks = new Set(jcrContentCounts.keys());
  const tabsModelLinks = new Set(tabsModelCounts.keys());
  const hierarchyLinks = new Set(hierarchyCounts.keys());

  // Calculate total occurrences in source files
  const jcrTotal = Array.from(jcrContentCounts.values()).reduce((a, b) => a + b, 0);
  const tabsTotal = Array.from(tabsModelCounts.values()).reduce((a, b) => a + b, 0);
  const hierarchyTotal = Array.from(hierarchyCounts.values()).reduce((a, b) => a + b, 0);

  // Convert sets to sorted arrays for better readability
  const sortedJcrLinks = Array.from(jcrContentLinks).sort();
  const sortedTabsLinks = Array.from(tabsModelLinks).sort();
  const sortedHierarchyLinks = Array.from(hierarchyLinks).sort();

  // Combine linkURLs from jcr-content.json and tabs model
  const combinedSourceLinks = new Set([...jcrContentLinks, ...tabsModelLinks]);
  const sortedCombinedLinks = Array.from(combinedSourceLinks).sort();

  // Combine counts from source files
  const combinedSourceCounts = new Map();
  jcrContentCounts.forEach((count, url) => {
    combinedSourceCounts.set(url, (combinedSourceCounts.get(url) || 0) + count);
  });
  tabsModelCounts.forEach((count, url) => {
    combinedSourceCounts.set(url, (combinedSourceCounts.get(url) || 0) + count);
  });

  // Create a map to track which file each URL came from
  const urlToSourceFile = new Map();

  jcrContentLinks.forEach((url) => urlToSourceFile.set(url, 'jcr-content.json'));
  tabsModelLinks.forEach((url) => {
    if (urlToSourceFile.has(url)) {
      urlToSourceFile.set(url, 'both');
    } else {
      urlToSourceFile.set(url, 'most-comprehensive-tabs.model.json');
    }
  });

  // Display results
  console.log('📊 EXTRACTION RESULTS');
  console.log('====================');
  console.log(`📄 jcr-content.json: ${sortedJcrLinks.length} unique linkURLs (${jcrTotal} total)`);
  console.log(`📄 most-comprehensive-tabs.model.json: ${sortedTabsLinks.length} unique linkURLs (${tabsTotal} total)`);
  console.log(`📄 ==> Combined source files: ${sortedCombinedLinks.length} unique linkURLs\n`);
  console.log(`📄 hierarchy-structure.json: ${sortedHierarchyLinks.length} unique linkURLs (${hierarchyTotal} total)`);

  // Detailed breakdown
  // console.log('📋 DETAILED BREAKDOWN');
  // console.log('=====================\n');

  // console.log('🗃️  linkURLs from jcr-content.json:');
  // sortedJcrLinks.forEach((url, index) => {
  //  console.log(`   ${index + 1}. ${url}`);
  // });

  // console.log('\n🗃️  linkURLs from most-comprehensive-tabs.model.json:');
  // sortedTabsLinks.forEach((url, index) => {
  //   console.log(`   ${index + 1}. ${url}`);
  // });

  // console.log('\n🗃️  linkURLs from hierarchy-structure.json:');
  // sortedHierarchyLinks.forEach((url, index) => {
  //   console.log(`   ${index + 1}. ${url}`);
  // });

  // URLs are already normalized during extraction

  // Comparison analysis
  console.log('\n🔍 COMPARISON ANALYSIS');
  console.log('======================\n');

  // Find URLs that are in combined sources but not in hierarchy
  const missingInHierarchy = sortedCombinedLinks.filter((url) => !hierarchyLinks.has(url));

  // Find URLs that are in hierarchy but not in combined sources
  const extraInHierarchy = sortedHierarchyLinks.filter((url) => !combinedSourceLinks.has(url));

  // Find URLs that are common between combined sources and hierarchy
  const commonUrls = sortedCombinedLinks.filter((url) => hierarchyLinks.has(url));

  // Group missing URLs by source file
  if (missingInHierarchy.length > 0) {
    const missingByFile = {};
    missingInHierarchy.forEach((url) => {
      const sourceFile = urlToSourceFile.get(url) || 'unknown source';
      if (!missingByFile[sourceFile]) {
        missingByFile[sourceFile] = [];
      }
      missingByFile[sourceFile].push(url);
    });

    Object.entries(missingByFile).forEach(([sourceFile, urls]) => {
      const sourceFilePath = sourceFile === 'jcr-content.json' ? jcrContentFile : tabsModelFile;
      console.log(`\n⚠️  linkURLs in ${sourceFilePath} but MISSING FROM ${hierarchyFile}: ${urls.length}`);
      // console.log(`FROM ${sourceFilePath}, MISSING FROM ${hierarchyFile}:`);
      const urlsToShow = showAll ? urls : urls.slice(0, 3);
      urlsToShow.forEach((url, index) => {
        const originalUrl = sourceFile === 'jcr-content.json'
          ? (jcrOriginalUrls.get(url) || url)
          : (tabsOriginalUrls.get(url) || url);
        console.log(`   ${index + 1}. ${originalUrl}`);
      });
    });
  } else {
    console.log(`\n⚠️  linkURLs in ${jcrContentFile} + ${tabsModelFile} but MISSING FROM ${hierarchyFile}: 0`);
  }

  console.log(`\n🆕 linkURLs in ${hierarchyFile} but MISSING FROM ${jcrContentFile} + ${tabsModelFile}: ${extraInHierarchy.length}`);
  if (extraInHierarchy.length > 0) {
    // console.log(`FROM ${hierarchyFile}, MISSING FROM ${jcrContentFile} + ${tabsModelFile}:`);
    const urlsToShow = showAll ? extraInHierarchy : extraInHierarchy.slice(0, 3);
    urlsToShow.forEach((url, index) => {
      const originalUrl = hierarchyOriginalUrls.get(url) || url;
      console.log(`   ${index + 1}. ${originalUrl}`);
    });
  }

  // Summary statistics
  console.log('\n📈 SUMMARY STATISTICS');
  console.log('====================');
  const totalUniqueUrls = new Set([...combinedSourceLinks, ...hierarchyLinks]).size;
  console.log(`Total unique linkURLs across all files: ${totalUniqueUrls}`);
  const maxLength = Math.max(sortedCombinedLinks.length, sortedHierarchyLinks.length);
  const overlapPercentage = (commonUrls.length / maxLength) * 100;
  console.log(`URL match overlap: ${overlapPercentage.toFixed(1)}%`);

  const hasMissingUrls = missingInHierarchy.length > 0 || extraInHierarchy.length > 0;

  const minLength = Math.min(sortedCombinedLinks.length, sortedHierarchyLinks.length);
  const isPerfectMatch = commonUrls.length === minLength && !hasMissingUrls;
  if (isPerfectMatch) {
    console.log('✅ Perfect match! All linkURLs are functionally equivalent.');
  } else {
    if (missingInHierarchy.length > 0) {
      // Count missing URLs by source file
      const missingByFile = {};
      missingInHierarchy.forEach((url) => {
        const sourceFile = urlToSourceFile.get(url) || 'unknown source';
        missingByFile[sourceFile] = (missingByFile[sourceFile] || 0) + 1;
      });

      Object.entries(missingByFile).forEach(([file, count]) => {
        const sourceFilePath = file === 'jcr-content.json' ? jcrContentFile : tabsModelFile;
        console.log(`⚠️  ${count} linkURL(s) from ${sourceFilePath} are MISSING FROM ${hierarchyFile}`);
      });
    }
    if (extraInHierarchy.length > 0) {
      console.log(`🆕 ${extraInHierarchy.length} linkURL(s) from ${hierarchyFile} are MISSING FROM ${jcrContentFile} + ${tabsModelFile}`);
    }
  }

  console.log('\n✨ Analysis complete!');

  // Return status based on missing URLs
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

    // Add separator between content stores if processing multiple
    if (contentStoreNames.length > 1) {
      console.log(['', '='.repeat(80), ''].join('\n'));
    }
  });

  // Summary if processing multiple stores
  if (contentStoreNames.length > 1) {
    console.log('📊 OVERALL SUMMARY');
    console.log('==================');
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    if (failureCount > 0) {
      console.log('\n❌ Failed content stores:');
      results.filter((r) => !r.success).forEach((r, index) => {
        console.log(`   ${index + 1}. ${r.storeName}`);
      });
    }

    console.log('');
  }

  // Exit with appropriate code
  const anyFailures = results.some((r) => !r.success);
  if (anyFailures) {
    console.log('❌ Exiting with code 1 due to failures');
    process.exit(1);
  }
  console.log('✅ Exiting with code 0 - all content stores processed successfully');
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractLinkUrls, loadJsonFile };
