#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-syntax, max-len, import/no-extraneous-dependencies */
/**
 * Generate spreadsheet from hierarchy-structure.merged.json
 * Traverses the JSON from bottom up and creates a CSV with:
 * - path (replace '>' with '/', trim spaces)
 * - title
 * - type
 * - imageUrl (filename only, prepended with DA destination path from da-admin-client)
 * - linkURL
 * - text
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const { PATH_SEPARATOR, DATA_DIR } = require('./constants.js');
const { sanitizeFileName } = require('./sanitize-utils.js');
const {
  DA_ORG, DA_REPO, DA_DEST, IMAGES_BASE,
} = require('./da-admin-client.js');

/**
 * Displays help information
 */
function showHelp() {
  console.log(`
Generate CSV from hierarchy-structure.json files

USAGE:
  node generate-csv-from-hierarchy-json.js [options] [input-file] [output-file]

OPTIONS:
  -h, --help              Show this help message and exit

ARGUMENTS:
  input-file              Path to hierarchy-structure.json file (optional)
  output-file             Path to output CSV file (optional, only used with input-file)

BEHAVIOR:
  • With no arguments:
    Automatically finds and processes all matching files:
    - *-content-stores*/extracted-results/hierarchy-structure.json
    
    Outputs CSV files to: <store-name>/derived-results/hierarchy-structure.csv

  • With input-file only:
    Processes the specified input file.
    Outputs to: <store-name>/derived-results/hierarchy-structure.csv

  • With input-file and output-file:
    Processes the specified input file.
    Outputs to the specified output file path.

EXAMPLES:
  # Process all matching files automatically
  node generate-csv-from-hierarchy-json.js

  # Process a specific file (outputs to its derived-results directory)
  node generate-csv-from-hierarchy-json.js ./all-content-stores/extracted-results/hierarchy-structure.json

  # Process a specific file with custom output location
  node generate-csv-from-hierarchy-json.js input.json output.csv

OUTPUT:
  CSV file with columns:
  - type: Item/Link type ('accordion', 'button', 'link', 'section-title', or '' for legacy)
  - path: Navigation path (using '>>>' separator)
  - title: Item title
  - imageUrl: DA Live URL for the image
  - linkURL: Link URL if present
  - text: Plain text content (HTML stripped)
  - synonym: Alternative search terms

URL TRANSFORMATIONS:
  This script automatically transforms old AEM URLs to new formats:

  1. SEARCH ASSET URLs:
     /content/share/us/en/search-assets.html?fulltext=...&filters...
       → /search/all?fulltext=...&facetFilters={...}
     
     /content/share/us/en/search-assets/details/.../file.pdf
       → /search/all?fulltext=file.pdf

  2. TEMPLATE SEARCH URLs:
     /content/share/us/en/template-search.html?fulltext=...&filters...
       → /search/templates?fulltext=...&facetFilters={...}

  3. CONTENT STORE URLs:
     /content/share/us/en/all-content-stores/fanta-colorful.html
       → /content-stores/all-content-stores-fanta-colorful
     
     /content/share/language-masters/en/bottler-content-stores/test.html
       → /content-stores/bottler-content-stores-test

  4. GENERAL PAGE URLs:
     /content/share/us/en/help/training-bottlers.html
       → /help/training-bottlers
     
     /content/share/language-masters/en/about.html
       → /about

  FACET FILTER TRANSFORMATIONS:
  • Extracts active filters from URL parameters (*_values) - ALL facet types
  • Transforms to hierarchical JSON structure based on facet type:
    - Tags facets: "facetKey.TCCC.#hierarchy.lvl{N}": {"Label / Value": true}
    - String facets: "facetKey": {"value": true}
  • Applies text transformations to value labels - TAGS FACETS ONLY:
    - Replaces hyphens with spaces
    - Replaces "and" with "&"
    - Capitalizes 2-letter words (ALL CAPS)
    - Capitalizes first letter of 3+ letter words
  • URL-encodes the JSON and appends as facetFilters parameter - ALL facet types

  HTML ENTITY HANDLING:
  • Automatically decodes HTML entities (&amp;, &#61;, etc.) before processing
  • Ensures proper URL parsing and transformation

  CHUNKED PROCESSING:
  • For large text fields (>100KB), processes in 50KB chunks
  • Intelligently adjusts chunk boundaries to avoid splitting HTML tags
  • Prevents splitting href attributes across chunks

CONFIGURATION:
  Imports configuration from: ./da-admin-client.js
  - DA_ORG: DA organization
  - DA_REPO: DA repository
  - DA_DEST: DA destination path prefix
`);
}

// ==============================================================================
// FACETS CONFIGURATION
// ==============================================================================

/**
 * Loads and parses the facets configuration from facets.ts
 * @returns {Object} - Facets configuration object
 */
