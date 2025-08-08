# Your Project's Title...

Astra Assets Experiment

## Environments

- Preview: https://main--{repo}--{owner}.aem.page/
- https://main--koassets--aemsites.aem.page/
- Live: https://main--{repo}--{owner}.aem.live/
- https://main--koassets--aemsites.aem.live/

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

### KO-Asset Search React App

The KO-Asset Search React application is located in the `koassets-react/` folder. This is a comprehensive asset browsing and management application with Adobe IMS authentication.

**📚 Full Documentation:** See [`koassets-react/README.md`](koassets-react/README.md) for complete setup, configuration, and deployment instructions.

