/**
 * Shared utility functions for saved search URL generation
 * Used by both React components and plain JavaScript blocks
 */

/**
 * Builds a shareable URL for a saved search that matches the format
 * expected by the search application
 * @param {Object} search - The saved search object
 * @param {string} search.searchTerm - The search term
 * @param {Object} search.facetFilters - Object with facet selections
 *   (facetTechId -> facetName -> boolean)
 * @param {Object} search.rightsFilters - Rights filter settings
 *   (dates, markets, media channels)
 * @param {Array<string>} search.numericFilters - Array of numeric filters
 * @param {string} [search.searchType] - The search type path (optional)
 * @returns {string} The complete shareable URL
 */
export default function buildSavedSearchUrl(search) {
  const params = new URLSearchParams();

  if (search.searchTerm) {
    params.set('fulltext', search.searchTerm);
  }

  if (search.facetFilters && Object.keys(search.facetFilters).length > 0) {
    params.set('facetFilters', encodeURIComponent(JSON.stringify(search.facetFilters)));
  }

  if (search.rightsFilters && Object.keys(search.rightsFilters).length > 0) {
    params.set('rightsFilters', encodeURIComponent(JSON.stringify(search.rightsFilters)));
  }

  if (search.numericFilters && search.numericFilters.length > 0) {
    params.set('numericFilters', encodeURIComponent(JSON.stringify(search.numericFilters)));
  }

  // Use the stored search type or default to /search/all
  const searchPath = search.searchType || '/search/all';

  // Build complete URL with current host and search type path
  const currentUrl = new URL(window.location.href);
  const baseUrl = `${currentUrl.protocol}//${currentUrl.host}${searchPath}`;
  return `${baseUrl}?${params.toString()}`;
}