function loadFacetsConfig() {
  try {
    const facetsPath = path.join(__dirname, '../../koassets-react/src/constants/facets.ts');
    const facetsContent = fs.readFileSync(facetsPath, 'utf-8');

    // Extract the DEFAULT_FACETS object using regex
    const match = facetsContent.match(/export const DEFAULT_FACETS: ExcFacets = ({[\s\S]+?});/);

    if (!match) {
      console.warn('⚠️  Could not parse facets.ts, using fallback configuration');
      return {};
    }

    // Convert TypeScript object to JSON-parseable format
    // This is a simple approach - replace single quotes with double quotes
    // and handle the structure
    const jsonStr = match[1]
      .replace(/(\w+):/g, '"$1":') // Add quotes around keys
      .replace(/'/g, '"') // Replace single quotes with double quotes
      .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas

    const facets = JSON.parse(jsonStr);
    return facets;
  } catch (error) {
    console.warn(`⚠️  Error loading facets config: ${error.message}`);
    return {};
  }
}

// Cache the facets configuration
let facetsConfigCache = null;

/**
 * Gets the facets configuration (loads once and caches)
 * @returns {Object} - Facets configuration
 */
function getFacetsConfig() {
  if (!facetsConfigCache) {
    facetsConfigCache = loadFacetsConfig();
  }
  return facetsConfigCache;
}

/**
 * Loads sample facet values from sample_facets.json
 * This file contains the actual facet values with correct casing
 * @returns {Object} - Sample facets object mapping tag paths to display values
 */
function loadSampleFacets() {
  try {
    const sampleFacetsPath = path.join(__dirname, 'sample_facets.json');
    if (!fs.existsSync(sampleFacetsPath)) {
      return {};
    }
    const content = fs.readFileSync(sampleFacetsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Error loading sample_facets.json: ${error.message}`);
    return {};
  }
}

// Cache the sample facets
let sampleFacetsCache = null;

/**
 * Gets the sample facets (loads once and caches)
 * @returns {Object} - Sample facets object
 */
function getSampleFacets() {
  if (!sampleFacetsCache) {
    sampleFacetsCache = loadSampleFacets();
  }
  return sampleFacetsCache;
}

// ==============================================================================
// TRANSFORMATION FUNCTIONS
// ==============================================================================

/**
 * Extracts the facet name from a metadata property path
 * Example: ./jcr:content/metadata/tccc:brand → tccc-brand
 * @param {string} property - The property path
 * @returns {string} - The facet name or empty string
 */
function extractFacetName(property) {
  if (!property) return '';

  // Extract the last part after metadata/
  const match = property.match(/metadata\/([^/]+)$/);
  if (match) {
    // Replace : with - to match facet naming convention
    return match[1].replace(/:/g, '-');
  }

  return '';
}

/**
 * Extracts the tag value path from a full tag value
 * Removes the prefix (e.g., "tccc:brand/") and keeps the rest
 * Example: tccc:brand/gold-peak → gold-peak
 * Example: tccc:intended-channel/packaging/abc → packaging/abc
 * @param {string} tagValue - The full tag value
 * @returns {string} - The extracted value path
 */
function extractTagValuePath(tagValue) {
  if (!tagValue) return '';

  // Find the first / and take everything after it
  const firstSlash = tagValue.indexOf('/');
  if (firstSlash === -1) {
    return tagValue;
  }

  return tagValue.substring(firstSlash + 1);
}

/**
 * Normalizes a facet value for flexible matching
 * - Converts to lowercase
 * - Trims whitespace
 * - Normalizes multiple spaces to single space
 * - Normalizes slashes (removes spaces around /)
 * @param {string} value - The value to normalize
 * @returns {string} - Normalized value
 */
function normalizeFacetValue(value) {
  if (!value) return '';

  return value
    .toLowerCase()
    .trim()
    // Normalize spaces around slashes: " / " -> "/"
    .replace(/\s*\/\s*/g, '/')
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Looks up the exact display value from sample_facets.json by doing a flexible match
 * The keys in sample_facets.json are the display values with correct casing
 * @param {string} filterKey - The full filter key (e.g., 'tccc-brand.TCCC.#hierarchy.lvl1')
 * @param {string} transformedValue - The transformed value to match (e.g., 'Brand / Fanta Zero Diet Light')
 * @returns {string|null} - The exact display value from sample_facets.json if found, null otherwise
 */
function lookupSampleFacetValue(filterKey, transformedValue) {
  const sampleFacets = getSampleFacets();
  if (!sampleFacets || !sampleFacets[filterKey]) {
    return null;
  }

  // Get all keys from the sample facets for this filter key
  const sampleKeys = Object.keys(sampleFacets[filterKey]);

  // Normalize the transformed value for comparison
  const normalizedTransformed = normalizeFacetValue(transformedValue);

  // Find a matching key by comparing normalized versions
  const matchingKey = sampleKeys.find((key) => normalizeFacetValue(key) === normalizedTransformed);

  return matchingKey || null;
}

/**
 * Transforms a facet key segment, only used for facet of type 'tags'
 * Applies transformation rules:
 * - Replaces '-' with ' '
 * - Replaces 'and' with '&'
 * - Words of 2 letters or less => ALL CAPS
 * - Words of 3+ letters => Capitalize first letter
 * @param {string} str - The string to transform
 * @returns {string} - Transformed string
 */
function transformFacetKey(str) {
  if (!str) return '';

  // Replace hyphens with spaces
  const transformed = str.replace(/-/g, ' ');

  // Split into words
  const words = transformed.split(' ');

  // Transform each word
  const transformedWords = words.map((word) => {
    const lowerWord = word.toLowerCase();

    // Replace 'and' with '&'
    if (lowerWord === 'and') {
      return '&';
    }

    // Words of 2 letters or less: ALL CAPS
    if (word.length <= 2) {
      return word.toUpperCase();
    }

    // Words of 3+ letters: Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return transformedWords.join(' ');
}

/**
 * Extracts active filters from URL search parameters
 * Returns an object mapping facet names to their values
 * @param {URLSearchParams} searchParams - The URL search parameters
 * @returns {Object} - Object with facet names as keys and values as arrays
 */
function extractActiveFilters(searchParams) {
  const filters = {};
  const groups = {};

  // First pass: organize parameters by group number
  for (const [key, value] of searchParams.entries()) {
    const groupMatch = key.match(/^(\d+)_group\.propertyvalues\.(.+)$/);
    if (groupMatch) {
      const groupNum = groupMatch[1];
      const paramName = groupMatch[2];

      if (!groups[groupNum]) {
        groups[groupNum] = {};
      }

      groups[groupNum][paramName] = value;
    }
  }

  // Second pass: extract filters from groups that have _values
  for (const groupParams of Object.values(groups)) {
    // Find all _values parameters in this group
    const valueKeys = Object.keys(groupParams).filter((k) => k.includes('_values'));

    if (valueKeys.length > 0 && groupParams.property) {
      const facetName = extractFacetName(groupParams.property);

      if (facetName) {
        // Collect all values for this facet (keep full path, not just last segment)
        const values = valueKeys.map((vk) => extractTagValuePath(groupParams[vk])).filter((v) => v);

        if (values.length > 0) {
          if (!filters[facetName]) {
            filters[facetName] = [];
          }
          filters[facetName].push(...values);
        }
      }
    }
  }

  return filters;
}

/**
 * Builds facet filters object based on facet type
 * @param {Object} filters - Object with facet names as keys and value paths as arrays
 * @returns {Object} - Facet filters object in the format for the new search API
 */
function buildFacetFiltersObject(filters) {
  const facetFilters = {};
  const facetsConfig = getFacetsConfig();

  for (const [facetKey, valuePaths] of Object.entries(filters)) {
    const facetConfig = facetsConfig[facetKey];

    if (facetConfig && facetConfig.type === 'tags') {
      // For tags type, use hierarchical key format
      const facetLabel = facetConfig.label;

      for (const valuePath of valuePaths) {
        // Split the value path into segments
        const segments = valuePath.split('/');
        const level = segments.length;

        // First, transform each segment using the transformation rules
        const transformedSegments = segments.map((seg) => transformFacetKey(seg));

        // Build the value part: "Label / Value1 / Value2"
        const transformedValuePart = [facetLabel, ...transformedSegments].join(' / ');

        // Build the full filter key with hierarchy level
        const filterKey = `${facetKey}.TCCC.#hierarchy.lvl${level}`;

        // Try to look up the exact value from sample facets (case-insensitive match)
        const exactValue = lookupSampleFacetValue(filterKey, transformedValuePart);
        const finalValue = exactValue || transformedValuePart;

        // Create nested structure
        if (!facetFilters[filterKey]) {
          facetFilters[filterKey] = {};
        }
        facetFilters[filterKey][finalValue] = true;
      }
    } else {
      // For string type and other types, use simple facet key
      if (!facetFilters[facetKey]) {
        facetFilters[facetKey] = {};
      }
      for (const valuePath of valuePaths) {
        facetFilters[facetKey][valuePath] = true;
      }
    }
  }

  return facetFilters;
}

