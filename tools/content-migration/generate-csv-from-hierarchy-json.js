#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-syntax, max-len */
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
const { globSync } = require('glob');
const { PATH_SEPARATOR } = require('./constants.js');
const { sanitizeFileName } = require('./sanitize-utils.js');

const CONFIG_FILE = path.join(__dirname, './da.config');

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
  - text: Plain text content (HTML stripped)

CONFIGURATION:
  Reads configuration from: ./da.config
  - DA_ORG: DA organization (default: aemsites)
  - DA_REPO: DA repository (default: koassets)
  - DA_DEST: DA destination path prefix
`);
}

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
 * Formats imageUrl by extracting filename and prepending with full DA Live URL
 * Returns empty string if the sanitized file doesn't exist in extracted-results/images
 */
function formatImageUrl(imageUrl, destPath, storeName) {
  if (!imageUrl) return '';

  const filename = extractFilename(imageUrl);
  const sanitizedFilename = sanitizeFileName(filename);

  // Check if the sanitized file exists in the images directory
  const imagePath = path.join(__dirname, storeName, 'extracted-results', 'images', sanitizedFilename);
  if (!fs.existsSync(imagePath)) {
    return '';
  }

  return `https://content.da.live/${destPath}/fragments/.${storeName}/${sanitizedFilename}`;
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
 * Processes a single input file and generates CSV
 */
function processFile(inputFile, outputFile) {
  // Extract store name from inputFile (e.g., 'all-content-stores' from './all-content-stores/extracted-results/...')
  const storeName = path.basename(path.dirname(path.dirname(inputFile)));

  // Read DA configuration
  const config = readDaConfig(CONFIG_FILE);
  const destPath = getDestinationPath(config);

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
  const headers = ['path', 'title', 'imageUrl', 'linkURL', 'text'];
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
  const pattern = '*-content-stores*/extracted-results/hierarchy-structure.json';
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
  readDaConfig,
  getDestinationPath,
  htmlToPlainText,
  formatPath,
  formatImageUrl,
  traverseInOrder,
  processFile,
  findInputFiles,
};
