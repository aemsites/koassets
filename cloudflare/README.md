# KO Assets Cloudflare Worker

A Cloudflare Worker that acts as outermost CDN for the KO Assets project with some additional features. It provides authentication, authorization, edge caching, and request routing to the various AEM backends (Helix/EDS, Dynamic Media OpenAPI and more).

Worker URL: https://koassets.adobeaem.workers.dev

[Worker in Cloudflare Dashboard](https://dash.cloudflare.com/852dfa4ae1b0d579df29be65b986c101/workers/services/view/koassets/production/metrics)

## Setup

- Node.js and npm installed
- Cloudflare account with Workers enabled
  - Deploying to the pilot at https://koassets.adobeaem.workers.dev requires access to the Cloudflare account `Franklin (Dev)`
- Run `npm install` to install the dependencies

## Deploy

By default the worker will deploy to the pilot https://koassets.adobeaem.workers.dev.

Deploying to a different account and/or worker requires changes in the `wrangler.toml` file:
 - `name` - The worker name
 - `account_id` - The Cloudflare account ID

The `wrangler` cli will automatically open a browser window to log into a Cloudflare account when running commands below.

```bash
# Make sure to run tests first
npm test

# Deploy the worker
npm run deploy

# Deploy and then tail logs
npm run deploy-tail

# Just tail logs
npm run log
```
You can also use the [wrangler](https://developers.cloudflare.com/workers/wrangler/) CLI directly:

```bash
npx wrangler ...
```


## Configuration

Most configuration is done via environment variables in the `wrangler.toml` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `ORIGIN_HOSTNAME` | `main--koassets--aemsites.aem.live` | The EDS origin server (`*.aem.live`) |
| `ORIGIN_AUTHENTICATION` | - | Optional authentication token (if EDS site authentication is enabled). Since this is a credential it is provided via environment variables and not checked into git. |