/**
 * Converts filter object to URL query parameters using facetFilters JSON format
 * @param {Object} filters - Object with facet names as keys and value paths as arrays
 * @returns {string} - URL query string (without leading &)
 */
function filtersToQueryString(filters) {
  if (Object.keys(filters).length === 0) {
    return '';
  }

  const facetFiltersObj = buildFacetFiltersObject(filters);

  // Convert to JSON string and encode
  const jsonString = JSON.stringify(facetFiltersObj);
  return `facetFilters=${encodeURIComponent(jsonString)}`;
}

/**
 * Decodes HTML entities in a string
 * Handles both named entities (&amp;) and numeric entities (&#61;, &#x3D;)
 * @param {string} str - The string with HTML entities
 * @returns {string} - Decoded string
 */
function decodeHtmlEntities(str) {
  if (!str) return '';

  let decoded = str;

  // Decode common HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  Object.entries(entities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  });

  // Decode numeric entities (decimal)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

  // Decode numeric entities (hexadecimal)
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

/**
 * Transforms search URLs to new search format
 * - search-assets.html → /search/all?fulltext=...
 * - template-search.html → /search/template?fulltext=...
 * Extracts 'fulltext' parameter, decodes it, and creates new URL
 * Also handles /content/share/us/en/search-assets/details URLs
 * For URLs with active filters (detected by _values parameters),
 * extracts and appends the filter parameters (e.g., &tccc-brand=gold-peak)
 * @param {string} url - The original URL
 * @returns {string} - Transformed URL or original if not a search URL
 */
function transformSearchUrl(url) {
  if (!url) return url;

  // Handle /content/share/us/en/search-assets/details URLs
  // Example: /content/share/us/en/search-assets/details/document.html/view/marketing/mixed-brand/none/none/ICPG_Section_D_2025.pdf
  if (url.startsWith('/content/share/us/en/search-assets/details')) {
    // Extract the last segment (filename) from the path
    const pathParts = url.split('/');
    const filename = pathParts[pathParts.length - 1];

    if (filename) {
      return `/search/all?fulltext=${encodeURIComponent(decodeURIComponent(filename))}`;
    }
  }

  // Handle template-search.html URLs with fulltext parameter
  if (url.includes('template-search.html')) {
    try {
      // Decode all HTML entities in URL before parsing
      const decodedUrl = decodeHtmlEntities(url);
      // Parse the URL to extract query parameters
      const urlObj = new URL(decodedUrl, 'https://dummy.com'); // Need base URL for relative URLs
      const fulltext = urlObj.searchParams.get('fulltext');
      const filters = extractActiveFilters(urlObj.searchParams);
      const filterQueryString = filtersToQueryString(filters);

      if (fulltext) {
        // URL decode the fulltext parameter
        const decodedFullText = decodeURIComponent(fulltext);
        const filterSuffix = filterQueryString ? `&${filterQueryString}` : '';
        return `/search/templates?fulltext=${encodeURIComponent(decodedFullText)}${filterSuffix}`;
      }
      if (filterQueryString) {
        // No fulltext but has filters - create URL with empty query
        return `/search/templates?fulltext=&${filterQueryString}`;
      }
    } catch (error) {
      // If URL parsing fails, return original URL
      console.warn(`Failed to parse URL: ${url}`);
    }
  }

  // Handle search-assets.html URLs with fulltext parameter
  if (url.includes('search-assets.html')) {
    try {
      // Decode all HTML entities in URL before parsing
      const decodedUrl = decodeHtmlEntities(url);
      // Parse the URL to extract query parameters
      const urlObj = new URL(decodedUrl, 'https://dummy.com'); // Need base URL for relative URLs
      const fulltext = urlObj.searchParams.get('fulltext');
      const filters = extractActiveFilters(urlObj.searchParams);
      const filterQueryString = filtersToQueryString(filters);

      if (fulltext) {
        // URL decode the fulltext parameter
        const decodedFullText = decodeURIComponent(fulltext);
        const filterSuffix = filterQueryString ? `&${filterQueryString}` : '';
        return `/search/all?fulltext=${encodeURIComponent(decodedFullText)}${filterSuffix}`;
      }
      if (filterQueryString) {
        // No fulltext but has filters - create URL with empty query
        return `/search/all?fulltext=&${filterQueryString}`;
      }
    } catch (error) {
      // If URL parsing fails, return original URL
      console.warn(`Failed to parse URL: ${url}`);
    }
  }

  return url;
}

/**
 * Transforms content store URLs from old format to new format
 * /content/share/us/en/bottler-content-stores/coke-holiday-2025.html → ${DA_DEST}/content-stores/bottler-content-stores-coke-holiday-2025
 * /content/share/language-masters/en/all-content-stores/fanta-colorful.html → ${DA_DEST}/content-stores/all-content-stores-fanta-colorful
 * @param {string} url - The original URL
 * @returns {string} - Transformed URL or original if not a content store URL
 */
function transformContentStoreUrl(url) {
  if (!url) return url;

  // Match /content/share/{us|language-masters}/en/*-content-stores/* (with or without .html)
  const contentStorePattern = /^\/content\/share\/(?:us|language-masters)\/en\/((?:all|bottler)-content-stores\/[^.?#]+)(?:\.html)?$/;
  const match = url.match(contentStorePattern);

  if (match) {
    // Replace slashes with hyphens in the store path
    const storePath = match[1].replace(/\//g, '-');

    // Add DA_DEST prefix with leading slash if it exists
    const prefix = DA_DEST && DA_DEST.trim() ? `/${DA_DEST}` : '';
    return `${prefix}/content-stores/${storePath}`;
  }

  return url;
}

/**
 * Transforms general page URLs from old format to new format
 * /content/share/us/en/help/training-bottlers.html → /help/training-bottlers
 * /content/share/language-masters/en/about.html → /about
 * @param {string} url - The original URL
 * @returns {string} - Transformed URL or original if not a general page URL
 */
function transformGeneralPageUrl(url) {
  if (!url) return url;

  // Match /content/share/{us|language-masters}/en/{path} (with or without .html)
  // But exclude content-stores URLs (they're handled separately)
  const generalPagePattern = /^\/content\/share\/(?:us|language-masters)\/en\/([^?#]+?)(?:\.html)?$/;
  const match = url.match(generalPagePattern);

  if (match) {
    const pagePath = match[1];
    // Skip if this is a content-stores URL (handled by transformContentStoreUrl)
    if (pagePath.includes('-content-stores/')) {
      return url;
    }
    return `/${pagePath}`;
  }

  return url;
}

/**
 * Transforms all search URLs within text/HTML content
 * Handles search-assets.html, search-assets/details, and template-search.html URLs
 * @param {string} text - The text or HTML content
 * @returns {string} - Text with transformed URLs
 */
function transformSearchUrlsInText(text) {
  if (!text || (!text.includes('search-assets.html')
      && !text.includes('search-assets/details')
      && !text.includes('template-search.html'))) {
    return text;
  }

  // For very large text fields, use a more efficient approach to avoid regex catastrophic backtracking
  if (text.length > 100000) {
    console.log(`   ⚠️  Processing large text field (${text.length} chars) with optimized approach...`);

    // Process text in chunks to avoid regex performance issues
    const chunkSize = 50000; // Process 50KB at a time
    let result = '';

    let i = 0;
    while (i < text.length) {
      let endPos = Math.min(i + chunkSize, text.length);

      // If not at the end, adjust chunk boundary to avoid splitting an href
      // Look back up to 2000 chars for a safe split point (end of tag)
      if (endPos < text.length) {
        const searchStart = Math.max(endPos - 2000, i);
        const lastTagEnd = text.lastIndexOf('>', endPos);
        if (lastTagEnd > searchStart) {
          endPos = lastTagEnd + 1; // Include the '>'
        }
      }

      const chunk = text.substring(i, endPos);

      // Match search-assets, template-search URLs
      // After JSON parsing, escaped quotes become regular quotes
      const urlPattern = /href="([^"]*(?:search-assets|template-search)[^"]*)"/gi;

      const transformedChunk = chunk.replace(urlPattern, (match, url) => {
        // Decode all HTML entities in URL
        const decodedUrl = decodeHtmlEntities(url);
        const transformedUrl = transformSearchUrl(decodedUrl);
        return `href="${transformedUrl}"`;
      });

      result += transformedChunk;
      i = endPos; // Move to the adjusted end position
    }

    return result;
  }

  // For normal-sized text, use the original pattern
  // Match URLs in href attributes
  // Pattern matches search-assets, template-search URLs
  // After JSON parsing, escaped quotes become regular quotes
  const urlPattern = /href="([^"]*(?:search-assets|template-search)[^"]*)"/gi;

  return text.replace(urlPattern, (match, url) => {
    // Decode all HTML entities in URL
    const decodedUrl = decodeHtmlEntities(url);
    const transformedUrl = transformSearchUrl(decodedUrl);
    return `href="${transformedUrl}"`;
  });
}

/**
 * Transforms all content store URLs within text/HTML content
 * @param {string} text - The text or HTML content
 * @returns {string} - Text with transformed URLs
 */
function transformContentStoreUrlsInText(text) {
  if (!text || (!text.includes('/content/share/us/en/') && !text.includes('/content/share/language-masters/en/'))) {
    return text;
  }

  // Pattern matches: href="URL" - After JSON parsing, escaped quotes become regular quotes
  // Looking for /content/share/{us|language-masters}/en/*-content-stores/* URLs
  const urlPattern = /href="([^"]*\/content\/share\/(?:us|language-masters)\/en\/[^"]*-content-stores[^"]*)"/gi;

  return text.replace(urlPattern, (match, url) => {
    // Decode all HTML entities in URL
    const decodedUrl = decodeHtmlEntities(url);
    const transformedUrl = transformContentStoreUrl(decodedUrl);
    return `href="${transformedUrl}"`;
  });
}

/**
 * Transforms all general page URLs within text/HTML content
 * @param {string} text - The text or HTML content
 * @returns {string} - Text with transformed URLs
 */
function transformGeneralPageUrlsInText(text) {
  if (!text || (!text.includes('/content/share/us/en/') && !text.includes('/content/share/language-masters/en/'))) {
    return text;
  }

  // Pattern matches: href="URL" - After JSON parsing, escaped quotes become regular quotes
  // Looking for /content/share/{us|language-masters}/en/{path} URLs (but not content-stores)
  const urlPattern = /href="(\/content\/share\/(?:us|language-masters)\/en\/[^"]+)"/gi;

  return text.replace(urlPattern, (match, url) => {
    // Decode all HTML entities in URL
    const decodedUrl = decodeHtmlEntities(url);
    const transformedUrl = transformGeneralPageUrl(decodedUrl);
    return `href="${transformedUrl}"`;
  });
}

/**
 * Transforms all URLs within text/HTML content (search, content store, and general page URLs)
 * @param {string} text - The text or HTML content
 * @returns {string} - Text with transformed URLs
 */
function transformUrlsInText(text) {
  if (!text) return text;

  // Apply search URL transformations first
  let transformedText = transformSearchUrlsInText(text);

  // Then apply content store URL transformations
  transformedText = transformContentStoreUrlsInText(transformedText);

  // Finally apply general page URL transformations
  transformedText = transformGeneralPageUrlsInText(transformedText);

  return transformedText;
}

/**
 * Rewrites the hierarchy-structure.json with transformations:
 * 1. Renames type "title" to "section-title"
 * 2. Unwraps "Other Content" containers (promotes children to parent level)
 *
 * @param {string} jsonFilePath - Path to the hierarchy-structure.json file
 * @returns {object} The transformed hierarchy data
 */
function rewriteHierarchyStructure(jsonFilePath) {
  try {
    console.log(`📖 Reading hierarchy from: ${jsonFilePath}`);
    const hierarchyData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));

    let titleCount = 0;
    let otherContentUnwrapped = 0;

    // Recursive function to transform items
    // eslint-disable-next-line no-inner-declarations
    function transformItems(items) {
      if (!items || !Array.isArray(items)) return items;

      const transformed = items.map((item) => {
        const transformedItem = { ...item };

        // Transform type "title" to "section-title"
        if (transformedItem.type === 'title') {
          transformedItem.type = 'section-title';
          titleCount += 1;
        }

        // Recursively transform nested items
        if (transformedItem.items && Array.isArray(transformedItem.items)) {
          transformedItem.items = transformItems(transformedItem.items);
        }

        return transformedItem;
      });

      // Unwrap "Other Content" containers - replace container with its children
      const unwrapped = [];
      for (const item of transformed) {
        if (item.type === 'container' && item.title === 'Other Content') {
          // Skip the container itself, but add all its children
          if (item.items && Array.isArray(item.items) && item.items.length > 0) {
            // Fix paths: remove "Other Content >>> " from the beginning of paths
            const promotedChildren = item.items.map((child) => {
              const updatedChild = { ...child };
              if (updatedChild.path && updatedChild.path.startsWith('Other Content >>> ')) {
                updatedChild.path = updatedChild.path.replace('Other Content >>> ', '');
              }
              return updatedChild;
            });
            unwrapped.push(...promotedChildren);
            otherContentUnwrapped += 1;
            console.log(`  🔄 Unwrapping "Other Content" container (promoting ${item.items.length} child(ren))`);
          }
        } else {
          unwrapped.push(item);
        }
      }

      return unwrapped;
    }

    // Transform all items in the hierarchy
    if (hierarchyData.items) {
      hierarchyData.items = transformItems(hierarchyData.items);
    }

    console.log(`  ✅ Renamed ${titleCount} "title" type(s) to "section-title"`);
    if (otherContentUnwrapped > 0) {
      console.log(`  ✅ Unwrapped ${otherContentUnwrapped} "Other Content" container(s)`);
    }

    // Return the transformed data instead of writing to file
    return hierarchyData;
  } catch (error) {
    console.error(`❌ Error rewriting hierarchy structure: ${error.message}`);
    throw error;
  }
}

