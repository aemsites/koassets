#!/bin/bash
set -e

echo "=========================================="
echo "Extracting content hierarchies ..."
echo "=========================================="
echo ""

# Extract all-content-stores & stores
node extract-tab-hierarchy-all.js --recursive ### ==> will fetch '/content/share/us/en/*-content-stores'
    #node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores/global-coca-cola-uplift'
    #node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores/portfolio-get-together-2025'
    #node extract-tab-hierarchy-all.js '/content/share/us/en/bottler-content-stores/coke-holiday-2025'
    #node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores/ramadan-2025'
    #node extract-tab-hierarchy-all.js '/content/share/us/en/all-content-stores/fifa-club-wc-2025'


echo "=========================================="
echo "Generating CSV from merged hierarchy json ..."
echo "=========================================="
echo ""
node generate-csv-from-hierarchy-json.js ### ==> will generate CSVs from '*-content-stores*/extracted-results/hierarchy-structure.json'
echo ""
echo ""


echo "=========================================="
echo "Generating DA docs ... "
echo "   - Merging multi csv's into 'all-content-stores-sheet.json' ... "
echo "   - Generating all-content-stores page and other content store pages ... "
echo "=========================================="
echo ""

node generate-EDS-docs.js ### ==> will create 'all-content-stores-sheet.json' and other content store pages 

exit 0

echo "=========================================="
echo "Upload and preview/publish 'all-content-stores-sheet.json' to EDS ... "
echo "=========================================="
echo ""

node upload-images.js -c 10
node upload-to-EDS.js generated-eds-docs --preview #--debug

