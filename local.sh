#!/bin/bash

# shellcheck disable=SC2164

AEM_PAGES_URL=${AEM_PAGES_URL:-https://main--koassets--aemsites.aem.page}
DM_ORIGIN=${DM_ORIGIN:-https://delivery-p64403-e544653.adobeaemcloud.com}

# https://www.aem.live/developer/cli-reference#general-options
AEM_LOG_LEVEL=${AEM_LOG_LEVEL:-info}

# No Color / Reset
NC=$'\033[0m'
# Background colors
BG_YELLOW=$'\033[43m'
BG_BLUE=$'\033[44m'
BG_MAGENTA=$'\033[45m'

function prefix() {
  sed "s/^/${1}${2}$NC /"
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
  npx wrangler dev --env-file .env --var "HELIX_ORIGIN:http://localhost:3000" --var "DM_ORIGIN:${DM_ORIGIN}" 2>&1 | filter_cf_logs
}

function run_aem() {
  # add "--log-level silly" if full aem logs are needed
  npx aem up --no-open --livereload --log-level "${AEM_LOG_LEVEL}"
}

function run_react_build() {
  cd koassets-react
  npx chokidar "**" -i "dist/**" -c "npm run build-local-dev"
}

export FORCE_COLOR=1
set -o pipefail

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
