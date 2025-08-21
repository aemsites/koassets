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

  echo "CI deployment"
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

helixOrigin="$branch--koassets--aemsites.aem.live"

export FORCE_COLOR=1

npx wrangler versions upload \
  --preview-alias "$tag" \
  --tag "$tag" \
  --message "$message" \
  --var "HELIX_ORIGIN_HOSTNAME:$helixOrigin" \
  | tee >(grep "Worker Version ID:" | cut -d " " -f 4 > version.id)

version=$(cat version.id)
rm version.id

echo "Helix Origin : $helixOrigin"
echo "Worker URL   : https://$tag-koassets.adobeaem.workers.dev"

# on CI and main branch, deploy to production
if [ "$ci" = "true" ] && [ "$branch" = "main" ]; then
  npx wrangler versions deploy -y "$version"
  echo
  echo "Production URL: https://koassets.adobeaem.workers.dev"
fi

if [ "$tail" = "true" ]; then
  npx wrangler tail --version-id "$version"
fi