#!/usr/bin/env node
/**
 * Merge child hierarchy-structure.json into parent hierarchy-structure.json
 *
 * Usage:
 *   node merge-hierarchy-json.js <child-dir-name>
 *   node merge-hierarchy-json.js all-content-stores__global-coca-cola-uplift
 *
 * This script:
 * 1. Reads the parent hierarchy (all-content-stores/extracted-results/hierarchy-structure.json)
 * 2. Reads the child hierarchy (e.g., all-content-stores__global-coca-cola-uplift/extracted-results/hierarchy-structure.json)
 * 3. Derives the linkURL from the child directory name
 * 4. Finds the matching item in the parent hierarchy by linkURL
 * 5. Merges the child's items into the parent item's items array
 * 6. Writes the merged result back to the parent JSON file
 */

const fs = require('fs');
const path = require('path');
const { PATH_SEPARATOR } = require('./constants');

console.log('🔀 Merging hierarchy JSON files...\n');

// Get command-line arguments
const args = process.argv.slice(2);
const childDirArg = args[0];

if (!childDirArg) {
  console.error('❌ ERROR: Child directory name required!');
  console.error('\nUsage:');
  console.error('  node merge-hierarchy-json.js <child-dir-name>');
  console.error('\nExample:');
  console.error('  node merge-hierarchy-json.js all-content-stores__global-coca-cola-uplift');
  process.exit(1);
}

// Paths
const projectRoot = path.join(__dirname, '');
const parentPath = path.join(projectRoot, 'all-content-stores/extracted-results/hierarchy-structure.json');
const childPath = path.join(projectRoot, childDirArg, 'extracted-results/hierarchy-structure.json');

// Verify files exist
if (!fs.existsSync(parentPath)) {
  console.error(`❌ ERROR: Parent file not found: ${parentPath}`);
  process.exit(1);
}

if (!fs.existsSync(childPath)) {
  console.error(`❌ ERROR: Child file not found: ${childPath}`);
  process.exit(1);
}

// Read JSON files
console.log('📖 Reading hierarchy files...');
const parentData = JSON.parse(fs.readFileSync(parentPath, 'utf8'));
const childData = JSON.parse(fs.readFileSync(childPath, 'utf8'));
console.log(`   ✓ Parent: ${parentData.items.length} top-level items`);
console.log(`   ✓ Child: ${childData.items.length} top-level items`);

// Derive the content path from the child directory name
// e.g., "all-content-stores__global-coca-cola-uplift" → "/content/share/us/en/all-content-stores/global-coca-cola-uplift"
const contentPathFromDir = `/content/share/us/en/${childDirArg.replace(/__/g, '/')}`;
const contentPathWithHtml = `${contentPathFromDir}.html`;
console.log('\n📍 Derived linkURL patterns:');
console.log(`   - ${contentPathFromDir}`);
console.log(`   - ${contentPathWithHtml}`);

// Helper function to find and update item with matching linkURL
function findAndMerge(items, targetLinkURL, targetLinkURLWithHtml, childData, depth = 0) {
  for (const item of items) {
    if (item.linkURL === targetLinkURL || item.linkURL === targetLinkURLWithHtml) {
      console.log('\n✅ Found matching item!');
      console.log(`   Path: ${item.path}`);
      console.log(`   Title: "${item.title}"`);
      console.log(`   Type: ${item.type}`);
      console.log(`   LinkURL: ${item.linkURL}`);

      // Backup existing items if any
      const existingItemsCount = (item.items && item.items.length) || 0;
      if (existingItemsCount > 0) {
        console.log(`\n⚠️  Warning: Item already has ${existingItemsCount} child items`);
        console.log('   These will be replaced with the child hierarchy data');
      }

      // Update paths of child items to include parent path
      console.log('\n🔗 Updating child paths to include parent path...');
      function updatePaths(items, parentPath) {
        items.forEach((childItem) => {
          // Prepend parent path to child path (paths are already complete in child data)
          childItem.path = `${parentPath}${PATH_SEPARATOR}${childItem.path}`;

          // Recursively update nested children with the same parent path
          // (don't use updated path since child paths already have their hierarchy)
          if (childItem.items && childItem.items.length > 0) {
            updatePaths(childItem.items, parentPath);
          }
        });
      }

      // Create a deep copy to avoid modifying the original childData
      const updatedChildItems = JSON.parse(JSON.stringify(childData.items));
      updatePaths(updatedChildItems, item.path);

      // Merge child items
      item.items = updatedChildItems;
      console.log(`✓ Updated paths for ${childData.items.length} items and their children`);
      console.log(`\n✓ Merged ${childData.items.length} items into "${item.title}"`);
      childData.items.forEach((child, idx) => {
        console.log(`   ${idx + 1}. ${child.title} (${child.type})`);
      });

      return true;
    }

    // Recursively search in children
    if (item.items && item.items.length > 0) {
      if (findAndMerge(item.items, targetLinkURL, targetLinkURLWithHtml, childData, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

// Find and merge
console.log('\n🔍 Searching for matching item in parent hierarchy...');
const found = findAndMerge(parentData.items, contentPathFromDir, contentPathWithHtml, childData);

if (!found) {
  console.error(`\n❌ ERROR: No item found with linkURL matching "${contentPathFromDir}"!`);
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Verify the child directory name is correct');
  console.error('   2. Check that the parent hierarchy has an item with this linkURL');
  console.error('   3. Ensure the linkURL format matches: /content/share/us/en/...');
  process.exit(1);
}

// Write merged data to derived-results folder
const parentDir = path.dirname(path.dirname(parentPath)); // Go up to project root from extracted-results
const outputDir = path.join(parentDir, 'derived-results');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
const outputPath = path.join(outputDir, 'hierarchy-structure.merged.json');
console.log('\n📝 Writing merged data to output file...');
fs.writeFileSync(outputPath, JSON.stringify(parentData, null, 2));
console.log(`   ✓ Merged data written: ${outputPath}`);
console.log(`   ✓ Original file unchanged: ${parentPath}`);

// Calculate stats
function countAllItems(items) {
  let count = items.length;
  for (const item of items) {
    if (item.items && item.items.length > 0) {
      count += countAllItems(item.items);
    }
  }
  return count;
}

const totalItems = countAllItems(parentData.items);
console.log('\n📊 Final Statistics:');
console.log(`   Total items (including nested): ${totalItems}`);
console.log(`   Top-level items: ${parentData.items.length}`);

console.log('\n✅ Merge completed successfully!');
console.log('\n💡 To use the merged file as the main file, run:');
console.log(`   cp "${outputPath}" "${parentPath}"`);
