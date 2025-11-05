#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-syntax, import/no-extraneous-dependencies */
/**
 * Convert all hierarchy-structure.csv files to a single multi-sheet JSON file
 *
 * This script:
 * 1. Finds all content-stores derived-results/hierarchy-structure.csv files
 * 2. Converts each CSV to JSON format
 * 3. Writes to all-content-stores-sheet.json with multi-sheet format
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
// eslint-disable-next-line no-unused-vars
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const EDS_DOCS_DIR = path.join(__dirname, 'generated-eds-docs');

/**
 * Parses a CSV line, handling quoted fields with commas
 */
function parseCsvLine(line) {
  const fields = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        currentField += '"';
        i += 1; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Add last field
  fields.push(currentField);

  return fields;
}

/**
 * Parses CSV content into rows, handling multi-line quoted fields
 */
function parseCSVRows(content) {
  const rows = [];
  let currentRow = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentRow += '""';
        i += 1;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        currentRow += char;
      }
    } else if (char === '\n' && !inQuotes) {
      // End of row (not inside quotes)
      if (currentRow.trim().length > 0) {
        rows.push(currentRow);
      }
      currentRow = '';
    } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
      // Windows line ending (CRLF) - skip \r
      if (currentRow.trim().length > 0) {
        rows.push(currentRow);
      }
      currentRow = '';
      i += 1; // Skip the \n
    } else {
      currentRow += char;
    }
  }

  // Add last row if there's content
  if (currentRow.trim().length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Converts a CSV file to JSON array
 */
function csvToJson(csvFilePath) {
  const content = fs.readFileSync(csvFilePath, 'utf8');
  const rows = parseCSVRows(content);

  if (rows.length === 0) {
    return [];
  }

  // Parse header
  const headers = parseCsvLine(rows[0]);

  // Parse data rows
  const result = [];
  for (let i = 1; i < rows.length; i += 1) {
    const fields = parseCsvLine(rows[i]);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = fields[index] || '';
    });

    result.push(row);
  }

  return result;
}

/**
 * Extracts store name from CSV file path
 * Example: './portfolio/derived-results/hierarchy-structure.csv'
 *          => 'all-content-stores__portfolio-get-together-2025'
 */
function extractStoreName(csvPath) {
  // Get the directory containing derived-results
  const storeDir = path.dirname(path.dirname(csvPath));
  return path.basename(storeDir);
}

/**
 * Finds all hierarchy-structure.csv files
 */
function findCsvFiles() {
  const pattern = '*-content-stores*/derived-results/hierarchy-structure.csv';
  const matches = globSync(pattern, { cwd: __dirname });
  return matches.map((f) => path.join(__dirname, f));
}

/**
 * Generate EDS documentation HTML files from multi-sheet JSON
 * @param {string} inputFile - Path to input JSON file (output from mergeCsvToMultiSheetJson)
 */