/**
 * Removes section-title paths from their children's paths
 * When a section-title is encountered, all subsequent items (until the next section-title)
 * have the section-title's path prefix removed from their paths
 * Also adds 2 empty rows before each section-title (starting from the 2nd one)
 */
function removeParentSectionTitleFromPaths(items) {
  const result = [];
  let currentSectionPath = null;
  let isFirstSectionTitle = true;

  for (const item of items) {
    const newItem = { ...item };

    if (item.type === 'section-title') {
      // Add 2 empty rows before section-title (except for the first one)
      if (!isFirstSectionTitle) {
        // Create empty row objects with all fields empty
        const emptyRow = {
          type: '',
          path: '',
          title: '',
          imageUrl: '',
          linkURL: '',
          text: '',
          synonym: '',
        };
        result.push({ ...emptyRow });
        result.push({ ...emptyRow });
      }
      isFirstSectionTitle = false;

      // This is a section title - update current section path for future children
      currentSectionPath = item.path;
      result.push(newItem);
    } else {
      // Check if this item is a child of the current section-title
      if (currentSectionPath && item.path && item.path.startsWith(currentSectionPath + PATH_SEPARATOR)) {
        // Remove the section path prefix
        newItem.path = item.path.substring(currentSectionPath.length + PATH_SEPARATOR.length);
      }
      result.push(newItem);
    }
  }

  return result;
}

