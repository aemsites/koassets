#!/usr/bin/env node
/**
 * Generate HTML viewer for content hierarchy from a single JSON file
 *
 * Usage:
 *   node generate-html-viewer-from-json.js [json-file-path]
 *
 * Examples:
 *   node generate-html-viewer-from-json.js                                        # Use default merged file
 *   node generate-html-viewer-from-json.js ../all-content-stores/extracted-results/hierarchy-structure.json
 *   node generate-html-viewer-from-json.js ../all-content-stores/extracted-results/hierarchy-structure.merged.json
 *
 * How it works:
 * 1. Reads a single hierarchy-structure JSON file (pre-merged if needed)
 * 2. Generates an interactive HTML viewer from the template
 * 3. Opens the viewer in Chrome automatically
 *
 * Note: Use merge-hierarchy-json.js first to create a merged JSON file if needed.
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Generating content hierarchy viewer...\n');

// Get command-line arguments
const args = process.argv.slice(2);
const jsonFileArg = args[0];

// Paths
const projectRoot = __dirname;
const templatePath = path.join(__dirname, 'templates/all-content-stores-viewer-tree-template.html');

// Determine which JSON file to use
let jsonFilePath;
if (jsonFileArg) {
  // Use specified file path
  jsonFilePath = path.resolve(__dirname, jsonFileArg);
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ ERROR: JSON file not found: ${jsonFilePath}`);
    process.exit(1);
  }
  console.log(`📂 Using specified JSON file: ${path.relative(projectRoot, jsonFilePath)}`);
} else {
  // Try merged file first, fall back to regular file
  const mergedPath = path.join(projectRoot, 'all-content-stores/extracted-results/hierarchy-structure.merged.json');
  const regularPath = path.join(projectRoot, 'all-content-stores/extracted-results/hierarchy-structure.json');

  if (fs.existsSync(mergedPath)) {
    jsonFilePath = mergedPath;
    console.log('📂 Using merged JSON file (default)');
  } else if (fs.existsSync(regularPath)) {
    jsonFilePath = regularPath;
    console.log('📂 Using regular JSON file (merged file not found)');
  } else {
    console.error('❌ ERROR: No hierarchy JSON file found!');
    console.error('   Expected locations:');
    console.error(`   - ${mergedPath}`);
    console.error(`   - ${regularPath}`);
    process.exit(1);
  }
}

const outputPath = path.join(__dirname, 'temp/all-content-stores-viewer-output.html');

// Read JSON file
console.log('\n📖 Reading hierarchy JSON...');
const hierarchyData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
console.log(`   ✓ Loaded: ${hierarchyData.items.length} top-level items`);

// Count total items
function countAllItems(items) {
  let count = items.length;
  for (const item of items) {
    if (item.items && item.items.length > 0) {
      count += countAllItems(item.items);
    }
  }
  return count;
}

const totalItems = countAllItems(hierarchyData.items);
console.log(`   ✓ Total items (including nested): ${totalItems}`);

// Read template
console.log('\n📝 Generating HTML viewer...');
const template = fs.readFileSync(templatePath, 'utf8');

// Extract everything before and after the hierarchyData
const dataStart = template.indexOf('let hierarchyData = ');
const beforeData = template.substring(0, dataStart);
const afterDataStart = template.indexOf(';', dataStart) + 1;
const afterData = template.substring(afterDataStart);

// Build new HTML with data
const newHtml = `${beforeData
}let hierarchyData = ${JSON.stringify(hierarchyData, null, 0)};${
  afterData}`;

// Determine title based on file name
const jsonFileName = path.basename(jsonFilePath, '.json');
const isMerged = jsonFileName.includes('merged');
const viewerTitle = isMerged ? 'All Content Stores (Merged)' : 'All Content Stores';

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
