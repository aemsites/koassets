#!/bin/bash

# Update secrets in local Cloudflare Secret Store

set -e

SECRET_STORE_ID="$1"
FILE="$2"

if [ -z "$SECRET_STORE_ID" ] || [ -z "$FILE" ]; then
  echo "Usage: load-secret-store.sh <secret-store-id> <secrets-file>"
  echo
  echo "Load secrets from <secrets-file> into a local Cloudflare wrangler secret store."
  echo
  echo "<secret-store-id>   Cloudflare secret store ID (same as in production)"
  echo
  echo "<secrets-file>      Properties file with secrets in the following format:"
  echo
  echo "                      # comment"
  echo "                      ONE=\"top-secret\""
  echo "                      TWO=\"super-secret\""
  exit 1
fi

while IFS='=' read -r key value; do
    # Skip empty lines and comments
    if [[ -z "$key" || "$key" =~ ^# ]]; then
        continue
    fi

    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    # 'secret create' does create OR update
    echo "$value" | WRANGLER_LOG=error npx wrangler secrets-store secret create $SECRET_STORE_ID --scopes workers --name "$key" > /dev/null

done < "$FILE"