// ==============================================================================
// UTILITY FUNCTIONS
// ==============================================================================

/**
 * Extracts link URL from item, supporting both old and new formats
 * @returns {string} The link URL
 */
function extractLinkUrl(item) {
  let url = '';

  // Check linkSources first (new format)
  if (item.linkSources && typeof item.linkSources === 'object') {
    if (item.linkSources.clickableUrl) {
      url = item.linkSources.clickableUrl;
    }
  }

  // Fallback to linkURL (old format)
  if (!url) {
    url = item.linkURL ?? '';
  }

  // Transform search-assets.html URLs to new format
  url = transformSearchUrl(url);

  // Transform content store URLs to new format
  url = transformContentStoreUrl(url);

  // Transform general page URLs to new format
  url = transformGeneralPageUrl(url);

  return url;
}

/**
 * Constructs the full destination path from DA config
 */
function getDestinationPath() {
  // Build base path: org/repo
  let destPath = `${DA_ORG}/${DA_REPO}`;

  // Append DA_DEST if it exists
  if (DA_DEST && DA_DEST.trim()) {
    const dest = DA_DEST.trim();
    // Ensure proper path separators
    destPath += dest.startsWith('/') ? dest : `/${dest}`;
  }

  return destPath;
}

/**
 * Converts HTML to plain text by:
 * 1. Removing HTML tags
 * 2. Decoding HTML entities
 * 3. Normalizing whitespace
 */
