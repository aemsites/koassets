#!/usr/bin/env node

/**
 * Generate spreadsheet from hierarchy-structure.merged.json
 * Traverses the JSON from bottom up and creates a CSV with:
 * - path (replace '>' with '/', trim spaces)
 * - title
 * - type
 * - imageUrl (filename only, prepended with DA destination path from da.config)
 * - linkURL
 * - text
 */

const fs = require('fs');
const path = require('path');
const { PATH_SEPARATOR } = require('./constants');

// Input and output paths - read from and write to derived-results
const INPUT_FILE = path.join(__dirname, './all-content-stores/derived-results/hierarchy-structure.merged.json');
const OUTPUT_FILE = path.join(__dirname, './all-content-stores/derived-results/hierarchy-structure.merged.csv');
const CONFIG_FILE = path.join(__dirname, './da.config');

// Extract store name from INPUT_FILE (e.g., 'all-content-stores' from './all-content-stores/derived-results/...')
const STORE_NAME = path.basename(path.dirname(path.dirname(INPUT_FILE)));

/**
 * Reads and parses the da.config file
 * Returns an object with DA_ORG, DA_REPO, DA_DEST values
 */
function readDaConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = {};

    content.split('\n').forEach((line) => {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Remove inline comments
        const cleanValue = value.split('#')[0].trim();
        config[key] = cleanValue;
      }
    });

    return config;
  } catch (error) {
    console.warn('⚠️  Could not read da.config, using default values');
    return { DA_ORG: 'aemsites', DA_REPO: 'koassets', DA_DEST: '' };
  }
}

/**
 * Constructs the full destination path from DA config
 */
function getDestinationPath(config) {
  const { DA_ORG = 'aemsites', DA_REPO = 'koassets', DA_DEST = '' } = config;

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
 * Formats imageUrl by extracting filename and prepending with destination/fragments
 */
function formatImageUrl(imageUrl, destPath, storeName) {
  if (!imageUrl) return '';

  const filename = extractFilename(imageUrl);
  return `${destPath}/fragments/.${storeName}/${filename}`;
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
  return [
    escapeCsvField(formatPath(item.path || '')),
    escapeCsvField(item.title || ''),
    escapeCsvField(item.type || ''),
    escapeCsvField(formatImageUrl(item.imageUrl || '', destPath, storeName)),
    escapeCsvField(item.linkURL || ''),
    escapeCsvField(item.text || ''),
  ].join(',');
}

/**
 * Traverses the hierarchy in the same order as JSON (parent first, then children)
 * and collects all items, excluding accordion items but including their children
 */
function traverseInOrder(items, result = []) {
  if (!items || !Array.isArray(items)) return result;

  for (const item of items) {
    // Add the current item first (unless it's an accordion)
    if (item.type !== 'accordion') {
      result.push(item);
    }

    // Then process children (maintaining JSON order)
    if (item.items && Array.isArray(item.items)) {
      traverseInOrder(item.items, result);
    }
  }

  return result;
}

/**
 * Main function
 */
function main() {
  try {
    // Read DA configuration
    console.log('Reading configuration from:', CONFIG_FILE);
    const config = readDaConfig(CONFIG_FILE);
    const destPath = getDestinationPath(config);
    console.log(`Destination path: ${destPath}`);
    console.log(`Store name: ${STORE_NAME}`);

    console.log('Reading input file:', INPUT_FILE);
    const jsonData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

    console.log('Traversing hierarchy in original order...');
    const items = traverseInOrder(jsonData.items || []);

    console.log(`Found ${items.length} items`);

    // Items are already in the order from the JSON hierarchy (top-down traversal)
    // No sorting needed - maintain the original order

    // Create CSV content
    const headers = ['path', 'title', 'type', 'imageUrl', 'linkURL', 'text'];
    const csvLines = [headers.join(',')];

    items.forEach((item) => {
      csvLines.push(itemToRow(item, destPath, STORE_NAME));
    });

    const csvContent = csvLines.join('\n');

    // Write to output file
    console.log('Writing to:', OUTPUT_FILE);
    fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');

    console.log('✅ Successfully generated spreadsheet!');
    console.log(`   Output: ${OUTPUT_FILE}`);
    console.log(`   Total rows: ${items.length}`);
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
  readDaConfig,
  getDestinationPath,
  htmlToPlainText,
  formatPath,
  formatImageUrl,
  traverseInOrder,
};
