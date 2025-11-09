#!/usr/bin/env bash
set -e

# Get the directory where this script is located and the parent (content-migration) directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="DATA"

# Compare files in directories with their backups in bk/
# Usage:
#   ./compare-json-csv-files.sh                       # Compare ALL files in all *-content-stores* directories
#   ./compare-json-csv-files.sh --json                # Compare only JSON files
#   ./compare-json-csv-files.sh --csv                 # Compare only CSV files
#   ./compare-json-csv-files.sh --json --csv dir1     # Compare both JSON and CSV in specific directories
#   ./compare-json-csv-files.sh dir1 dir2 dir3        # Compare ALL files in specific directories

compare_json_csv_files() {
  local dirs=()
  local compare_json=false
  local compare_csv=false
  local compare_all=true
  
  # Parse arguments for flags and directories
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json)
        compare_json=true
        compare_all=false
        shift
        ;;
      --csv)
        compare_csv=true
        compare_all=false
        shift
        ;;
      *)
        dirs+=("$1")
        shift
        ;;
    esac
  done
  
  # Change to DATA_DIR within SRC_DIR to ensure all relative paths work correctly
  pushd "$SRC_DIR/$DATA_DIR" > /dev/null
  
  # If no directories provided, find all *-content-stores* directories
  if [[ ${#dirs[@]} -eq 0 ]]; then
    for dir in *-content-stores*; do
      [[ -d "$dir" ]] && dirs+=("$dir")
    done
  fi
  
  # Process each directory
  for top_dir in "${dirs[@]}"; do
    # Extract just the directory name (handle both relative and absolute paths)
    local dir_name=$(basename "$top_dir")
    
    echo "Processing: $dir_name"
    
    if [[ ! -d "$top_dir" ]]; then
      echo "Directory not found: $top_dir"
      exit 1
    fi
    
    local backup_top_dir="bk/$dir_name"
    if [[ ! -d "$backup_top_dir" ]]; then
      echo "Backup directory not found: $backup_top_dir"
      exit 1
    fi
    
    # Find all files recursively
    while IFS= read -r -d '' file; do
      # Get relative path from top_dir
      local rel_path="${file#$top_dir/}"
      local backup_file="$backup_top_dir/$rel_path"
      
      # Get file extension
      local ext="${file##*.}"
      
      # Check if we should compare this file based on flags
      local should_compare=false
      if [[ "$compare_all" == "true" ]]; then
        should_compare=true
      elif [[ "$compare_json" == "true" && "$ext" == "json" ]]; then
        should_compare=true
      elif [[ "$compare_csv" == "true" && "$ext" == "csv" ]]; then
        should_compare=true
      fi
      
      if [[ "$should_compare" == "false" ]]; then
        continue
      fi
      
      if [[ -f "$backup_file" ]]; then
        echo ">>>> Comparing $file"
        
        # Compare based on file type
        if [[ "$ext" == "json" ]]; then
          # Normalize JSON: sort keys recursively
          if diff <(jq -S . "$file") <(jq -S . "$backup_file") >/dev/null 2>&1; then
            echo "Matched ✅"
          else
            echo "Different ❌ between \"$file\" and \"$backup_file\""
            diff --color=always <(jq -S . "$file") <(jq -S . "$backup_file") | head -100
            exit 1
          fi
        elif [[ "$ext" == "csv" ]]; then
          # CSV comparison with record counting
          local has_error=false
          
          echo "  [1/2] Checking record count..."
          local rows_current=$(awk 'BEGIN{n=0;q=0} {for(i=1;i<=length($0);i++){c=substr($0,i,1);if(c=="\""&&(i==1||substr($0,i-1,1)!="\\"))q=!q} if(q==0)n++} END{print n}' "$file")
          local rows_backup=$(awk 'BEGIN{n=0;q=0} {for(i=1;i<=length($0);i++){c=substr($0,i,1);if(c=="\""&&(i==1||substr($0,i-1,1)!="\\"))q=!q} if(q==0)n++} END{print n}' "$backup_file")
          
          if [[ "$rows_current" != "$rows_backup" ]]; then
            echo "    Record count: MISMATCH ❌"
            echo "      Current: $rows_current records"
            echo "      Backup:  $rows_backup records"
            echo "      Diff:    $((rows_current - rows_backup)) records"
            echo "  Overall: FAILED ❌ (failed fast on record count)"
            echo
            exit 1
          else
            echo "    Record count: MATCH ✅ ($rows_current records)"
          fi
          
          echo "  [2/2] Checking content..."
          local tmp_current=$(mktemp)
          local tmp_backup=$(mktemp)
          
          awk 'NR>1{print prev} {prev=$0} END{print prev}' "$file" > "$tmp_current"
          awk 'NR>1{print prev} {prev=$0} END{print prev}' "$backup_file" > "$tmp_backup"
          
          if diff "$tmp_current" "$tmp_backup" >/dev/null 2>&1; then
            echo "    Content: MATCH ✅"
            rm -f "$tmp_current" "$tmp_backup"
          else
            echo "    Content: DIFFERENT ❌"
            echo "      Comparing: \"$file\" vs \"$backup_file\""
            diff --color=always "$tmp_current" "$tmp_backup" | head -50
            rm -f "$tmp_current" "$tmp_backup"
            has_error=true
          fi
          
          if [[ "$has_error" == "true" ]]; then
            echo "  Overall: FAILED ❌"
            exit 1
          else
            echo "  Overall: PASSED ✅"
          fi
        else
          # Binary or other file comparison
          if diff "$file" "$backup_file" >/dev/null 2>&1; then
            echo "Matched ✅"
          else
            echo "Different ❌ between \"$file\" and \"$backup_file\""
            # For binary files, just show they differ
            if file "$file" | grep -q "text"; then
              diff --color=always "$file" "$backup_file" | head -100
            else
              echo "(Binary files differ)"
            fi
            exit 1
          fi
        fi
        echo
      else
        echo "Missing in bk/: $backup_file"
        echo
      fi
    done < <(find "$top_dir" -type f -print0)
  done
  
  # Return to original directory
  popd > /dev/null
}

# If script is executed directly (not sourced), run the function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  compare_json_csv_files "$@"
fi
