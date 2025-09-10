import {
  convertHtmlListToArray, fetchSpreadsheetData, getBlockKeyValues, stripHtmlAndNewlines,
} from '../../scripts/scripts.js';

export default async function decorate(block) {
  // Get the block key-value pairs
  const blockObj = getBlockKeyValues(block);

  // Get configs spreadsheets
  const configs = await fetchSpreadsheetData('configs');
  const restrictedBrands = configs?.['shared-restricted-brands']?.data || configs?.data;

  // Clear the block content
  block.textContent = '';

  // Create container div for the React app
  const reactContainer = document.createElement('div');
  reactContainer.id = 'koassets-search-container';
  reactContainer.className = 'koassets-search-container';

  // Set container styles for natural page integration
  reactContainer.style.width = '100%';
  // Remove height: 100vh to allow natural scrolling
  reactContainer.style.minHeight = '600px';
  reactContainer.style.position = 'relative';

  // Create root div for React mounting (same ID as used in main.tsx)
  const reactRoot = document.createElement('div');
  reactRoot.id = 'root';
  reactRoot.className = 'koassets-search-root';
  reactContainer.appendChild(reactRoot);

  // Add loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'koassets-loading';
  loadingIndicator.innerHTML = `
    <div class="loading-spinner"></div>
    <p>Loading KO Assets...</p>
  `;
  reactContainer.appendChild(loadingIndicator);

  // Append container to block
  block.append(reactContainer);

  // Configure external parameters for block integration
  window.KOAssetsConfig = window.KOAssetsConfig || {};
  /** @type {import('../../koassets-react/src/types/index.js').ExternalParams} */
  window.KOAssetsConfig.externalParams = {
    isBlockIntegration: true,
    accordionTitle: blockObj.accordionTitle,
    accordionContent: blockObj.accordionContent,
    excFacets: JSON.parse(stripHtmlAndNewlines(blockObj.excFacets)),
    restrictedBrands,
    presetFilters: convertHtmlListToArray(blockObj.presetFilters),
    ...(window.KOAssetsConfig.externalParams || {}),
  };

  // Load the built React app
  loadReactApp(reactRoot, loadingIndicator);
}

function loadReactApp(rootElement, loadingElement) {
  try {
    // Check if we already have the built assets
    const basePath = '/tools/assets-browser';

    // First, load the CSS
    loadCSS(`${basePath}/assets/index.css`);

    // Then load the JavaScript bundle
    loadJS(`${basePath}/assets/index.js`)
      .then(() => {
        // Remove loading indicator once app is loaded
        loadingElement.remove();
        console.log('KO Assets Search app loaded successfully');
      })
      .catch((error) => {
        console.error('Failed to load React app:', error);
        showError(
          loadingElement,
          'Failed to load KO Assets Search App',
          'Please ensure the React app is built and deployed to /tools/assets-browser/',
        );
      });
  } catch (error) {
    console.error('Error initializing React app:', error);
    showError(loadingElement, 'Error Loading KO Assets Search', error.message);
  }
}

function loadCSS(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.onerror = () => console.warn(`Failed to load CSS: ${href}`);
  document.head.appendChild(link);
}

function loadJS(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function showError(element, title, message) {
  element.innerHTML = `
    <div class="error-message">
      <h3>${title}</h3>
      <p>${message}</p>
      <p><strong>To fix this:</strong></p>
      <ol>
        <li>Navigate to the koassets-react directory</li>
        <li>Run: <code>npm run build-and-copy:koassets-react</code></li>
        <li>Refresh this page</li>
      </ol>
    </div>
  `;
}
