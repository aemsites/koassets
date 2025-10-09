/**
 * Builds a shareable URL for a saved search that matches the format
 * expected by the search application
 */
declare function buildSavedSearchUrl(search: {
    searchTerm: string;
    facetFilters: FacetCheckedState;
    numericFilters: string[];
    searchType?: string; // Optional
}): string;

export default buildSavedSearchUrl;
