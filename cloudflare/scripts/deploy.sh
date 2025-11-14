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
  echo "Deploying alias '$1'"
  echo "HELIX_ORIGIN: $HELIX_ORIGIN"

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

  # Sanitize branch name for Cloudflare alias (replace / with -)
  tag="${branch//\//-}"
  # last commit message
  message=$(git log -1 --pretty="%aL: %s")

  echo "================================================================"
  echo "DEBUG: git diff --name-only origin/main..HEAD"
  git diff --name-only origin/main..HEAD
  echo "================================================================"

  if git diff --name-only origin/main..HEAD | grep "^cloudflare\/"; then
    message="[CF] $message"
  fi

else
  echo "Manual deployment"
  user=$(git config user.email | cut -d@ -f 1)
  branch=$(git branch --show-current)
  # Sanitize branch name for Cloudflare alias (replace / with -)
  sanitized_branch="${branch//\//-}"
  tag="$user-$sanitized_branch"
  if [ -z "$message" ]; then
    if git diff --quiet .; then
      # no local changes, use last commit message
      message=$(git log -1 --pretty="%aL: %s")
    else
      # local changes found
      message="$user: <local changes>"
    fi
  fi

  if git diff --name-only main | grep "^cloudflare\/"; then
    message="[CF] $message"
  fi
fi

echo
echo "Branch : $branch"
echo "Tag    : $tag"
echo "Message: $message"
echo

export FORCE_COLOR=1

if [ "$tag" = "preview" ]; then
  echo "ERROR: branch name 'preview' is reserved for production preview URL."
  exit 1
fi

if [ "$ci" = "true" ] && [ "$branch" = "main" ]; then
  # production deployment
  url="https://$WORKER.adobeaem.workers.dev"

  # create preview version pointing to aem.page
  HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.page"
  upload_version "preview" "$message"

  # create main version
  # do last so usually the latest == production version (and not the "preview-" above)
  HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.live"
  upload_version "$tag" "$message"
  version=$(cat version.id)

  # deploy main version as production
  npx wrangler versions deploy -y "$version"

else
  # branch/local deployment
  url="https://$tag-$WORKER.$WORKER_DOMAIN.workers.dev"

  # create branch version (using preview content)
  HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.page"
  upload_version "$tag" "$message"
  version=$(cat version.id)

  # create branch live version (using live content)
  HELIX_ORIGIN="https://$branch--$REPO--$ORG.aem.live"
  upload_version "$tag-live" "$message"
fi

rm version.id || true

echo
echo "======================================================================================================================"
echo "Branch Worker URL (preview): https://$tag-$WORKER.$WORKER_DOMAIN.workers.dev"
echo "Branch Worker URL (live)   : https://$tag-live-$WORKER.$WORKER_DOMAIN.workers.dev"
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
