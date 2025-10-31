#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get content store name from command line arguments
const contentStoreName = process.argv[2];

if (!contentStoreName) {
  console.error('❌ Usage: node extract-and-compare-linkurls.js <content-store-name>');
  console.error('   Example: node extract-and-compare-linkurls.js all-content-stores__global-coca-cola-uplift');
  process.exit(1);
}

// File paths
const baseDir = `${contentStoreName}/extracted-results`;
const jcrContentFile = path.join(baseDir, 'jcr-content.json');
const tabsModelFile = path.join(baseDir, 'most-comprehensive-tabs.model.json');
const hierarchyFile = path.join(baseDir, 'hierarchy-structure.json');

/**
 * Normalize URL by removing protocol, domain, and file extension
 * @param {string} url - The URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  // Remove protocol and domain
  let normalized = url.replace(/^https?:\/\/[^\/]+/, '');
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
  let match;

  while ((match = hrefRegex.exec(htmlText)) !== null) {
    const url = match[1];
    // Only include if it looks like a valid URL (starts with http, https, or /)
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      hrefUrls.push(url);
    }
  }

  return hrefUrls;
}

/**
 * Recursively extract all URL values from a JSON object and normalize them
 * Extracts from: linkURL, url keys, and href attributes in text content
 * @param {any} obj - The object to search
 * @param {Set<string>} linkUrls - Set to store found normalized URL values
 * @param {Map<string, string>} originalUrls - Map to store normalized -> original URL mapping
 */
function extractLinkUrls(obj, linkUrls, originalUrls) {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => extractLinkUrls(item, linkUrls, originalUrls));
  } else {
    Object.keys(obj).forEach((key) => {
      if (key === 'linkURL' && typeof obj[key] === 'string') {
        const original = obj[key];
        const normalized = normalizeUrl(original);
        linkUrls.add(normalized);
        originalUrls.set(normalized, original);
      } else if (key === 'url' && typeof obj[key] === 'string') {
        const original = obj[key];
        const normalized = normalizeUrl(original);
        linkUrls.add(normalized);
        originalUrls.set(normalized, original);
      } else if (key === 'text' && typeof obj[key] === 'string') {
        // Extract href URLs from HTML text content
        const hrefUrls = extractHrefUrls(obj[key]);
        hrefUrls.forEach((url) => {
          const normalized = normalizeUrl(url);
          linkUrls.add(normalized);
          originalUrls.set(normalized, url);
        });
      } else {
        extractLinkUrls(obj[key], linkUrls, originalUrls);
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
 * Main function to extract and compare linkURLs
 */
function main() {
  console.log(`🔍 Extracting linkURL values from: ${contentStoreName}`);
  console.log(`📁 Base directory: ${baseDir}\n`);

  // Check if base directory exists
  if (!fs.existsSync(baseDir)) {
    console.error(`❌ Directory not found: ${baseDir}`);
    console.error('💡 Make sure the content store name is correct and the extracted-results directory exists.');
    process.exit(1);
  }

  // Check if required files exist
  const requiredFiles = [
    { path: jcrContentFile, name: 'jcr-content.json' },
    { path: tabsModelFile, name: 'most-comprehensive-tabs.model.json' },
    { path: hierarchyFile, name: 'hierarchy-structure.json' },
  ];

  const missingFiles = requiredFiles.filter((file) => !fs.existsSync(file.path));
  if (missingFiles.length > 0) {
    console.error('❌ Missing required files:');
    missingFiles.forEach((file) => console.error(`   - ${file.name}: ${file.path}`));
    process.exit(1);
  }

  // Load JSON files
  const jcrContentData = loadJsonFile(jcrContentFile);
  const tabsModelData = loadJsonFile(tabsModelFile);
  const hierarchyData = loadJsonFile(hierarchyFile);

  if (!jcrContentData || !tabsModelData || !hierarchyData) {
    console.error('❌ Failed to parse one or more JSON files');
    process.exit(1);
  }

  // Extract linkURLs from each file
  const jcrContentLinks = new Set();
  const tabsModelLinks = new Set();
  const hierarchyLinks = new Set();

  // Maps to store original URLs (normalized -> original)
  const jcrOriginalUrls = new Map();
  const tabsOriginalUrls = new Map();
  const hierarchyOriginalUrls = new Map();

  extractLinkUrls(jcrContentData, jcrContentLinks, jcrOriginalUrls);
  extractLinkUrls(tabsModelData, tabsModelLinks, tabsOriginalUrls);
  extractLinkUrls(hierarchyData, hierarchyLinks, hierarchyOriginalUrls);

  // Convert sets to sorted arrays for better readability
  const sortedJcrLinks = Array.from(jcrContentLinks).sort();
  const sortedTabsLinks = Array.from(tabsModelLinks).sort();
  const sortedHierarchyLinks = Array.from(hierarchyLinks).sort();

  // Combine linkURLs from jcr-content.json and tabs model
  const combinedSourceLinks = new Set([...jcrContentLinks, ...tabsModelLinks]);
  const sortedCombinedLinks = Array.from(combinedSourceLinks).sort();

  // Create a map to track which file each URL came from
  const urlToSourceFile = new Map();

  // DEBUG: Track URL conflicts (URLs that appear in both files)
  const urlConflicts = [];

  jcrContentLinks.forEach((url) => urlToSourceFile.set(url, 'jcr-content.json'));
  tabsModelLinks.forEach((url) => {
    if (urlToSourceFile.has(url)) {
      urlConflicts.push(url);
    }
    urlToSourceFile.set(url, 'most-comprehensive-tabs.model.json');
  });

  // Display results
  console.log('📊 EXTRACTION RESULTS');
  console.log('====================');
  console.log(`📄 jcr-content.json: ${sortedJcrLinks.length} unique linkURLs`);
  console.log(`📄 most-comprehensive-tabs.model.json: ${sortedTabsLinks.length} unique linkURLs`);
  console.log(`📄 hierarchy-structure.json: ${sortedHierarchyLinks.length} unique linkURLs`);
  console.log(`📄 Combined source files: ${sortedCombinedLinks.length} unique linkURLs\n`);

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
      urls.slice(0, 3).forEach((url, index) => {
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
    extraInHierarchy.slice(0, 3).forEach((url, index) => {
      const originalUrl = hierarchyOriginalUrls.get(url) || url;
      console.log(`   ${index + 1}. ${originalUrl}`);
    });
  }

  // Summary statistics
  console.log('\n📈 SUMMARY STATISTICS');
  console.log('====================');
  console.log(`Total unique linkURLs across all files: ${new Set([...combinedSourceLinks, ...hierarchyLinks]).size}`);
  console.log(`URL match overlap: ${(commonUrls.length / Math.max(sortedCombinedLinks.length, sortedHierarchyLinks.length) * 100).toFixed(1)}%`);

  const hasMissingUrls = missingInHierarchy.length > 0 || extraInHierarchy.length > 0;

  if (commonUrls.length === Math.min(sortedCombinedLinks.length, sortedHierarchyLinks.length) && !hasMissingUrls) {
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

  // Exit with error code if there are missing URLs
  if (hasMissingUrls) {
    console.log('❌ Exiting with code 1 due to missing URLs');
    process.exit(1);
  } else {
    console.log('✅ Exiting with code 0 - perfect match');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractLinkUrls, loadJsonFile };
