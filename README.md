# KO Assets Pilot

Astra Pilot for an Assets Share Portal built on Helix & Content Hub (Dynamic Media) APIs.

## Environments

### Main site (cloudflare worker):
- Live: https://koassets.adobeaem.workers.dev
- Branch Live: <https://{branch}-koassets.adobeaem.workers.dev>
- Preview: https://preview-koassets.adobeaem.workers.dev
- Branch Preview: <https://{branch}-preview-koassets.adobeaem.workers.dev>

Note: For branch URLs to work, the branch names must be short and only include lowercase letters, numbers, and dashes characters. Due to [cloudflare worker alias limitations](https://developers.cloudflare.com/workers/configuration/previews/#rules-and-limitations).

### Helix origins
- Live: https://main--koassets--aemsites.aem.live
- Preview: https://main--koassets--aemsites.aem.page

## Project structure

This project is based on the [aem-boilerplate](https://github.com/adobe/aem-boilerplate) template and adds both React components and a Cloudflare worker.

List of projects, each with their own `package.json`:
- root - the AEM EDS main project
- [koassets-react](koassets-react): React app/components
  - build goes to `tools/assets-browser/index.(js|css)`
- [cloudflare](cloudflare): Cloudflare worker for the assets share portal

### AEM EDS

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:

1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

### KO-Asset Search React App

Parts of the app are built in react. The sources are located in the [koassets-react](koassets-react) folder.

A build step enforced in a github pre-commit hook builds the react app and copies the output to the `tools/assets-browser` folder.

### Cloudflare Worker

A Cloudflare Worker is located in the [cloudflare](cloudflare) folder. This worker handles the site and sits in front of AEM Helix and Dynamic Media.

## Installation

Install npm dependencies everywhere, in main and child projects:

```sh
npm run install-all
```

### Cleanup

To cleanup the checkout (remove all `node_modules`, build and cache folders etc.) run this first in the root:

```sh
npm run clean
```

## Local development

### Initial setup

Add `cloudflare/.secrets` file with the [required secrets](cloudflare/README.md#secret-store), such as:

```
# Cookie authentication
# For local development, not the same as production. generate using `openssl rand -base64 32`
KOASSETS_COOKIE_SECRET="..."

# DM IMS technical account token
# Get from Adobe developer console project with access to DM_ORIGIN environment
KOASSETS_DM_CLIENT_ID="..."
KOASSETS_DM_CLIENT_SECRET="..."
```

### Run full stack locally

```sh
npm run dev
```

This should open <http://localhost:8787> in your browser. Use `Ctrl+C` to stop it.

This runs a local cloudflare worker (`wrangler dev`), local EDS (`aem up`) and does auto-rebuild of react code (using `vite build`).

Note you will need to stop and restart `npm run dev` after 24 hours to renew the DM IMS technical account token.

Environment variables supported by `npm run dev`:

| Variable | Description | Default |
|----------|-------------|---------|
| `AEM_PAGES_URL` | EDS content URL | https://main--koassets--aemsites.aem.page |
| `DM_ORIGIN` | Dynamic Media API URL | https://delivery-p64403-e544653.adobeaemcloud.com |
| `DEV_BROWSER` | Browser to open. Mac OS only.<br><br>Options:<ul><li>`Google Chrome`</li><li>`Safari`</li><li>`Firefox`</li></ul> | - (system default) |
| `AEM_LOG_LEVEL` | Set [`aem` log level](https://www.aem.live/developer/cli-reference#general-options). | `info` |
| `CLOUDFLARE_LOG_LEVEL` | Set [wrangler dev --log-level](https://developers.cloudflare.com/workers/wrangler/commands/#dev). Maps to `console.<level>()` in js. <br><br>From most to least verbose: <ul><li>`debug` (avoid, very noisy with internals)</li><li>`log`</li><li>`info`</li><li>`warn`</li><li>`error`</li><li>`none`</li></ul> | `info`<br><br> This hides `console.log` output, but works well if you treat `console.log` as "debug" level that should be hidden by default from local output. Then use `console.info` for your test logs you want to see immediately.  |
| `CLOUDFLARE_REQUEST_LOGS` | Set to `1` to show request logs from cloudflare worker, which is the default behavior of `wrangler dev` but we turn it off to keep things readable.<br><br> Example request log:<br>`[wrangler:info] GET /path 200 OK (10ms)` | - (off) |

### Troubleshooting: Ports still open

If after quitting `npm run dev` ports 8787 and 3000 on localhost are still in use because processes are left behind, run this:

1. List processes from this script:
   ```sh
   ps x | grep -vF grep | grep -E "(local.sh|wrangler|chokidar|aem up)"
   ```

2. Kill these processes:
   ```sh
   ps x | grep -vF grep | grep -E "(local.sh|wrangler|chokidar|aem up)" | awk '{print $1}' | xargs kill
   ```

## Linting

Should work in each project folder:

```sh
npm run lint
```

## CI/CD

[Github actions](.github/workflows/) build & lint the project, and automatically [deploy the cloudflare worker](cloudflare/README.md#deploying). They also automatically rotate secrets (running on a cron schedule).

Github actions must be configured with these [secrets](cloudflare/README.md#ci-secrets) and [variables](cloudflare/README.md#ci-variables).