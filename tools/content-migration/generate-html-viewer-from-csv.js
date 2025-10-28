#!/usr/bin/env node
/**
 * Generate HTML viewer for content hierarchy from CSV spreadsheet
 *
 * Usage:
 *   node generate-html-viewer-from-csv.js [csv-file-path]
 *
 * Examples:
 *   node generate-html-viewer-from-csv.js
 *   node generate-html-viewer-from-csv.js all-content-stores/extracted-results/hierarchy-structure.merged.csv
 *
 * How it works:
 * 1. Reads the CSV spreadsheet
 * 2. Reconstructs the hierarchical structure from flat CSV data
 * 3. Generates an interactive HTML viewer from the template
 * 4. Opens the viewer in Chrome automatically
 */

const fs = require('fs');
const path = require('path');
const { PATH_SEPARATOR } = require('./constants');

console.log('🚀 Generating content hierarchy viewer from CSV...\n');

// Get command-line arguments
const args = process.argv.slice(2);
const csvFileArg = args[0];

// Paths
const projectRoot = __dirname;
const templatePath = path.join(__dirname, 'templates/all-content-stores-viewer-tree-template.html');

// Determine which CSV file to use
let csvFilePath;
if (csvFileArg) {
  // Use specified file path
  csvFilePath = path.resolve(__dirname, csvFileArg);
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ ERROR: CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }
  console.log(`📂 Using specified CSV file: ${path.relative(projectRoot, csvFilePath)}`);
} else {
  // Use default merged CSV file from derived-results
  const defaultPath = path.join(projectRoot, 'all-content-stores/derived-results/hierarchy-structure.merged.csv');

  if (fs.existsSync(defaultPath)) {
    csvFilePath = defaultPath;
    console.log('📂 Using merged CSV file from derived-results (default)');
  } else {
    console.error('❌ ERROR: No hierarchy CSV file found!');
    console.error(`   Expected location: ${defaultPath}`);
    process.exit(1);
  }
}

// Output file in the same directory as the CSV file
// Derive output filename from input filename and append 'from-csv'
const csvDir = path.dirname(csvFilePath);
const csvBaseName = path.basename(csvFilePath, '.csv');
const outputPath = path.join(csvDir, `${csvBaseName}.from-csv.html`);

/**
 * Read and parse CSV file properly handling quoted fields with newlines
 */
function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote - add one quote and skip the next
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (!inQuotes) {
      if (char === ',') {
        // End of field
        fields.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\n' || char === '\r') {
        // End of row
        if (currentField || fields.length > 0) {
          fields.push(currentField);
          rows.push([...fields]);
          fields.length = 0;
          currentField = '';
        }
        // Skip \r\n or \n
        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        continue;
      }
    }

    // Regular character
    currentField += char;
    i++;
  }

  // Add last field/row if exists
  if (currentField || fields.length > 0) {
    fields.push(currentField);
    rows.push([...fields]);
  }

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  // First row is headers
  const headers = rows[0];
  const dataRows = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    dataRows.push(row);
  }

  return dataRows;
}

/**
 * Reconstruct hierarchical structure from flat CSV data
 */
function reconstructHierarchy(rows) {
  const root = { items: [] };

  rows.forEach((row) => {
    const pathParts = row.path.split('>').map((p) => p.trim()).filter((p) => p.length > 0);

    if (pathParts.length === 0) return;

    let currentLevel = root;

    // Traverse/create the path
    pathParts.forEach((part, index) => {
      const isLastPart = index === pathParts.length - 1;

      // Find existing item at this level - match by trimmed title to handle trailing spaces
      let existingItem = currentLevel.items.find((item) => item.title.trim() === part.trim());

      if (!existingItem) {
        // Create new item
        const newItem = {
          // Use the actual title from CSV for last part, path segment for intermediate nodes
          title: isLastPart ? row.title : part,
          path: pathParts.slice(0, index + 1).join(PATH_SEPARATOR),
        };

        // If this is the last part, add all the data from CSV
        if (isLastPart) {
          if (row.imageUrl) newItem.imageUrl = row.imageUrl;
          if (row.linkURL) newItem.linkURL = row.linkURL;
          if (row.text) newItem.text = row.text;
        }

        newItem.items = [];
        currentLevel.items.push(newItem);
        existingItem = newItem;
      } else if (isLastPart) {
        // Update existing item with CSV data, including title
        existingItem.title = row.title;
        if (row.imageUrl) existingItem.imageUrl = row.imageUrl;
        if (row.linkURL) existingItem.linkURL = row.linkURL;
        if (row.text) existingItem.text = row.text;
      }

      // Move to next level
      if (!existingItem.items) {
        existingItem.items = [];
      }
      currentLevel = existingItem;
    });
  });

  // Clean up empty items arrays
  function cleanEmptyItems(obj) {
    if (obj.items) {
      if (obj.items.length === 0) {
        delete obj.items;
      } else {
        obj.items.forEach((item) => cleanEmptyItems(item));
      }
    }
  }

  root.items.forEach((item) => cleanEmptyItems(item));

  return root;
}

// Read CSV file and reconstruct hierarchy
console.log('\n📖 Reading CSV file...');
const rows = readCsv(csvFilePath);
console.log(`   ✓ Loaded: ${rows.length} items`);

// Reconstruct hierarchy from CSV data
console.log('\n🏗️  Reconstructing hierarchy from CSV...');
const hierarchyData = reconstructHierarchy(rows);
console.log(`   ✓ Reconstructed: ${hierarchyData.items.length} top-level sections`);

// Read template
console.log('\n📝 Generating HTML viewer...');
const template = fs.readFileSync(templatePath, 'utf8');

// Extract everything before and after the hierarchyData
const dataStart = template.indexOf('let hierarchyData = ');
const beforeData = template.substring(0, dataStart);
const afterDataStart = template.indexOf(';', dataStart) + 1;
const afterData = template.substring(afterDataStart);

// Build new HTML with data
const newHtml = `${beforeData}let hierarchyData = ${JSON.stringify(hierarchyData, null, 0)};${afterData}`;

// Determine title based on file name - derive from actual filename
const csvFileName = path.basename(csvFilePath, '.csv');
// Convert filename to title: hierarchy-structure.merged -> Hierarchy Structure Merged
const titleParts = csvFileName.split(/[-_.]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1));
const baseTitle = titleParts.join(' ');
const viewerTitle = `${baseTitle} (from CSV)`;

// Update title and header
const finalHtml = newHtml
  .replace(/<title>.*?<\/title>/, `<title>${viewerTitle}</title>`)
  .replace(/<h1>.*?<\/h1>/, `<h1>🗂️ ${viewerTitle}</h1>`);

// Write output
fs.writeFileSync(outputPath, finalHtml);
console.log(`   ✓ Generated: ${path.basename(outputPath)}`);
console.log(`   ✓ File size: ${(finalHtml.length / 1024).toFixed(2)} KB`);

// Open in Chrome
console.log('\n🌐 Opening viewer in Chrome...');
const { execSync } = require('child_process');

try {
  execSync(`open -a "Google Chrome" "${outputPath}"`, { stdio: 'inherit' });
  console.log('   ✓ Viewer opened in Chrome');
} catch (error) {
  console.log('   ⚠ Could not open Chrome automatically');
  console.log(`   Open manually: ${outputPath}`);
}

console.log('\n✅ Done!');
