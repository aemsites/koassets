#!/bin/bash

# Workaround to make working with Cloudflare Secret Store easier locally
# Takes all secrets from .secrets file and creates a clean local wrangler secret store
# Used before `wrangler dev` for a worker accessing the Secret Store

set -e
set -o pipefail

# parse SECRET_STORE_ID out of wrangler.toml, only the first match
SECRET_STORE_ID=$(grep -m 1 'store_id = "' wrangler.toml | sed 's/.*store_id = "\(.*\)".*/\1/')

if [ -z "$SECRET_STORE_ID" ]; then
  echo "Error: no secret store_id found in cloudflare/wrangler.toml"
  exit 1
fi

if [ ! -f .secrets ]; then
  echo "Error: missing cloudflare/.secrets file"
  exit 1
fi

# Clean local secret store
rm -rf .wrangler/state/v3/secrets-store

# Load secrets from .secrets file
echo "Loading secrets from cloudflare/.secrets into local wrangler secret store..."
./scripts/load-secret-store.sh $SECRET_STORE_ID .secrets

# BEGIN: additional dynamic secrets --------------------------------------------------------------------------

# 1. create IMS token for DM
echo "Generating IMS token for DM..."
source .secrets
if [ -z "$KOASSETS_DM_CLIENT_ID" ] || [ -z "$KOASSETS_DM_CLIENT_SECRET" ]; then
  echo "Error: KOASSETS_DM_CLIENT_ID and KOASSETS_DM_CLIENT_SECRET are required in cloudflare/.secrets"
  exit 1
fi
DM_TOKEN=$(./scripts/create-ims-token.sh "$KOASSETS_DM_CLIENT_ID" "$KOASSETS_DM_CLIENT_SECRET" "AdobeID,openid")

echo "$DM_TOKEN" | WRANGLER_LOG=error \
  npx wrangler secrets-store secret create $SECRET_STORE_ID \
    --scopes workers \
    --name KOASSETS_DM_ACCESS_TOKEN > /dev/null

# END: additional dynamic secrets ----------------------------------------------------------------------------

# for debugging: list all secrets (but wrangler dev will show secret store bindings as well)
# npx wrangler secrets-store secret list $SECRET_STORE_ID

