#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-syntax, max-len, import/no-extraneous-dependencies */
/**
 * Generate spreadsheet from hierarchy-structure.merged.json
 * Traverses the JSON from bottom up and creates a CSV with:
 * - path (replace '>' with '/', trim spaces)
 * - title
 * - type
 * - imageUrl (filename only, prepended with DA destination path from da-admin-client)
 * - linkURL
 * - text
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { PATH_SEPARATOR, DATA_DIR } = require('./constants.js');
const { sanitizeFileName } = require('./sanitize-utils.js');
const {
  DA_ORG, DA_REPO, DA_DEST, IMAGES_BASE,
} = require('./da-admin-client.js');

/**
 * Transforms search-assets.html URLs to new search format
 * Extracts 'fulltext' parameter, decodes it, and creates new URL
 * @param {string} url - The original URL
 * @returns {string} - Transformed URL or original if not a search-assets.html URL
 */
function transformSearchUrl(url) {
  if (!url || !url.includes('search-assets.html')) {
    return url;
  }

  try {
    // Parse the URL to extract query parameters
    const urlObj = new URL(url, 'https://dummy.com'); // Need base URL for relative URLs
    const fulltext = urlObj.searchParams.get('fulltext');

    if (fulltext) {
      // URL decode the fulltext parameter (handle &amp; in HTML)
      const decodedFullText = decodeURIComponent(fulltext.replace(/&amp;/g, '&'));
      return `/search/all?query=${encodeURIComponent(decodedFullText)}`;
    }
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn(`Failed to parse URL: ${url}`);
  }

  return url;
}

/**
 * Transforms content store URLs from old format to new format
 * /content/share/us/en/bottler-content-stores/coke-holiday-2025.html → ${DA_DEST}/content-stores/bottler-content-stores-coke-holiday-2025
 * @param {string} url - The original URL
 * @returns {string} - Transformed URL or original if not a content store URL
 */
