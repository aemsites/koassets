#!/bin/bash
set -e

# Extract hierarchy for both content stores

echo "=========================================="
echo "Extracting content hierarchies..."
echo "=========================================="
echo ""

# Extract all-content-stores
echo "📥 Extracting: all-content-stores"
echo "-------------------------------------------"
node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores'
node generate-hierarchy-html-for-debug.js all-content-stores/extracted-results/hierarchy-structure.json 
echo ""
echo ""

# Extract global-coca-cola-uplift
echo "📥 Extracting: global-coca-cola-uplift"
echo "-------------------------------------------"
node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores/global-coca-cola-uplift'
node generate-hierarchy-html-for-debug.js all-content-stores__global-coca-cola-uplift/extracted-results/hierarchy-structure.json 
echo ""
echo ""

# Merge hierarchies & Generate merged HTML viewer from JSON
echo "🔀 Merging hierarchies... and 📊 Generating merged viewer..."
echo "-------------------------------------------"
node merge-hierarchy-json.js all-content-stores__global-coca-cola-uplift && node generate-html-viewer.js all-content-stores/derived-results/hierarchy-structure.merged.json
echo ""
echo ""

# Generate CSV from merged hierarchy
echo "📋 Generating CSV from merged hierarchy..."
echo "-------------------------------------------"
node generate-csv-from-hierarchy-merged-json.js
echo ""
echo ""

# Generate HTML viewer from CSV
echo "🌐 Generating HTML viewer from CSV..."
echo "-------------------------------------------"
node generate-html-viewer.js all-content-stores/derived-results/hierarchy-structure.merged.csv
echo ""
echo ""

# Generate HTML viewer from EDS
echo "🌐 Generating HTML viewer from EDS..."
echo "-------------------------------------------"
node generate-html-viewer.js all-content-stores/derived-results/hierarchy-structure.merged.eds.json
echo ""
echo ""

echo "✅ All extractions, merging, viewer generation, CSV generation, and CSV viewer generation completed!"

