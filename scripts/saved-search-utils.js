/**
 * Shared utility functions for saved search URL generation
 * Used by both React components and plain JavaScript blocks
 */

/**
 * Builds a shareable URL for a saved search that matches the format
 * expected by the search application
 * @param {Object} search - The saved search object
 * @param {string} search.searchTerm - The search term
 * @param {Array<Array<string>>} search.facetFilters - Array of facet filter groups
 * @param {Array<string>} search.numericFilters - Array of numeric filters
 * @returns {string} The complete shareable URL
 */
export default function buildSavedSearchUrl(search) {
  const params = new URLSearchParams();

  if (search.searchTerm) {
    params.set('fulltext', search.searchTerm);
  }

  if (search.facetFilters && search.facetFilters.length > 0) {
    params.set('facetFilters', encodeURIComponent(JSON.stringify(search.facetFilters)));
  }

  if (search.numericFilters && search.numericFilters.length > 0) {
    params.set('numericFilters', encodeURIComponent(JSON.stringify(search.numericFilters)));
  }

  // Build complete URL with current host and search/all path
  const currentUrl = new URL(window.location.href);
  const baseUrl = `${currentUrl.protocol}//${currentUrl.host}/search/all`;
  return `${baseUrl}?${params.toString()}`;
}