function htmlToPlainText(html) {
  if (!html) return '';

  let text = html;

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
  };

  Object.entries(entities).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'g'), char);
  });

  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Normalize whitespace
  text = text.replace(/\r\n/g, ' ');
  text = text.replace(/\n/g, ' ');
  text = text.replace(/\s+/g, ' ');
  text = text.trim();

  return text;
}

/**
 * Formats path by trimming spaces around '>' separators
 * Keep '>' as separator to avoid conflicts with '/' in titles
 */
function formatPath(pathStr) {
  if (!pathStr) return '';

  return pathStr
    .split('>')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(PATH_SEPARATOR);
}

/**
 * Extracts filename from a URL path
 */
function extractFilename(url) {
  if (!url) return '';

  // Extract the filename from the path
  const parts = url.split('/');
  const filename = parts[parts.length - 1];

  return filename;
}

/**
 * Formats imageUrl by extracting filename and prepending with full DA Live URL
 * Returns empty string if the sanitized file doesn't exist in extracted-results/images
 */
function formatImageUrl(imageUrl, destPath, storeName) {
  if (!imageUrl) return '';

  const filename = extractFilename(imageUrl);
  const sanitizedFilename = sanitizeFileName(filename);

  // Check if the sanitized file exists in the images directory
  const imagePath = path.join(__dirname, DATA_DIR, storeName, 'extracted-results', 'images', sanitizedFilename);
  if (!fs.existsSync(imagePath)) {
    return '';
  }

  return `https://content.da.live/${destPath}/${IMAGES_BASE}${storeName}/${sanitizedFilename}`;
}

