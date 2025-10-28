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
 * Parse CSV line, handling quoted fields with commas
 */
function parseCsvLine(line) {
  const result = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Add last field
  result.push(currentField);

  return result;
}

/**
 * Read and parse CSV file
 */
function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const headers = parseCsvLine(lines[0]);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Reconstruct hierarchical structure from flat CSV data
 */
function reconstructHierarchy(rows) {
  const root = { items: [] };

  rows.forEach((row) => {
    const pathParts = row.path.split('/').filter((p) => p.trim());

    if (pathParts.length === 0) return;

    let currentLevel = root;

    // Traverse/create the path
    pathParts.forEach((part, index) => {
      const isLastPart = index === pathParts.length - 1;

      // Find existing item at this level
      let existingItem = currentLevel.items.find((item) => item.title === part);

      if (!existingItem) {
        // Create new item
        const newItem = {
          title: part,
          path: pathParts.slice(0, index + 1).join(' > '),
        };

        // If this is the last part, add all the data from CSV
        if (isLastPart) {
          newItem.type = row.type || '';
          if (row.imageUrl) newItem.imageUrl = row.imageUrl;
          if (row.linkURL) newItem.linkURL = row.linkURL;
          if (row.text) newItem.text = row.text;
        } else {
          // Intermediate nodes are containers
          newItem.type = 'container';
        }

        newItem.items = [];
        currentLevel.items.push(newItem);
        existingItem = newItem;
      } else if (isLastPart) {
        // Update existing item with CSV data
        existingItem.type = row.type || existingItem.type;
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

// Read CSV file (for validation)
console.log('\n📖 Reading CSV file...');
const rows = readCsv(csvFilePath);
console.log(`   ✓ Loaded: ${rows.length} items`);

// Use the original merged JSON instead of reconstructing from CSV
// This ensures the HTML is EXACTLY the same as the JSON-based version
console.log('\n🏗️  Loading original JSON structure...');
const jsonPath = csvFilePath.replace('.csv', '.json');
if (!fs.existsSync(jsonPath)) {
  console.error(`❌ ERROR: JSON file not found: ${jsonPath}`);
  console.error('   CSV viewer requires the corresponding JSON file to exist.');
  process.exit(1);
}
const hierarchyData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`   ✓ Loaded: ${hierarchyData.items.length} top-level sections`);

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
