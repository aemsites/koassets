#!/bin/bash

# shellcheck disable=SC2164

# Run full local development stack

AEM_PAGES_URL=${AEM_PAGES_URL:-https://main--koassets--aemsites.aem.page}
DM_ORIGIN=${DM_ORIGIN:-https://delivery-p64403-e544653.adobeaemcloud.com}

# https://www.aem.live/developer/cli-reference#general-options
AEM_LOG_LEVEL=${AEM_LOG_LEVEL:-info}

export FORCE_COLOR=1
set -e
set -o pipefail

# ANSI background colors
BG_YELLOW=$'\033[43m'
BG_BLUE=$'\033[44m'
BG_MAGENTA=$'\033[45m'
# ANSI Reset
NC=$'\033[0m'

function prefix() {
  sed "s/^/${1}${2}$NC /"
}

function update_cloudflare_secrets() {
  cd cloudflare

  # parse CLOUDFLARE_SECRET_STORE_ID out of wrangler.toml, only the first match
  CLOUDFLARE_SECRET_STORE_ID=$(grep -m 1 'store_id = "' wrangler.toml | sed 's/.*store_id = "\(.*\)".*/\1/')
  # if not found
  if [ -z "$CLOUDFLARE_SECRET_STORE_ID" ]; then
    echo "Error: no secret store_id found in cloudflare/wrangler.toml"
    exit 1
  fi

  if [ ! -f .secrets ]; then
    echo "Error: missing cloudflare/.secrets file"
    exit 1
  fi
  # clean local secret store to make it be identical to the .secrets file
  rm -rf .wrangler/state/v3/secrets-store
  # load secrets from .secrets file
  echo "Loading secrets from cloudflare/.secrets into local wrangler secret store..."
  ./scripts/load-secret-store.sh $CLOUDFLARE_SECRET_STORE_ID .secrets

  # create IMS token for DM
  echo "Generating IMS token for DM..."
  source .secrets
  if [ -z "$KOASSETS_DM_CLIENT_ID" ] || [ -z "$KOASSETS_DM_CLIENT_SECRET" ]; then
    echo "Error: KOASSETS_DM_CLIENT_ID and KOASSETS_DM_CLIENT_SECRET are required in cloudflare/.secrets"
    exit 1
  fi
  DM_TOKEN=$(./scripts/create-ims-token.sh "$KOASSETS_DM_CLIENT_ID" "$KOASSETS_DM_CLIENT_SECRET" "AdobeID,openid")

  echo "$DM_TOKEN" | WRANGLER_LOG=error \
    npx wrangler secrets-store secret create $CLOUDFLARE_SECRET_STORE_ID \
      --scopes workers \
      --name KOASSETS_DM_ACCESS_TOKEN > /dev/null

  # npx wrangler secrets-store secret list $CLOUDFLARE_SECRET_STORE_ID

  cd - > /dev/null
}

function filter_cf_logs() {
  if [ "$CLOUDFLARE_REQUEST_LOGS" != "1" ]; then
    grep --line-buffered -v -E "^.*\[wrangler:info\].*(GET|HEAD|POST|OPTIONS|PUT|DELETE|TRACE|CONNECT)"
  else
    cat
  fi
}

function run_cloudflare() {
  cd cloudflare

  # add "--live-reload" if auto-reload on cloudflare changes is needed
  npx wrangler dev \
    --var "HELIX_ORIGIN:http://localhost:3000" \
    --var "DM_ORIGIN:${DM_ORIGIN}" \
    2>&1 | filter_cf_logs
}

function run_aem() {
  # add "--log-level silly" if full aem logs are needed
  npx aem up --no-open --livereload --log-level "${AEM_LOG_LEVEL}"
}

function run_react_build() {
  cd koassets-react
  npx chokidar "**" -i "dist/**" -c "npm run build-local-dev"
}

update_cloudflare_secrets | prefix $BG_YELLOW "[cfl]"

# cloudflare worker: http://localhost:8787
(run_cloudflare 2>&1 | prefix $BG_YELLOW "[cfl]" ) &

sleep 1
echo

# aem: http://localhost:3000
(run_aem 2>&1 | prefix $BG_MAGENTA "[aem]") &

sleep 1
echo

# vite react build (on file change)
(run_react_build 2>&1 | prefix $BG_BLUE "[vte]") &

sleep 1

open -a "${DEV_BROWSER:-Google Chrome}" http://localhost:8787

sleep 1

echo
echo "-------------------------------------------------------------------------------------"
echo
echo "Started the following stack:"
echo
echo  "${BG_YELLOW}[cfl]$NC  http://localhost:8787    Cloudflare Worker"
echo "               |"
echo "               +-----> Local worker code in cloudflare/*"
echo "               |"
echo "               +-----> /api: Dynamic Media API (env var: DM_ORIGIN)"
echo "               |             ${DM_ORIGIN}"
echo "               |"
echo "               | EDS origin"
echo "               ↓"
echo "${BG_MAGENTA}[aem]$NC  http://localhost:3000    AEM Helix"
echo "               |"
echo "               +-----> Local EDS code in *"
echo "               |"
echo "               +-----> EDS Content (env var: AEM_PAGES_URL)"
echo "               |       ${AEM_PAGES_URL}"
echo "               |"
echo "               | React build in /tools/assets-browser/index.(js|css)"
echo "               ↓"
echo    "${BG_BLUE}[vte]$NC  Vite auto-rebuild on file changes inside koassets-react/*"
echo
echo "Running at http://localhost:8787"
echo
echo "-------------------------------------------------------------------------------------"
echo

wait