/**
 * Escapes CSV field value
 */
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';

  const strValue = String(value);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

// ==============================================================================
// CSV PROCESSING FUNCTIONS
// ==============================================================================

/**
 * Converts an item to a CSV row
 */
function itemToRow(item, destPath, storeName) {
  const linkUrl = extractLinkUrl(item);
  // Transform all URLs in text content (search URLs and content store URLs)
  const transformedText = transformUrlsInText(item.text || '');
  return [
    escapeCsvField(item.type || ''),
    escapeCsvField(formatPath(item.path || '')),
    escapeCsvField(item.title || ''),
    escapeCsvField(formatImageUrl(item.imageUrl || '', destPath, storeName)),
    escapeCsvField(linkUrl),
    escapeCsvField(transformedText),
    escapeCsvField(item.synonym || ''),
  ].join(',');
}

/**
 * Traverses the hierarchy in the same order as JSON (parent first, then children)
 * and collects all items, including accordions and their children
 */
function traverseInOrder(items, result = []) {
  if (!items || !Array.isArray(items)) return result;

  for (const item of items) {
    // Add the current item first (including accordions)
    result.push(item);

    // Then process children (maintaining JSON order)
    if (item.items && Array.isArray(item.items)) {
      traverseInOrder(item.items, result);
    }
  }

  return result;
}

/**
 * Processes a single input file and generates CSV
 */
