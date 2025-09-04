# KO Assets Cloudflare Worker

A Cloudflare Worker that acts as outermost CDN for the KO Assets project with some additional features. It provides authentication, authorization, edge caching, and request routing to the various AEM backends (Helix/EDS, Dynamic Media OpenAPI and more).

* Production Worker URL: https://koassets.adobeaem.workers.dev
* Branch URLs: `https://{branch}-koassets.adobeaem.workers.dev`
* [Worker in Cloudflare Dashboard](https://dash.cloudflare.com/852dfa4ae1b0d579df29be65b986c101/workers/services/view/koassets/production/metrics)

## Setup

- Node.js and npm installed
- Run `npm install` to install the dependencies
- (Only for manual deployments or log tailing) Access to deploy workers on the `Franklin (Dev)` account, id: `852dfa4ae1b0d579df29be65b986c101`
  - The `wrangler` cli used by the various command below will automatically open a browser window to log into Cloudflare.

### Change Cloudflare account

If you need to deploy to a different Cloudflare account:

- Requires a Cloudflare account with Workers enabled (free tier is sufficient)
- Change the `account_id` in the `wrangler.toml` file to the new account id
- Set `CLOUDFLARE_API_TOKEN` for Github Actions to a Cloudflare api token (ideally account api token) that can deploy workers on the account
- Ensure preview aliases are enabled on the worker (to support branch deployments)
- As necessary, update this README.md with the new worker URLs and configuration values


## Develop

### Local server
To develop and debug locally:

Create a `.env` file inside this folder with the necessary [Secrets](#secrets) and any other [Configuration](#configuration) variables that you want to override locally:

```
# Local development config and secrets

COOKIE_SECRET = "..."
MICROSOFT_ENTRA_CLIENT_SECRET = "..."
HELIX_ORIGIN_AUTHENTICATION = "..."
```

Then run:

```bash
npm run dev
```

This runs [wrangler dev](https://developers.cloudflare.com/workers/development-testing/#local-development) which will start a local server with the worker at http://localhost:8787. It will auto-reload on code changes.

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

| Variable | Default (in code) | Description |
|----------|---------|-------------|
| `name` | - | Cloudflare worker name |
| `account_id` | - | Cloudflare account ID |
| `HELIX_ORIGIN_` | - | AEM EDS origin server such as `https://*.aem.live` |
| `DM_ORIGIN` | - | AEM Content Hub/Dynamic Media environment URL such as `https://delivery-*.adobeaemcloud.com` |
| `HELIX_PUSH_INVALIDATION` | not set (invalidation enabled) | If set to `disabled`, disable push invalidation to the AEN EDS origin server. |
| `MICROSOFT_ENTRA_TENANT_ID` | - | Directory (tenant) ID from the app registration in Microsoft Entra admin center. |
| `MICROSOFT_ENTRA_CLIENT_ID` | - | Application (client) ID from the app registration in Microsoft Entra admin center. |
| `MICROSOFT_ENTRA_JWKS_URL` | `https://login.microsoftonline.com/common/discovery/keys` | The Microsoft Entra ID public keys URL. Get this from `https://login.microsoftonline.com/{MICROSOFT_ENTRA_TENANT_ID}/.well-known/openid-configuration` and json field `jwks_uri` |
| `SESSION_COOKIE_EXPIRATION` | `6h` | The expiration time for the session cookie. Example: `1h` for 1 hour, or `10m` for 10 minutes. [Format documentation](https://github.com/panva/jose/blob/main/docs/jwt/sign/classes/SignJWT.md#setexpirationtime) |
| `LOGIN_PAGE` | not set (go directly to MS login page) | The page to redirect to if the user is not authenticated. If not set, this will automatically go to the Microsoft login page. |
| `DISABLE_AUTHENTICATION` | not set (enabled) | If set to `true`, disable authentication entirely. WARNING: be careful with this! |

## Secrets

These secrets must **not** be checked into git, and must be stored as [secrets in Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

* Production: Add secrets via the Cloudflare dashboard or use `wrangler secret put`
* Local development: store secrets (and other local config) in a `.env` local file before running `npm run dev`

| Variable | Description |
|----------|-------------|
| `HELIX_ORIGIN_AUTHENTICATION` | AEM EDS authentication token. |
| `MICROSOFT_ENTRA_CLIENT_SECRET` | Client secret from the app registration in Microsoft Entra admin center. |
| `COOKIE_SECRET` | Secret used to sign the session cookie. Must be a cryptographically secure random string of characters. Can be generated on a command line using `openssl rand -base64 32`. |