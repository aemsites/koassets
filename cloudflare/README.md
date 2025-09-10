# KO Assets Cloudflare Worker

A Cloudflare Worker that acts as outermost CDN for the KO Assets project with some additional features. It provides authentication, authorization, edge caching, and request routing to the various AEM backends (Helix/EDS, Dynamic Media OpenAPI and more).

- [Worker in Cloudflare Dashboard](https://dash.cloudflare.com/852dfa4ae1b0d579df29be65b986c101/workers/services/view/koassets/production/metrics)
- Live: https://koassets.adobeaem.workers.dev
- Branch Live: <https://{branch}-koassets.adobeaem.workers.dev>
- Preview: https://preview-koassets.adobeaem.workers.dev
- Branch Preview: <https://{branch}-preview-koassets.adobeaem.workers.dev>

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

It is recommended to run the [full local development stack](../README.md#local-development) using `npm run dev` in the **root folder of the git repository**.

If you _only_ want to run the cloudflare worker locally:

1. Make sure you have `.secrets` file with required [secret store secrets](#secret-store). See [example here](../README.md#local-development).
2. Run `npm run dev`

To overwrite configurations locally, change them in `wrangler.toml` or create an `.env` file to overwrite (do not commit).
For defining secrets they all go into the `.secrets` file.

### Tests

```bash
npm test
```

### Linting

This cloudflare folder uses [Biome](https://biomejs.dev/) for linting and formatting.

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

On each branch/PR push, the Github Actions CI will automatically deploy brancher worker URLs:

| URL | Helix origin |
|-----|--------------|
| `https://{branch}-koassets.adobeaem.workers.dev` | `https://{branch}--koassets--aemsites.aem.live` |
| `https://{branch}-preview-koassets.adobeaem.workers.dev` | `https://{branch}--koassets--aemsites.aem.page` |


### CI main

On each `main` branch push, the Github ActionsCI will do the same as above and additionally deploy that same worker version to "production" worker URLs:


| URL | Helix origin |
|-----|--------------|
| https://koassets.adobeaem.workers.dev | https://main--koassets--aemsites.aem.live |
| https://preview-koassets.adobeaem.workers.dev | https://main--koassets--aemsites.aem.page |

### Manual deploy

To deploy local work manually, you can run

```bash
npm run deploy

# implemented in
./scripts/deploy.sh
```

This will deploy the worker to the preview URL using the `user` id (git email address without the domain) and `branch` name:

```bash
https://{user}-{branch}-koassets.adobeaem.workers.dev
```

This will use the same `branch` for the Helix origin: `{branch}--koassets--aemsites.aem.live`

Options:

- `npm run deploy -- "my change"`: add custom message for the worker version in Cloudflare
- `npm run deploy -- --tail`: tail logs after deployment (Note: seems to not work well for specific worker versions)


## Configuration

Most configuration is done via environment variables in the `wrangler.toml` file:

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

⚠️ _Need to migrate all worker secrets below to the Secret Store_

### Worker Secrets

These secrets must **not** be checked into git, and must be stored as [secrets in Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

* Production: Add secrets via the Cloudflare dashboard or use `wrangler secret put`
* Local development: store secrets (and other local config) in a `.env` local file before running `npm run dev`

| Variable | Description |
|----------|-------------|
| `HELIX_ORIGIN_AUTHENTICATION` | AEM EDS authentication token. |
| `MICROSOFT_ENTRA_CLIENT_SECRET` | Client secret from the app registration in Microsoft Entra admin center. |
| `COOKIE_SECRET` | Secret used to sign the session cookie. Must be a cryptographically secure random string of characters. Can be generated on a command line using `openssl rand -base64 32`. |

### Secret Store

To ease rotation of secrets, without having to re-deploy the worker, we use [Secret Store](https://developers.cloudflare.com/secrets-store/) instead of worker secrets ([explanation of the differences](https://github.com/cloudflare/workers-sdk/issues/10585#issuecomment-3271987962)).

To configure these secrets locally (for use with `npm run dev`), create a `.secrets` file in this folder and add the secret store secrets there.

Secret Store ID: `5d64b0d295964846b36569f507fb7b13`

* As options are limited in the Secret Store beta, we are using the _default secret store_ in the Franklin (Dev) account.
* And use a common prefix `KOASSETS_` for individual secrets, to avoid conflicts with other workers.
* Ideally this should be a dedicated secret store just for `koassets`. In which case we would not need the prefix.

| Name in Secret Store | Variable Name in Code | Description | Rotation |
|----------------------|-----------------------|-------------|----------|
| `KOASSETS_DM_CLIENT_ID` | `DM_CLIENT_ID` | Client ID for the DM IMS technical account used to access `DM_ORIGIN`. | Only changed if the DM IMS technical account is changed. |
| `KOASSETS_DM_ACCESS_TOKEN` | `DM_ACCESS_TOKEN` | Access token from the DM IMS technical account used to access `DM_ORIGIN`. Valid 24 hours. | Automatically rotated every 6 hours using the `rotate-dm-token.yaml` Github Action.<br><br>Manually rotate by running<br><br>```./scripts/create-ims-token.sh $DM_CLIENT_ID $DM_CLIENT_SECRET "AdobeID,openid"```<br><br> and updating in secret store. |

### CI secrets

These secrets need to be configured in the CI (Github Actions) and are used for deployment and secret rotation workflows.

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token used to deploy workers and rotate secrets via [Github Actions](../.github/workflows/). |
| `DM_CLIENT_ID` | Client ID for the DM IMS technical account used to access `DM_ORIGIN`. |
| `DM_CLIENT_SECRET` | Client secret for the DM IMS technical account used to access `DM_ORIGIN`. |