function processFile(inputFile, outputFile) {
  // Extract store name from inputFile (e.g., 'all-content-stores' from './all-content-stores/extracted-results/...')
  const storeName = path.basename(path.dirname(path.dirname(inputFile)));

  // Get DA destination path
  const destPath = getDestinationPath();

  console.log(`\n📄 Processing: ${inputFile}`);
  console.log(`   Store name: ${storeName}`);
  console.log(`   Destination path: ${destPath}`);

  // Apply transformations to the hierarchy structure
  console.log('\n🔄 Applying post-processing transformations...');
  const jsonData = rewriteHierarchyStructure(inputFile);
  console.log('✅ Post-processing complete!\n');

  console.log('   Traversing hierarchy in original order...');
  let items = traverseInOrder(jsonData.items || []);

  console.log(`   Found ${items.length} items`);

  // Remove section-title paths from their children
  console.log('   Removing section-title paths from children...');
  items = removeParentSectionTitleFromPaths(items);

  // Items are already in the order from the JSON hierarchy (top-down traversal)
  // No sorting needed - maintain the original order

  // Create CSV content
  const headers = ['type', 'path', 'title', 'imageUrl', 'linkURL', 'text', 'synonym'];
  const csvLines = [headers.join(',')];

  items.forEach((item) => {
    csvLines.push(itemToRow(item, destPath, storeName));
  });

  const csvContent = csvLines.join('\n');

  // Write to output file
  console.log(`   Writing to: ${outputFile}`);
  fs.writeFileSync(outputFile, csvContent, 'utf8');

  console.log('   ✅ Successfully generated spreadsheet!');
  console.log(`   Total rows: ${items.length}`);
}

/**
 * Finds all matching hierarchy-structure.json files
 */
function findInputFiles() {
  const pattern = `${DATA_DIR}/*-content-stores*/extracted-results/hierarchy-structure.json`;
  const matches = globSync(pattern, { cwd: __dirname });
  return matches.map((f) => path.join(__dirname, f));
}

// ==============================================================================
// MAIN EXECUTION
// ==============================================================================

/**
 * Main function
 */
function main() {
  try {
    // Check for command line arguments
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('-h') || args.includes('--help')) {
      showHelp();
      process.exit(0);
    }

    // Validate arguments - check for unknown flags
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (arg.startsWith('-')) {
        console.error(`❌ ERROR: Unknown flag: ${arg}`);
        console.error('');
        console.error('This script only accepts positional arguments (file paths).');
        console.error('Run with --help to see usage information');
        process.exit(1);
      }
    }

    if (args.length > 0) {
      // Process the file specified in command line
      const inputFile = path.resolve(args[0]);

      if (!fs.existsSync(inputFile)) {
        console.error(`❌ Error: Input file not found: ${inputFile}`);
        process.exit(1);
      }

      // Determine output file path
      const outputFile = args.length > 1
        ? path.resolve(args[1])
        : (() => {
          // Place in ../derived-results relative to the input file's directory
          const inputDir = path.dirname(inputFile);
          const storeDir = path.dirname(inputDir);
          const derivedDir = path.join(storeDir, 'derived-results');
          // Create derived-results directory if it doesn't exist
          if (!fs.existsSync(derivedDir)) {
            fs.mkdirSync(derivedDir, { recursive: true });
          }
          return path.join(derivedDir, 'hierarchy-structure.csv');
        })();

      processFile(inputFile, outputFile);
    } else {
      // No arguments provided - process all matching files
      console.log('No input file specified. Processing all matching files...');
      const inputFiles = findInputFiles();

      if (inputFiles.length === 0) {
        console.error('❌ No matching files found.');
        console.error('   Looking for:');
        console.error('   - *-content-stores*/extracted-results/hierarchy-structure.json');
        process.exit(1);
      }

      console.log(`Found ${inputFiles.length} file(s) to process.`);

      inputFiles.forEach((inputFile) => {
        // Place in ../derived-results relative to the input file's directory
        const inputDir = path.dirname(inputFile);
        const storeDir = path.dirname(inputDir);
        const derivedDir = path.join(storeDir, 'derived-results');

        // Create derived-results directory if it doesn't exist
        if (!fs.existsSync(derivedDir)) {
          fs.mkdirSync(derivedDir, { recursive: true });
        }

        const outputFile = path.join(derivedDir, 'hierarchy-structure.csv');

        try {
          processFile(inputFile, outputFile);
        } catch (error) {
          console.error(`❌ Error processing ${inputFile}:`, error.message);
        }
      });

      console.log('\n✅ All files processed!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getDestinationPath,
  htmlToPlainText,
  formatPath,
  formatImageUrl,
  traverseInOrder,
  removeParentSectionTitleFromPaths,
  processFile,
  findInputFiles,
  rewriteHierarchyStructure,
  loadFacetsConfig,
  getFacetsConfig,
  loadSampleFacets,
  getSampleFacets,
  normalizeFacetValue,
  lookupSampleFacetValue,
  extractFacetName,
  extractTagValuePath,
  transformFacetKey,
  extractActiveFilters,
  buildFacetFiltersObject,
  filtersToQueryString,
  decodeHtmlEntities,
  transformSearchUrl,
  transformContentStoreUrl,
  transformGeneralPageUrl,
  transformSearchUrlsInText,
  transformContentStoreUrlsInText,
  transformGeneralPageUrlsInText,
  transformUrlsInText,
};
