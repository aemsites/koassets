#!/bin/bash

# Workaround to make working with Cloudflare Secret Store easier locally
# Takes all secrets from .secrets file and creates a clean local wrangler secret store
# Used before `wrangler dev` for a worker accessing the Secret Store

# Format of .secrets file:
#
#   # comment
#   ONE="top-secret"
#   TWO="super-secret"

set -e
set -o pipefail

FILE=".secrets"

# parse SECRET_STORE_ID out of wrangler.toml, only the first match
SECRET_STORE_ID=$(grep -m 1 'store_id = "' wrangler.toml | sed 's/.*store_id = "\(.*\)".*/\1/')

if [ -z "$SECRET_STORE_ID" ]; then
  echo "Error: no secret store_id found in cloudflare/wrangler.toml"
  exit 1
fi

if [ ! -f $FILE ]; then
  echo "Error: missing cloudflare/$FILE file"
  exit 1
fi

# Clean local secret store
rm -rf .wrangler/state/v3/secrets-store

# Load secrets from .secrets file
echo "Loading secrets from cloudflare/$FILE into local wrangler secret store..."

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

# for debugging: list all secrets (but wrangler dev will show secret store bindings as well)
# npx wrangler secrets-store secret list $SECRET_STORE_ID