function generateEDSDocs(inputFile) {
  try {
    console.log('\n📚 Generating EDS documentation...');
    console.log(`   Input file: ${inputFile}`);

    // Read input JSON file
    const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const names = jsonData[':names'];

    if (!names || !Array.isArray(names)) {
      console.error('❌ Error: Invalid JSON format. Missing :names array.');
      process.exit(1);
    }

    // Get DA_DEST without the '/fragments' suffix for sheet path
    // DA_DEST from da-admin-client has '/fragments' appended
    const daDest = DA_DEST.replace(/\/fragments$/, '');

    // Get input filename without extension
    const inputFileName = path.basename(inputFile, path.extname(inputFile));
    const sheetPath = daDest ? `${daDest}/${inputFileName}` : inputFileName;

    // Read templates
    const blockTemplate = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'block-content-stores-template.html'),
      'utf8',
    );
    const allContentStoresTemplate = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'all-content-stores-template.html'),
      'utf8',
    );
    const individualStoreTemplate = fs.readFileSync(
      path.join(TEMPLATES_DIR, 'individual-content-store-template.html'),
      'utf8',
    );

    // Create eds-docs directory if it doesn't exist
    if (!fs.existsSync(EDS_DOCS_DIR)) {
      fs.mkdirSync(EDS_DOCS_DIR, { recursive: true });
    }

    // Create eds-docs/content-stores subdirectory for individual stores
    const contentStoresDir = path.join(EDS_DOCS_DIR, 'content-stores');
    if (!fs.existsSync(contentStoresDir)) {
      fs.mkdirSync(contentStoresDir, { recursive: true });
    }

    console.log(`   Sheet path: ${sheetPath}`);
    console.log(`   Processing ${names.length} store(s)...\n`);

    // Process each name
    names.forEach((name) => {
      const isContentStoresList = name.endsWith('content-stores');
      const outputDir = isContentStoresList ? EDS_DOCS_DIR : contentStoresDir;

      console.log(`   Generating: ${name}.html ${isContentStoresList ? '' : '(in content-stores/)'}`);

      // Fill block template
      const blockContent = blockTemplate
        .replace(/\$\{SHEET_PATH\}/g, sheetPath)
        .replace(/\$\{SHEET_NAME\}/g, name);

      // Choose page template based on name
      const pageTemplate = isContentStoresList
        ? allContentStoresTemplate
        : individualStoreTemplate;

      // Fill page template
      const pageContent = pageTemplate.replace(/\$\{BLOCK_CONTENT_STORES\}/g, blockContent);

      // Write to file
      const outputPath = path.join(outputDir, `${name}.html`);
      fs.writeFileSync(outputPath, pageContent, 'utf8');
    });

    console.log('\n✅ Successfully generated EDS documentation!');
    console.log(`   Output directory: ${EDS_DOCS_DIR}`);
    console.log(`   Files generated: ${names.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Merge CSV files to multi-sheet JSON
 * @param {string} outputFile - Path to output JSON file
 */
function mergeCsvToMultiSheetJson(outputFile) {
  try {
    console.log('🔍 Finding CSV files...');
    const csvFiles = findCsvFiles();

    if (csvFiles.length === 0) {
      console.error('❌ No CSV files found matching pattern:');
      console.error('   *-content-stores*/derived-results/hierarchy-structure.csv');
      process.exit(1);
    }

    console.log(`📄 Found ${csvFiles.length} CSV file(s)\n`);

    const result = {
      ':type': 'multi-sheet',
      ':names': [],
      ':version': 1,
    };

    // Process each CSV file
    csvFiles.forEach((csvPath) => {
      const storeName = extractStoreName(csvPath);
      console.log(`   Processing: ${storeName}`);

      const jsonData = csvToJson(csvPath);
      console.log(`      Rows: ${jsonData.length}`);

      result[storeName] = {
        total: jsonData.length,
        limit: jsonData.length,
        offset: 0,
        data: jsonData,
      };

      result[':names'].push(storeName);
    });

    // Sort the store names alphabetically
    result[':names'].sort();

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    console.log(`\n📝 Writing to: ${outputFile}`);
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2), 'utf8');

    console.log('\n✅ Successfully created multi-sheet JSON!');
    console.log(`   Total stores: ${result[':names'].length}`);
    console.log(`   Output: ${outputFile}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  // Get output file from command line argument or use default
  const args = process.argv.slice(2);
  const outputFileName = args[0] || 'all-content-stores-sheet.json';
  // Save to eds-docs folder by default
  const outputFile = path.isAbsolute(outputFileName)
    ? outputFileName
    : path.join(EDS_DOCS_DIR, outputFileName);

  mergeCsvToMultiSheetJson(outputFile);
  generateEDSDocs(outputFile);
}

module.exports = {
  parseCSVRows,
  csvToJson,
  extractStoreName,
  findCsvFiles,
  generateEDSDocs,
  mergeCsvToMultiSheetJson,
};
