#!/usr/bin/env bash
set -e

# Source the compare-json-files function
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/compare-json-csv-files.sh"
SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

function compare_images() {
    echo -e "\n\n============================================== Comparing images with backup... ==============================================\n\n"
    
    # Use $SRC_DIR to ensure paths are correct regardless of where script is run from
    if diff <(/bin/ls "$SRC_DIR/all-content-stores/extracted-results/images" | sort) \
            <(/bin/ls "$SRC_DIR/bk/all-content-stores/extracted-results/images" | sort); then
      echo "Image name lists matched ✅"
    else
      echo "Image name lists differ ❌"
      exit 1
    fi
    echo

    diff_found=0

    for f in "$SRC_DIR/all-content-stores/extracted-results/images"/*; do
      base=$(basename "$f")
      target="$SRC_DIR/bk/all-content-stores/extracted-results/images/$base"

      if [[ -f "$target" ]]; then
        md5_1=$(md5 -q "$f")      # macOS: use md5 -q
        md5_2=$(md5 -q "$target")
        if [[ "$md5_1" != "$md5_2" ]]; then
          echo "$base: Different ❌"
          diff_found=1
        fi
      else
        echo "$base: Missing in bk/ ❌"
        diff_found=1
      fi
    done

    if [[ $diff_found -eq 0 ]]; then
      echo "All images matched ✅"
    else
      exit 1
    fi
}

function compare_single() {
    target="$1"
    
    # Change to SRC_DIR to ensure all relative paths work correctly
    pushd "$SRC_DIR" > /dev/null
    
    # Extract just the directory name if full path was provided
    target_dir=$(basename "$target")
    echo -e "\n\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> WORKING ON: $target <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
    
    echo -e "\n\n============================================== Comparing linkURLs between hierarchy-structure.json and tabs*.json ... ==============================================\n\n"
    node "${SCRIPT_DIR}/compare-linkurls.js" "$target_dir"
    
    # # Check if backup directory exists
    # if [[ ! -d "bk/${target_dir}" ]]; then
    #     echo "⏭️  Skipping $target_dir (no backup directory)"
    #     popd > /dev/null
    #     return 0
    # fi
    
#    echo -e "\n\n============================================== Comparing derived-results/*csv with backup... ==============================================\n\n"
#    ${SCRIPT_DIR}/compare-json-csv-files.sh --csv "$target_dir"
#    
#    echo -e "\n\n============================================== Comparing extracted-results/*json with backup... ==============================================\n\n"
#    ${SCRIPT_DIR}/compare-json-csv-files.sh --json "$target_dir"
    
    # Return to original directory
    popd > /dev/null
            
    echo -e "\n\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> DONE WITH: $target <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
}

function compare_all() {
    # Change to SRC_DIR so all paths are relative
    cd "$SRC_DIR"
    
    # Discover all folders matching *-content-stores* pattern
    echo "Discovering folders matching *-content-stores* pattern..."
    for folder in *-content-stores*; do
        if [[ -d "$folder" ]]; then
            compare_single "$folder"
        fi
    done
}

#compare_images
compare_all

echo -e "\n\n============================================== Comparing generated-eds-docs/* with backup... ==============================================\n\n"
${SCRIPT_DIR}/compare-json-csv-files.sh generated-eds-docs

echo -e "\n\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ALL DONE <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"

