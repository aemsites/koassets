# KO Assets Cloudflare Worker

A Cloudflare Worker that acts as outermost CDN for the KO Assets project with some additional features. It provides authentication, authorization, edge caching, and request routing to the various AEM backends (Helix/EDS, Dynamic Media OpenAPI and more).

Worker URL: https://koassets.adobeaem.workers.dev

[Worker in Cloudflare Dashboard](https://dash.cloudflare.com/852dfa4ae1b0d579df29be65b986c101/workers/services/view/koassets/production/metrics)

## Setup

- Node.js and npm installed
- Cloudflare account with Workers enabled
  - Deploying to the pilot at https://koassets.adobeaem.workers.dev requires access to the Cloudflare account `Franklin (Dev)`
- Run `npm install` to install the dependencies

## Develop locally

```bash
npm run dev
```

Runs [wrangler dev](https://developers.cloudflare.com/workers/development-testing/#local-development) which will start a local server with the worker at http://localhost:8787.

## Deploy

By default the worker will deploy to the pilot https://koassets.adobeaem.workers.dev.

Deploying to a different account and/or worker requires changes in the `wrangler.toml` file:
 - `name` - The worker name
 - `account_id` - The Cloudflare account ID

The `wrangler` cli will automatically open a browser window to log into a Cloudflare account when running commands below.

```bash
# Make sure to run tests first
npm test

# Deploy current branch to preview URL
# https://${branch}-koassets.adobeaem.workers.dev
npm run deploy

# Deploy (branch) and then tail logs
npm run deploy-tail

# Tail logs on current branch
npm run tail

# Deploy to production
# https://koassets.adobeaem.workers.dev
npm run deploy:prod

# Tail logs on production
npm run tail:prod
```
You can also use the [wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI directly:

```bash
npx wrangler ...
```

### Deployment options

1. develop/run worker locally
   - use helix origin: main--koassets--aemsites.aem.live
     or a custom one, set with `npm run dev --var HELIX_ORIGIN_HOSTNAME:custom--koassets--aemsites.aem.live` or in `wrangler.toml`
   - USE CASE: quickly develop locally
   - IMPL: `npm run dev`
2. deploy branch
   - create version with tag: <branch> and message: <commit message> (or `<local changes>` if there are local changes)
   - use helix origin: <branch>--koassets--aemsites.aem.live
   - under preview-alias: <branch>
   - USE CASE: CI on branch pushes
   - IMPL: shell script with tee in github action yaml
3. deploy prod
   - create version with tag: <branch> and message: <commit message> (or `<local changes>` if there are local changes)
   - standard helix origin: main--koassets--aemsites.aem.live (configured in `wrangler.toml`)
   - deploy version to production
   - USE CASE: CI on main pushes
   - IMPL: shell script with tee in github action yaml
4. deploy manually as developer
   - allow control of --message and --tag
   - allow control of helix origin
   - either as --preview-alias or production
   - USE CASE: manual deploy as developer to fix something or fine control
   - IMPL: directly call `npx wrangler` or some helper `npm run deploy` with arguments



## Configuration

Most configuration is done via environment variables in the `wrangler.toml` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `ORIGIN_HOSTNAME` | `main--koassets--aemsites.aem.live` | The EDS origin server (`*.aem.live`) |
| `ORIGIN_AUTHENTICATION` | - | Optional authentication token (if EDS site authentication is enabled). Since this is a credential it is provided via environment variables and not checked into git. |

