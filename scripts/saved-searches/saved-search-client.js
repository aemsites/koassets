/**
 * Shared client for saved search operations
 * Works in both vanilla JavaScript and React environments
 * Provides a single source of truth for saved search CRUD operations
 */

const STORAGE_KEY = 'koassets-saved-searches';

/**
 * Saved Search Client - Core operations
 */
export const savedSearchClient = {
  /**
   * Load all saved searches from localStorage
   * @returns {Array} Array of saved search objects
   */
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading saved searches:', error);
      return [];
    }
  },

  /**
   * Save searches to localStorage
   * @param {Array} searches - Array of search objects to save
   */
  save(searches) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error saving searches:', error);
    }
  },

  /**
   * Create a new saved search
   * @param {Object} searchData - Search data (name, searchTerm, filters, etc.)
   * @returns {Object} The created search object
   */
  create(searchData) {
    const searches = this.load();
    const now = Date.now();
    const newSearch = {
      id: now.toString(),
      dateCreated: now,
      dateLastModified: now,
      dateLastUsed: now,
      favorite: false,
      ...searchData,
    };
    searches.push(newSearch);
    this.save(searches);
    return newSearch;
  },

  /**
   * Update an existing saved search
   * @param {string} searchId - ID of the search to update
   * @param {Object} updates - Object with properties to update
   * @returns {Object|null} The updated search object or null if not found
   */
  update(searchId, updates) {
    const searches = this.load();
    const updatedSearches = searches.map((s) => {
      if (s.id === searchId) {
        return { ...s, ...updates, dateLastModified: Date.now() };
      }
      return s;
    });
    this.save(updatedSearches);
    return updatedSearches.find((s) => s.id === searchId) || null;
  },

  /**
   * Delete a saved search
   * @param {string} searchId - ID of the search to delete
   * @returns {boolean} True if deleted, false if not found
   */
  delete(searchId) {
    const searches = this.load();
    const filtered = searches.filter((s) => s.id !== searchId);
    if (filtered.length < searches.length) {
      this.save(filtered);
      return true;
    }
    return false;
  },

  /**
   * Update the last used timestamp for a search
   * @param {string} searchId - ID of the search
   * @returns {Object|null} The updated search object or null
   */
  updateLastUsed(searchId) {
    return this.update(searchId, { dateLastUsed: Date.now() });
  },

  /**
   * Toggle favorite status for a search
   * @param {string} searchId - ID of the search
   * @returns {Object|null} The updated search object or null
   */
  toggleFavorite(searchId) {
    const searches = this.load();
    const search = searches.find((s) => s.id === searchId);
    if (search) {
      return this.update(searchId, { favorite: !search.favorite });
    }
    return null;
  },

  /**
   * Get a specific saved search by ID
   * @param {string} searchId - ID of the search
   * @returns {Object|null} The search object or null if not found
   */
  getById(searchId) {
    const searches = this.load();
    return searches.find((s) => s.id === searchId) || null;
  },

  /**
   * Count total filters in a saved search
   * @param {Object} savedSearch - Saved search object
   * @returns {number} Total count of filters
   */
  countFilters(savedSearch) {
    let facetCount = 0;
    if (savedSearch.facetFilters) {
      Object.values(savedSearch.facetFilters).forEach((facetChecked) => {
        Object.values(facetChecked).forEach((isChecked) => {
          if (isChecked) facetCount += 1;
        });
      });
    }
    const numericCount = savedSearch.numericFilters ? savedSearch.numericFilters.length : 0;
    return facetCount + numericCount;
  },

  /**
   * Sort searches by last used date (most recent first)
   * @param {Array} searches - Array of search objects
   * @returns {Array} Sorted array
   */
  sortByLastUsed(searches) {
    return [...searches].sort((a, b) => {
      const aTime = a.dateLastUsed || a.dateLastModified || a.dateCreated || 0;
      const bTime = b.dateLastUsed || b.dateLastModified || b.dateCreated || 0;
      return bTime - aTime; // Most recent first
    });
  },

  /**
   * Filter searches by search term (name or searchTerm match)
   * @param {Array} searches - Array of search objects
   * @param {string} searchTerm - Term to filter by
   * @returns {Array} Filtered searches
   */
  filter(searches, searchTerm) {
    if (!searchTerm) return searches;

    const lowerTerm = searchTerm.toLowerCase();
    return searches.filter((search) => {
      const nameMatch = search.name.toLowerCase().includes(lowerTerm);
      const searchTermMatch = (search.searchTerm || '').toLowerCase().includes(lowerTerm);
      return nameMatch || searchTermMatch;
    });
  },
};

// For backward compatibility, export individual functions
export const loadSavedSearches = () => savedSearchClient.load();
export const saveSavedSearches = (searches) => savedSearchClient.save(searches);
export const updateSearchLastUsed = (searchId) => savedSearchClient.updateLastUsed(searchId);
export const updateSavedSearch = (searchId, updates) => savedSearchClient.update(searchId, updates);
export const deleteSavedSearch = (searchId) => savedSearchClient.delete(searchId);
export const filterSearches = (searches, term) => savedSearchClient.filter(searches, term);
export const sortSearchesByLastUsed = (searches) => savedSearchClient.sortByLastUsed(searches);
export const countFilters = (savedSearch) => savedSearchClient.countFilters(savedSearch);
