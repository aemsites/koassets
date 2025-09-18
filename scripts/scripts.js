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
    const user = await fetch(`${window.location.origin}/auth/user`);
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
  await loadUser();

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadCSS(`${window.hlx.codeBasePath}/styles/add-to-collection-modal.css`);
  loadFonts();

  // Initialize add to collection modal functionality
  import('./add-to-collection-modal.js').then(({ initAddToCollectionModal }) => {
    initAddToCollectionModal();
  }).catch(() => {
    // Fallback for environments where the module might not be available
    console.log('Add to collection modal not available');
  });
}

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
* Fetches spreadsheet data from EDS.
* @param {string} sheetPath Path to the spreadsheet JSON endpoint
                            (e.g., 'data/products', 'content/pricing')
* @returns {Promise<Object>} Object representing spreadsheet data
*/
export async function fetchSpreadsheetData(sheetPath, sheetName = '') {
  return fetch(`${window.location.origin}/${sheetPath}.json${sheetName ? `?sheet=${sheetName}` : ''}`)
    .then((resp) => {
      if (resp.ok) {
        return resp.json();
      }
      throw new Error(`Failed to fetch spreadsheet: ${resp.status} ${resp.statusText}`);
    })
    .then((json) => json)
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn(`Failed to load spreadsheet from ${sheetPath}:`, error);
      return [];
    });
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
