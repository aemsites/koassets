#!/bin/bash

# Smart deploy for Cloudflare Workers
# Deploys to a preview alias URL based on branch name.

# Usage: ./deploy.sh [--ci branch] [--tail] [message]
#
# CI:
# - invoke: ./deploy.sh --ci <branch>
# - uses tag = preview-alias = branch
# - points Helix origin to <branch> aem.live
# - if branch is main, deploys to production
#
# Manual:
# - invoke: ./deploy.sh "message"
# - uses branch = current git branch
# - uses tag = <user>-<branch>
# - points Helix origin to <branch> aem.live

# Configuration
# Helix github
REPO=koassets
ORG=aemsites
# cloudflare worker
WORKER=koassets
WORKER_DOMAIN=adobeaem

# Usage: upload_version <tag> <message>
# Returns version id in version.id file
function upload_version() {
  npx wrangler versions upload \
    --preview-alias "$1" \
    --tag "$1" \
    --message "$2" \
    --var "HELIX_ORIGIN:$HELIX_ORIGIN" \
    | tee >(grep "Worker Version ID:" | cut -d " " -f 4 > version.id)
}

set -e
set -o pipefail

# parse arguments
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --ci) ci=true; branch="$2"; shift ;;
    --tail) tail=true; shift ;;
    *) message="$1"; shift ;;
  esac
done

if [ "$ci" = "true" ]; then
  # remove any refs/heads/ prefix
  branch="${branch#refs/heads/}"

  if [ "$branch" = "main" ]; then
    echo "CI deployment (production)"
  else
    echo "CI deployment (branch)"
  fi

  tag="$branch"
  # last commit message
  message=$(git log -1 --pretty=%B)

else
  echo "Manual deployment"
  user=$(git config user.email | cut -d@ -f 1)
  branch=$(git branch --show-current)
  tag="$user-$branch"
  if [ -z "$message" ]; then
    if git diff --quiet .; then
      # no local changes, use last commit message
      message=$(git log -1 --pretty=%B)
    else
      # local changes found
      message="<local changes>"
    fi
  fi
fi

echo
echo "Branch : $branch"
echo "Tag    : $tag"
echo "Message: $message"

export FORCE_COLOR=1

if [ "$tag" = "preview" ]; then
  echo "ERROR: branch name 'preview' is reserved for production preview URL."
  exit 1
fi

# 1. deploy branch url for EDS live content
HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.live"
upload_version "$tag" "$message"
version=$(cat version.id)

url="https://$tag-$WORKER.$WORKER_DOMAIN.workers.dev"

# 2. deploy branch url for EDS preview content
HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.page"
upload_version "$tag-preview" "$message"

if [ "$ci" = "true" ] && [ "$branch" = "main" ]; then
  # 3. on CI and main branch, deploy to production (live content)
  npx wrangler versions deploy -y "$version"

  url="https://$WORKER.adobeaem.workers.dev"

  # 4. on CI and main branch, deploy to preview alias
  upload_version "preview" "$message"
fi

rm version.id || true

echo
echo "======================================================================================================================"
echo "Branch Worker URL (preview): https://$tag-preview-$WORKER.$WORKER_DOMAIN.workers.dev"
echo "Branch Worker URL (live)   : https://$tag-$WORKER.$WORKER_DOMAIN.workers.dev"
if [ "$ci" = "true" ] && [ "$branch" = "main" ]; then
  echo
  echo "Production Worker URL (preview): https://preview-$WORKER.$WORKER_DOMAIN.workers.dev"
  echo "Production Worker URL (live)   : https://$WORKER.$WORKER_DOMAIN.workers.dev"
fi
echo "======================================================================================================================"

if [ -n "$GITHUB_OUTPUT" ]; then
  echo "tag=$tag" >> "$GITHUB_OUTPUT"
  echo "url=$url" >> "$GITHUB_OUTPUT"
  echo "version=$version" >> "$GITHUB_OUTPUT"
fi

if [ "$tail" = "true" ]; then
  npx wrangler tail --version-id "$version"
fi
