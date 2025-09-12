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

# for debugging: list all secrets (but wrangler dev will show secret store bindings as well)
# npx wrangler secrets-store secret list $SECRET_STORE_ID