function transformContentStoreUrl(url) {
  if (!url) return url;

  // Match /content/share/us/en/*-content-stores/*.html
  const contentStorePattern = /^\/content\/share\/us\/en\/((?:all|bottler)-content-stores\/[^.]+)\.html$/;
  const match = url.match(contentStorePattern);

  if (match) {
    // Replace slashes with hyphens in the store path
    const storePath = match[1].replace(/\//g, '-');

    // Add DA_DEST prefix with leading slash if it exists
    const prefix = DA_DEST && DA_DEST.trim() ? `/${DA_DEST}` : '';
    return `${prefix}/content-stores/${storePath}`;
  }

  return url;
}

/**
 * Transforms all search-assets.html URLs within text/HTML content
 * @param {string} text - The text or HTML content
 * @returns {string} - Text with transformed URLs
 */
function transformSearchUrlsInText(text) {
  if (!text || !text.includes('search-assets.html')) {
    return text;
  }

  // For very large text fields, use a more efficient approach to avoid regex catastrophic backtracking
  if (text.length > 100000) {
    console.log(`   ⚠️  Processing large text field (${text.length} chars) with optimized approach...`);

    // Process text in chunks to avoid regex performance issues
    const chunkSize = 50000; // Process 50KB at a time
    let result = '';

    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, Math.min(i + chunkSize, text.length));

      // Use a simpler, more efficient regex that matches href="...search-assets.html..."
      // This avoids the problematic [^"'\s]* pattern that causes backtracking
      const urlPattern = /href=(["'])([^"']*search-assets\.html[^"']*)["']/gi;

      const transformedChunk = chunk.replace(urlPattern, (match, quote, url) => {
        // Decode HTML entities in URL
        const decodedUrl = url.replace(/&amp;/g, '&');
        const transformedUrl = transformSearchUrl(decodedUrl);
        return `href=${quote}${transformedUrl}${quote}`;
      });

      result += transformedChunk;
    }

    return result;
  }

  // For normal-sized text, use the original pattern
  // Match URLs in href attributes and standalone URLs
  // Pattern matches: href="URL" or href='URL' or standalone https://...search-assets.html...
  const urlPattern = /((?:href=["'])?)([^"'\s]*search-assets\.html[^"'\s]*)(["']?)/gi;

  return text.replace(urlPattern, (match, prefix, url, suffix) => {
    // Decode HTML entities in URL
    const decodedUrl = url.replace(/&amp;/g, '&');
    const transformedUrl = transformSearchUrl(decodedUrl);
    return prefix + transformedUrl + suffix;
  });
}

/**
 * Extracts link URL from item, supporting both old and new formats
 * @returns {string} The link URL
 */
function extractLinkUrl(item) {
  let url = '';

  // Check linkSources first (new format)
  if (item.linkSources && typeof item.linkSources === 'object') {
    if (item.linkSources.clickableUrl) {
      url = item.linkSources.clickableUrl;
    }
  }

  // Fallback to linkURL (old format)
  if (!url) {
    url = item.linkURL ?? '';
  }

  // Transform search-assets.html URLs to new format
  url = transformSearchUrl(url);

  // Transform content store URLs to new format
  url = transformContentStoreUrl(url);

  return url;
}

/**
 * Displays help information
 */
function showHelp() {
  console.log(`
Generate CSV from hierarchy-structure.json files

USAGE:
  node generate-csv-from-hierarchy-json.js [options] [input-file] [output-file]

OPTIONS:
  -h, --help              Show this help message and exit

ARGUMENTS:
  input-file              Path to hierarchy-structure.json file (optional)
  output-file             Path to output CSV file (optional, only used with input-file)

BEHAVIOR:
  • With no arguments:
    Automatically finds and processes all matching files:
    - *-content-stores*/extracted-results/hierarchy-structure.json
    
    Outputs CSV files to: <store-name>/derived-results/hierarchy-structure.csv

  • With input-file only:
    Processes the specified input file.
    Outputs to: <store-name>/derived-results/hierarchy-structure.csv

  • With input-file and output-file:
    Processes the specified input file.
    Outputs to the specified output file path.

EXAMPLES:
  # Process all matching files automatically
  node generate-csv-from-hierarchy-json.js

  # Process a specific file (outputs to its derived-results directory)
  node generate-csv-from-hierarchy-json.js ./all-content-stores/extracted-results/hierarchy-structure.json

  # Process a specific file with custom output location
  node generate-csv-from-hierarchy-json.js input.json output.csv

OUTPUT:
  CSV file with columns:
  - path: Navigation path (using '>>>' separator)
  - title: Item title
  - imageUrl: DA Live URL for the image
  - linkURL: Link URL if present
  - type: Item/Link type ('accordion', 'button', 'link', or '' for legacy)
  - text: Plain text content (HTML stripped)

CONFIGURATION:
  Imports configuration from: ./da-admin-client.js
  - DA_ORG: DA organization
  - DA_REPO: DA repository
  - DA_DEST: DA destination path prefix
`);
}

/**
 * Constructs the full destination path from DA config
 */
function getDestinationPath() {
  // Build base path: org/repo
  let destPath = `${DA_ORG}/${DA_REPO}`;

  // Append DA_DEST if it exists
  if (DA_DEST && DA_DEST.trim()) {
    const dest = DA_DEST.trim();
    // Ensure proper path separators
    destPath += dest.startsWith('/') ? dest : `/${dest}`;
  }

  return destPath;
}

/**
 * Converts HTML to plain text by:
 * 1. Removing HTML tags
 * 2. Decoding HTML entities
 * 3. Normalizing whitespace
 */
function htmlToPlainText(html) {
  if (!html) return '';

  let text = html;

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  Object.entries(entities).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'g'), char);
  });

  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Normalize whitespace
  text = text.replace(/\r\n/g, ' ');
  text = text.replace(/\n/g, ' ');
  text = text.replace(/\s+/g, ' ');
  text = text.trim();

  return text;
}

/**
 * Formats path by trimming spaces around '>' separators
 * Keep '>' as separator to avoid conflicts with '/' in titles
 */
function formatPath(pathStr) {
  if (!pathStr) return '';

  return pathStr
    .split('>')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(PATH_SEPARATOR);
}

/**
 * Extracts filename from a URL path
 */
function extractFilename(url) {
  if (!url) return '';

  // Extract the filename from the path
  const parts = url.split('/');
  const filename = parts[parts.length - 1];

  return filename;
}

/**
 * Formats imageUrl by extracting filename and prepending with full DA Live URL
 * Returns empty string if the sanitized file doesn't exist in extracted-results/images
 */
function formatImageUrl(imageUrl, destPath, storeName) {
  if (!imageUrl) return '';

  const filename = extractFilename(imageUrl);
  const sanitizedFilename = sanitizeFileName(filename);

  // Check if the sanitized file exists in the images directory
  const imagePath = path.join(__dirname, DATA_DIR, storeName, 'extracted-results', 'images', sanitizedFilename);
  if (!fs.existsSync(imagePath)) {
    return '';
  }

  return `https://content.da.live/${destPath}/${IMAGES_BASE}${storeName}/${sanitizedFilename}`;
}

/**
 * Escapes CSV field value
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';

  const strValue = String(value);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * Converts an item to a CSV row
 */
function itemToRow(item, destPath, storeName) {
  const linkUrl = extractLinkUrl(item);
  // Transform search URLs in text content
  const transformedText = transformSearchUrlsInText(item.text || '');
  return [
    escapeCsvField(formatPath(item.path || '')),
    escapeCsvField(item.title || ''),
    escapeCsvField(formatImageUrl(item.imageUrl || '', destPath, storeName)),
    escapeCsvField(linkUrl),
    escapeCsvField(item.type || ''),
    escapeCsvField(transformedText),
    escapeCsvField(item.synonym || ''),
  ].join(',');
}

