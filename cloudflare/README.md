# KO Assets Cloudflare Worker

A Cloudflare Worker that acts as outermost CDN for the KO Assets project with some additional features. It provides authentication, authorization, edge caching, and request routing to the various AEM backends (Helix/EDS, Dynamic Media OpenAPI and more).

Production Worker URL: https://koassets.adobeaem.workers.dev
Branch URLs: `https://{branch}-koassets.adobeaem.workers.dev`

[Worker in Cloudflare Dashboard](https://dash.cloudflare.com/852dfa4ae1b0d579df29be65b986c101/workers/services/view/koassets/production/metrics)

## Setup

- Node.js and npm installed
- Cloudflare account with Workers enabled
  - Deploying to the pilot at https://koassets.adobeaem.workers.dev requires access to the Cloudflare account `Franklin (Dev)`, id: `852dfa4ae1b0d579df29be65b986c101`
  - The `wrangler` cli used by the various command below will automatically open a browser window to log into Cloudflare.
- Run `npm install` to install the dependencies

## Develop

### Local server
To develop and debug locally, run:

```bash
npm run dev
```

This runs [wrangler dev](https://developers.cloudflare.com/workers/development-testing/#local-development) which will start a local server with the worker at http://localhost:8787.

### Tests

```bash
npm test
```

### Linting

We use [Biome](https://biomejs.dev/) for linting and formatting.

```bash
npm run lint
```

To automatically fix linting errors and format files, run:

```bash
npm run lint:fix
```

### Tail production logs

To see the logs for the production worker (or all deployed workers), run:

```bash
npm run tail
```

then make test requests to the worker.


## Deploying

### CI branch

On each branch/PR push, the Github Actions CI will automatically deploy the worker under a preview URL for the `branch`:

```bash
https://{branch}-koassets.adobeaem.workers.dev
```

This will use the same branch for the Helix origin: `{branch}--koassets--aemsites.aem.live`

### CI production

On each `main` branch push, the Github ActionsCI will do the same as above and additionally deploy that same worker version to production at https://koassets.adobeaem.workers.dev.


### Manual deploy

To deploy local work manually, you can run

```bash
npm run deploy

# alternatively
./deploy.sh
```

This will deploy the worker to the preview URL using the `user` id (git email address without the domain) and `branch` name:

```bash
https://{user}-{branch}-koassets.adobeaem.workers.dev
```

This will use the same `branch` for the Helix origin: `{branch}--koassets--aemsites.aem.live`

Options (use with `./deploy.sh`):

- `./deploy.sh "my change"`: add custom message for the worker version in Cloudflare
- `./deploy.sh --tail`: tail logs after deployment (Note: seems to not work well for specific worker versions)


## Configuration

Most configuration is done via environment variables in the `wrangler.toml` file. Important variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `name` | `koassets` | The worker name |
| `account_id` | `852dfa4ae1b0d579df29be65b986c101` | The Cloudflare account ID |
| `HELIX_ORIGIN_HOSTNAME` | `main--koassets--aemsites.aem.live` | The EDS origin server (`*.aem.live`) |
| `DM_ORIGIN_HOSTNAME` | `delivery-p64403-e544653.adobeaemcloud.com` | The Content Hub/Dynamic Media environment. |
| `HELIX_ORIGIN_AUTHENTICATION` | - | Optional EDS authentication token. Since this is a credential it is provided via environment variables and not checked into git. |

