# KO Assets Pilot

Astra Pilot for an Assets Share Portal built on Helix & Content Hub (Dynamic Media) APIs.

## Environments

- Live: https://koassets.adobeaem.workers.dev/tools/assets-browser/index.html
- Branch: <https://{branch}-koassets.adobeaem.workers.dev/tools/assets-browser/index.html>

Helix origin:
- Live: https://main--koassets--aemsites.aem.live
- Preview: https://main--koassets--aemsites.aem.page

## Documentation

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:

1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template and add a mountpoint in the `fstab.yaml`
2. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
3. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
4. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
5. Open the `{repo}` directory in your favorite IDE and start coding :)

## KO-Asset Search React App

Parts of the app are built in react. The sources are located in the [koassets-react](koassets-react) folder.

A build step enforced in a github pre-commit hook builds the react app and copies the output to the `tools/assets-browser` folder.

## Cloudflare Worker

A Cloudflare Worker is located in the [cloudflare](cloudflare) folder. This worker handles the site and sits in front of AEM Helix and Dynamic Media.
