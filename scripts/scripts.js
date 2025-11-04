import {
  buildBlock,
  decorateBlocks,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateTemplateAndTheme,
  loadCSS,
  loadFooter,
  loadHeader,
  loadSection,
  loadSections,
  waitForFirstImage,
} from './aem.js';

/**
 * Loads the logged inuser data.
 */
async function loadUser() {
  // TODO: run this every 5 minutes and warn when expiry is less than 30 minutes
  //       with option to re-authenticate

  window.user = undefined;
  try {
    const user = await fetch(`${window.location.origin}/api/user`);
    if (user.ok) {
      window.user = await user.json();
    }
  } catch (_ignore) {
    // do nothing
  }
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * Lazy preload hover-state icons after initial page load
 * This prevents blink on first hover while not blocking critical resources
 * Uses Image objects to force immediate caching
 */
function lazyPreloadHoverIcons() {
  const hoverIcons = [
    '/icons/shopping_cart_icon_red.svg',
    '/icons/download_icon_red.svg',
  ];

  const preloadHoverIcons = () => {
    hoverIcons.forEach((iconPath) => {
      // Create Image object to force browser to load and cache
      const img = new Image();
      img.src = iconPath;
    });
  };

  // Load immediately but after DOM content is ready
  // This ensures icons are cached before user interaction
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadHoverIcons);
  } else {
    // DOM already loaded, preload immediately
    preloadHoverIcons();
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  await loadUser();
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadCSS(`${window.hlx.codeBasePath}/styles/add-to-collection-modal.css`);
  loadCSS(`${window.hlx.codeBasePath}/scripts/share/share-assets-modal.css`);
  loadFonts();

  // Lazy preload hover icons to prevent blink on first hover
  lazyPreloadHoverIcons();

  // Initialize add to collection modal functionality
  import('./collections/add-to-collection-modal.js').then(async ({ initAddToCollectionModal }) => {
    await initAddToCollectionModal();
  }).catch(() => {
    // Fallback for environments where the module might not be available
    console.log('Add to collection modal not available');
  });
}

// Initialize share assets modal functionality
import('./share/share-assets-modal.js').then(async ({ initShareAssetsModal }) => {
  await initShareAssetsModal();
}).catch(() => {
  // Fallback for environments where the module might not be available
  console.log('Share assets modal not available');
});

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

/**
 * Strips HTML tags and newlines from text
 * @param {string} text - The text to clean
 * @returns {string} Cleaned text without HTML tags or newlines
 */
export function stripHtmlAndNewlines(text) {
  if (!text) return text;

  // Create a temporary div to strip HTML tags
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = text;

  // Get text content and remove newlines
  return tempDiv.textContent.trim().replace(/\n/g, '');
}

/**
 * Converts HTML list elements to a nested array structure
 * @param {string} htmlString - HTML string containing ul or ol elements
 * @returns {Array} Array of list items with nested structure preserved
 */
export function convertHtmlListToArray(htmlString) {
  if (!htmlString?.trim()) return [];

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString.trim();

  function processListItems(listElement) {
    return Array.from(listElement.children, (li) => {
      if (li.tagName !== 'LI') return null;

      // Extract direct text content efficiently
      const textContent = Array.from(li.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE
          || (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'UL' && node.tagName !== 'OL'))
        .map((node) => node.textContent)
        .join('')
        .trim();

      // Get direct child lists only
      const nestedLists = Array.from(li.children).filter((child) => child.tagName === 'UL' || child.tagName === 'OL');

      if (nestedLists.length === 0) {
        return textContent || null;
      }

      return {
        text: textContent,
        items: nestedLists.flatMap(processListItems),
      };
    }).filter(Boolean);
  }

  return Array.from(tempDiv.querySelectorAll('ul, ol'))
    .flatMap(processListItems);
}

/**
 * Extracts all key-value pairs from a block.
 * If the first line of a value contains "{{html}}",
 * it returns the HTML content with the marker removed.
 * Otherwise, it returns plain text content (no HTML tags, no newlines).
 * @param {Element} block The block element containing rows
 * @returns {Object} An object containing all key-value pairs from the block
 */
