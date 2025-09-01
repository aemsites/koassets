# KO Assets Pilot

Astra Pilot for an Assets Share Portal built on Helix & Content Hub (Dynamic Media) APIs.

## Environments

Main site (cloudflare worker):
- Live: https://koassets.adobeaem.workers.dev/l
- Branch: <https://{branch}-koassets.adobeaem.workers.dev/>

Helix origin:
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

## Linting

Should work in each project folder:

```sh
npm run lint
```

## Local development

Run full stack locally (cloudflare worker, aem, auto-rebuild of react code)
```sh
npm run dev
```

This should open <http://localhost:8787> in your browser and auto-reload on frontend code changes (EDS or React code). The react code is automatically re-built on file changes.

Use `Ctrl+C` to stop the local development stack.

To open a different browser than your default browser, set the `DEV_BROWSER` environment variable:
```sh
DEV_BROWSER=Safari
DEV_BROWSER=Google Chrome
DEV_BROWSER=Firefox
```

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
