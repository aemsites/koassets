#!/bin/bash
set -e

# Usage: ./migrate-all.sh --input stores-file
#   --input <file>  Required file containing list of store paths (one per line)

# Parse arguments - stores file is REQUIRED
stores_file=""
if [[ "$1" == "--input" && -n "$2" ]]; then
    stores_file="$2"
elif [[ -n "$1" && -f "$1" ]]; then
    # Support positional argument for backward compatibility
    stores_file="$1"
fi

if [[ -z "$stores_file" ]]; then
    echo "❌ ERROR: Stores file is required"
    echo "Usage: $0 --input stores-file"
    exit 1
fi

if [[ ! -f "$stores_file" ]]; then
    echo "❌ ERROR: Stores file not found: $stores_file"
    exit 1
fi

echo "=========================================="
echo "Extracting content hierarchies ..."
echo "=========================================="
echo ""

# Extract all-content-stores & stores
#node extract-tab-hierarchy-all.js --recursive --debug ### ==> will fetch '/content/share/us/en/*-content-stores'

# Use --input flag to pass stores file to Node.js script
echo "📄 Using stores from file: $stores_file"
node extract-tab-hierarchy-all.js --input "$stores_file"


echo "=========================================="
echo "Generating CSV from merged hierarchy json ..."
echo "=========================================="
echo ""
node generate-csv-from-hierarchy-json.js ### ==> will generate CSVs from '*-content-stores*/extracted-results/hierarchy-structure.json'
node _for-debug/generate-html-viewer.js --no-open ### ==> will create html from csv  
echo ""
echo ""


echo "=========================================="
echo "Generating DA docs ... "
echo "   - Merging multi csv's into 'all-content-stores-sheet.json' ... "
echo "   - Generating all-content-stores page and other content store pages ... "
echo "=========================================="
echo ""

node generate-EDS-docs.js --input "$stores_file" ### ==> will create 'all-content-stores-sheet.json' and other content store pages 


exit 0

echo "=========================================="
echo "Upload and preview/publish 'all-content-stores-sheet.json' to EDS ... "
echo "=========================================="
echo ""

node upload-images.js -c 10
node upload-to-EDS.js generated-eds-docs --preview #--debug

