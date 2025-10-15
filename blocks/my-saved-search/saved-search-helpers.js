/**
 * Helper functions for saved search operations
 * Uses the shared saved-search-client for core operations
 */

import {
  savedSearchClient,
  loadSavedSearches,
  updateSearchLastUsed,
  updateSavedSearch,
  deleteSavedSearch,
  filterSearches,
  sortSearchesByLastUsed,
} from '../../scripts/saved-searches/saved-search-client.js';

// Re-export shared client functions for use in this block
export {
  savedSearchClient,
  loadSavedSearches,
  updateSearchLastUsed,
  updateSavedSearch,
  deleteSavedSearch,
  filterSearches,
  sortSearchesByLastUsed,
};

/**
 * Show a toast notification
 * Block-specific UI function
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, info, error)
 */
export function showToast(message, type = 'success') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Add to document
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Remove after timeout
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
