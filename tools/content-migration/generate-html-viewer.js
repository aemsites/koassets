#!/usr/bin/env node
/**
 * Generate HTML viewer(s) for content hierarchy data (JSON or CSV).
 *
 * Usage:
 *   node generate-html-viewer.js [input-path ...] [--no-open]
 *
 * When no input paths are provided, the script searches common locations
 * (merged JSON, merged CSV, extracted JSON) in that order.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  buildViewerHtml,
  deriveViewerTitle,
  getOutputHtmlPath,
  loadHierarchyData,
} = require('./html-viewer-utils.js');

const projectRoot = __dirname;
const templatePath = path.join(projectRoot, 'templates/all-content-stores-viewer-tree-template.html');

function getDefaultCandidates(preferredDefaults = []) {
  const baseDefaults = [
    'all-content-stores/derived-results/hierarchy-structure.merged.json',
    'all-content-stores/derived-results/hierarchy-structure.merged.csv',
    'all-content-stores/extracted-results/hierarchy-structure.json',
  ];

  const combined = [...preferredDefaults, ...baseDefaults];
  const seen = new Set();

  return combined
    .map((candidate) => path.resolve(projectRoot, candidate))
    .filter((candidatePath) => {
      if (seen.has(candidatePath)) {
        return false;
      }
      seen.add(candidatePath);
      return true;
    });
}

function processInputPath(inputPath, { openViewer }) {
  console.log(`📂 Using hierarchy file: ${path.relative(projectRoot, inputPath)}`);

  console.log('\n📖 Reading hierarchy data...');
  let hierarchyData;
  let sourceType;
  let meta = {};

  try {
    const loaded = loadHierarchyData(inputPath);
    hierarchyData = loaded.hierarchyData;
    sourceType = loaded.sourceType;
    meta = loaded.meta || {};
  } catch (error) {
    console.error(`❌ ERROR: Failed to load hierarchy data from ${inputPath}`);
    console.error(`   ${error.message}`);
    process.exit(1);
  }

  const renderVariant = meta.renderVariant || sourceType;

  if (sourceType === 'json' && renderVariant === 'csv') {
    console.log(`   ✓ Loaded JSON flat rows (${meta.rowCount || 0} rows)`);
    console.log(`   ✓ Reconstructed ${meta.itemCount || 0} top-level sections`);
  } else if (sourceType === 'json') {
    const topLevelCount = hierarchyData.items ? hierarchyData.items.length : 0;
    console.log(`   ✓ Loaded JSON hierarchy with ${topLevelCount} top-level items`);
  } else if (renderVariant === 'csv') {
    console.log(`   ✓ Loaded CSV with ${meta.rowCount || 0} rows`);
    console.log(`   ✓ Reconstructed ${meta.itemCount || 0} top-level sections`);
  }

  const viewerTitle = deriveViewerTitle(inputPath, renderVariant, {
    baseNameOverride: meta.baseNameOverride,
    sourceLabelOverride: meta.sourceLabelOverride,
  });
  const outputPath = getOutputHtmlPath(inputPath, renderVariant, {
    baseNameOverride: meta.baseNameOverride,
    sourceTypeOverride: meta.outputVariant,
  });

  console.log('\n📝 Generating HTML viewer...');
  let finalHtml;
  try {
    finalHtml = buildViewerHtml(templatePath, hierarchyData, viewerTitle);
  } catch (error) {
    console.error('❌ ERROR: Failed to build HTML viewer');
    console.error(`   ${error.message}`);
    process.exit(1);
  }

  fs.writeFileSync(outputPath, finalHtml);
  console.log(`   ✓ Generated: ${path.basename(outputPath)}`);
  console.log(`   ✓ File size: ${(finalHtml.length / 1024).toFixed(2)} KB`);

  if (openViewer) {
    console.log('\n🌐 Opening viewer in Chrome...');
    try {
      execSync(`open -a "Google Chrome" "${outputPath}"`, { stdio: 'inherit' });
      console.log('   ✓ Viewer opened in Chrome');
    } catch (error) {
      console.log('   ⚠ Could not open Chrome automatically');
      console.log(`   Open manually: ${outputPath}`);
    }
  }

  return outputPath;
}

function runCli({ argv = process.argv.slice(2), preferredDefaults } = {}) {
  console.log('🚀 Generating content hierarchy viewer...\n');

  const positionalArgs = argv.filter((arg) => !arg.startsWith('--'));
  const flagSet = new Set(argv.filter((arg) => arg.startsWith('--')));

  const openViewer = !flagSet.has('--no-open');

  let candidatePaths;

  if (positionalArgs.length > 0) {
    candidatePaths = positionalArgs.map((input) => path.resolve(process.cwd(), input));
  } else {
    candidatePaths = getDefaultCandidates(preferredDefaults);
  }

  const existingPaths = candidatePaths.filter((inputPath) => {
    if (fs.existsSync(inputPath)) {
      return true;
    }
    if (positionalArgs.length > 0) {
      console.warn(`⚠️  Skipping missing input: ${inputPath}`);
    }
    return false;
  });

  if (existingPaths.length === 0) {
    console.error('❌ ERROR: No valid hierarchy data files found.');
    if (positionalArgs.length === 0) {
      console.error('   Looked for:');
      getDefaultCandidates(preferredDefaults).forEach((candidate) => {
        console.error(`   - ${candidate}`);
      });
    }
    process.exit(1);
  }

  const outputs = [];

  existingPaths.forEach((inputPath, index) => {
    const outputPath = processInputPath(inputPath, { openViewer });
    outputs.push(outputPath);

    if (index < existingPaths.length - 1) {
      console.log('\n----------------------------------------\n');
    }
  });

  console.log('\n✅ Done!');
  return outputs;
}

module.exports = { runCli };

if (require.main === module) {
  runCli();
}