/**
 * Traverses the hierarchy in the same order as JSON (parent first, then children)
 * and collects all items, including accordions and their children
 */
function traverseInOrder(items, result = []) {
  if (!items || !Array.isArray(items)) return result;

  for (const item of items) {
    // Add the current item first (including accordions)
    result.push(item);

    // Then process children (maintaining JSON order)
    if (item.items && Array.isArray(item.items)) {
      traverseInOrder(item.items, result);
    }
  }

  return result;
}

/**
 * Processes a single input file and generates CSV
 */
function processFile(inputFile, outputFile) {
  // Extract store name from inputFile (e.g., 'all-content-stores' from './all-content-stores/extracted-results/...')
  const storeName = path.basename(path.dirname(path.dirname(inputFile)));

  // Get DA destination path
  const destPath = getDestinationPath();

  console.log(`\n📄 Processing: ${inputFile}`);
  console.log(`   Store name: ${storeName}`);
  console.log(`   Destination path: ${destPath}`);

  const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  console.log('   Traversing hierarchy in original order...');
  const items = traverseInOrder(jsonData.items || []);

  console.log(`   Found ${items.length} items`);

  // Items are already in the order from the JSON hierarchy (top-down traversal)
  // No sorting needed - maintain the original order

  // Create CSV content
  const headers = ['path', 'title', 'imageUrl', 'linkURL', 'type', 'text', 'synonym'];
  const csvLines = [headers.join(',')];

  items.forEach((item) => {
    csvLines.push(itemToRow(item, destPath, storeName));
  });

  const csvContent = csvLines.join('\n');

  // Write to output file
  console.log(`   Writing to: ${outputFile}`);
  fs.writeFileSync(outputFile, csvContent, 'utf8');

  console.log('   ✅ Successfully generated spreadsheet!');
  console.log(`   Total rows: ${items.length}`);
}

/**
 * Finds all matching hierarchy-structure.json files
 */
function findInputFiles() {
  const pattern = `${DATA_DIR}/*-content-stores*/extracted-results/hierarchy-structure.json`;
  const matches = globSync(pattern, { cwd: __dirname });
  return matches.map((f) => path.join(__dirname, f));
}

/**
 * Main function
 */
function main() {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('-h') || args.includes('--help')) {
      showHelp();
      process.exit(0);
    }

    if (args.length > 0) {
      // Process the file specified in command line
      const inputFile = path.resolve(args[0]);

      if (!fs.existsSync(inputFile)) {
        console.error(`❌ Error: Input file not found: ${inputFile}`);
        process.exit(1);
      }

      // Determine output file path
      const outputFile = args.length > 1
        ? path.resolve(args[1])
        : (() => {
          // Place in ../derived-results relative to the input file's directory
          const inputDir = path.dirname(inputFile);
          const storeDir = path.dirname(inputDir);
          const derivedDir = path.join(storeDir, 'derived-results');
          // Create derived-results directory if it doesn't exist
          if (!fs.existsSync(derivedDir)) {
            fs.mkdirSync(derivedDir, { recursive: true });
          }
          return path.join(derivedDir, 'hierarchy-structure.csv');
        })();

      processFile(inputFile, outputFile);
    } else {
      // No arguments provided - process all matching files
      console.log('No input file specified. Processing all matching files...');
      const inputFiles = findInputFiles();

      if (inputFiles.length === 0) {
        console.error('❌ No matching files found.');
        console.error('   Looking for:');
        console.error('   - *-content-stores*/extracted-results/hierarchy-structure.json');
        process.exit(1);
      }

      console.log(`Found ${inputFiles.length} file(s) to process.`);

      inputFiles.forEach((inputFile) => {
        // Place in ../derived-results relative to the input file's directory
        const inputDir = path.dirname(inputFile);
        const storeDir = path.dirname(inputDir);
        const derivedDir = path.join(storeDir, 'derived-results');

        // Create derived-results directory if it doesn't exist
        if (!fs.existsSync(derivedDir)) {
          fs.mkdirSync(derivedDir, { recursive: true });
        }

        const outputFile = path.join(derivedDir, 'hierarchy-structure.csv');

        try {
          processFile(inputFile, outputFile);
        } catch (error) {
          console.error(`❌ Error processing ${inputFile}:`, error.message);
        }
      });

      console.log('\n✅ All files processed!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getDestinationPath,
  htmlToPlainText,
  formatPath,
  formatImageUrl,
  traverseInOrder,
  processFile,
  findInputFiles,
};
