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
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `{repo}` directory in your favorite IDE and start coding :)

### KO-Asset Search React App

The KO-Asset Search React application is located in the `react/` folder. This is a Vite-based React application that provides asset search functionality.

**Development workflow:**

1. Navigate to the `react/` directory
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. After making changes, build the application: `npm run build`
   - This runs `vite build` and automatically copies the built files to `../tools/assets-browser`
5. The built application will be available in the tools/assets-browser directory for integration with the main project