export function getBlockKeyValues(block) {
  const result = {};

  [...block.children].forEach((row) => {
    const divs = row.children;
    if (divs.length >= 2) {
      const keyDiv = divs[0];
      const valueDiv = divs[1];

      const keyP = keyDiv.querySelector('p');

      if (keyP) {
        const rowKey = keyP.textContent.trim();
        result[rowKey] = valueDiv.innerHTML.trim();
      }
    }
  });

  return result;
}

/**
 * Escapes a CSV field value by wrapping in quotes if needed and escaping internal quotes
 * @param {string} value - The value to escape
 * @returns {string} The escaped CSV field
 */
function escapeCsvField(value) {
  if (value == null || value === '') return '';

  const stringValue = String(value);

  // Check if field needs quoting (contains comma, newline, or quote)
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    // Escape double quotes by doubling them
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

/**
 * Converts an array of data objects into CSV-like text
 * @param {Array} dataArray - Array of objects with consistent keys
 * @param {Array<string>} headers - Array of header names (column order)
 * @returns {string} CSV-formatted text with headers and data rows
 */
export function convertDataArrayToCsv(dataArray, headers = null) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    if (headers && Array.isArray(headers)) {
      return headers.join(',');
    }
    return '';
  }

  // If no headers provided, extract from first object
  const csvHeaders = headers || Object.keys(dataArray[0]);
  const csvLines = [csvHeaders.join(',')];

  dataArray.forEach((row) => {
    const fields = csvHeaders.map((header) => {
      const value = row[header];
      return escapeCsvField(value);
    });
    csvLines.push(fields.join(','));
  });

  return csvLines.join('\n');
}

/**
* Fetches spreadsheet data from EDS with automatic pagination.
* Automatically fetches all pages if response.total > response.limit.
* @param {string} sheetPath Path to the spreadsheet JSON endpoint
                            (e.g., 'data/products', 'content/pricing')
* @param {string} sheetName Optional sheet name filter
* @returns {Promise<Object>} Object representing spreadsheet data with all pages merged
*/
export async function fetchSpreadsheetData(sheetPath, sheetName = '') {
  try {
    let offset = 0;
    let result = null;
    let hasMoreData = true;

    // Keep fetching until we have all data
    // eslint-disable-next-line no-await-in-loop
    while (hasMoreData) {
      const url = `${window.location.origin}/${sheetPath}.json?offset=${offset}${sheetName ? `&sheet=${sheetName}` : ''}`;
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(url);

      if (!resp.ok) {
        throw new Error(`Failed to fetch spreadsheet: ${resp.status} ${resp.statusText}`);
      }

      // eslint-disable-next-line no-await-in-loop
      const json = await resp.json();

      if (offset === 0) {
        // First page: store as result
        result = json;
      } else if (json.data && Array.isArray(json.data)) {
        // Subsequent pages: merge data
        result.data = result.data.concat(json.data);
      }

      // Check if we need to fetch more
      if (json.total && json.total > result.data.length) {
        offset += json.data.length;
      } else {
        hasMoreData = false;
      }
    }

    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to load spreadsheet from ${sheetPath}:`, error);
    return { data: [] };
  }
}

/**
 * Fetches spreadsheet data and converts it to CSV format
 * @param {string} sheetPath Path to the spreadsheet JSON endpoint
 * @param {string} sheetName Optional sheet name filter
 * @param {Array<string>} headers Optional array of header names for column order
 * @returns {Promise<string>} CSV-formatted text
 */
export async function fetchSpreadsheetDataAsCsv(sheetPath, sheetName = '', headers = null) {
  const data = await fetchSpreadsheetData(sheetPath, sheetName);
  return convertDataArrayToCsv(data.data || [], headers);
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    const resp = await fetch(`${path}.plain.html`);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // reset base path for media to fragment base
      const resetAttributeBase = (tag, attr) => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

loadPage();

// enable live preview in da.live
(async function loadDa() {
  if (!new URL(window.location.href).searchParams.get('dapreview')) return;
  // eslint-disable-next-line import/no-unresolved
  import('https://da.live/scripts/dapreview.js').then(({ default: daPreview }) => daPreview(loadPage));
}());
