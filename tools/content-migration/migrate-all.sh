#!/bin/bash
set -e

# Usage: ./migrate-all.sh [--input stores-file | --store content-path]
#   --input <file>  File containing list of store paths (one per line)
#   --store <path>  Single content store path (e.g., /content/share/us/en/all-content-stores)
#
# Note: Either --input or --store must be provided

# Parse arguments - either stores file OR single store path is REQUIRED
stores_file=""
single_store=""

# Parse all arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --input)
            if [[ -n "$2" ]]; then
                stores_file="$2"
                shift 2
            else
                echo "❌ ERROR: --input requires a file argument"
                exit 1
            fi
            ;;
        --store)
            if [[ -n "$2" ]]; then
                single_store="$2"
                shift 2
            else
                echo "❌ ERROR: --store requires a content path argument"
                exit 1
            fi
            ;;
        *)
            # Support positional argument for backward compatibility
            if [[ -z "$stores_file" && -z "$single_store" && -f "$1" ]]; then
                stores_file="$1"
                shift
            else
                echo "❌ ERROR: Unknown argument: $1"
                echo "Usage: $0 [--input stores-file | --store content-path]"
                exit 1
            fi
            ;;
    esac
done

# Validate that either --input or --store is provided (but not both)
if [[ -z "$stores_file" && -z "$single_store" ]]; then
    echo "❌ ERROR: Either --input or --store must be provided"
    echo "Usage: $0 [--input stores-file | --store content-path]"
    exit 1
fi

if [[ -n "$stores_file" && -n "$single_store" ]]; then
    echo "❌ ERROR: Cannot use both --input and --store at the same time"
    echo "Usage: $0 [--input stores-file | --store content-path]"
    exit 1
fi

if [[ -n "$stores_file" && ! -f "$stores_file" ]]; then
    echo "❌ ERROR: Stores file not found: $stores_file"
    exit 1
fi

# If using --store, create a temporary file for downstream scripts
temp_stores_file=""
if [[ -n "$single_store" ]]; then
    temp_stores_file=$(mktemp)
    echo "$single_store" > "$temp_stores_file"
    stores_file="$temp_stores_file"
    trap 'rm -f "$temp_stores_file"' EXIT
fi

echo "=========================================="
echo "Extracting content hierarchies ..."
echo "=========================================="
echo ""

# Extract all-content-stores & stores
#node extract-stores-hierarchy.js --recursive --dry ### ==> will fetch '/content/share/us/en/*-content-stores'

# Use --input flag to pass stores file to Node.js script
if [[ -n "$single_store" ]]; then
    echo "📄 Processing single store: $single_store"
else
    echo "📄 Using stores from file: $stores_file"
fi
node extract-stores-hierarchy.js --input "$stores_file"


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
node upload-to-EDS.js -c 5 --input "$stores_file" --preview #--dry

