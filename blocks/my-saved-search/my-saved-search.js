/**
 * My Saved Search block - Main orchestration
 */

import buildSavedSearchUrl from '../../scripts/saved-searches/saved-search-utils.js';
import {
  loadSavedSearches,
  filterSearches,
  sortSearchesByLastUsed,
  updateSearchLastUsed,
  updateSavedSearch,
  showToast,
} from './saved-search-helpers.js';
import {
  createHeader,
  createControlsRow,
  createSavedSearchesList,
} from './ui-components.js';
import {
  initModals,
  createEditModal,
  createDeleteModal,
  showEditModal,
  showDeleteModal,
} from './modals.js';

// Current search state
let currentSearchTerm = '';

/**
 * Execute a saved search
 * @param {Object} search - Search object
 */
async function handleExecuteSearch(search) {
  // Update last used when user executes search
  await updateSearchLastUsed(search.id);

  // Use the shared utility to build the search URL (same as copy link)
  const searchUrl = buildSavedSearchUrl(search);
  window.location.href = searchUrl;
}

/**
 * Copy search link to clipboard
 * @param {Object} search - Search object
 */
async function handleCopySearchLink(search) {
  // Update last used when user interacts with search
  await updateSearchLastUsed(search.id);

  // Use shared utility to build the search URL
  const searchUrl = buildSavedSearchUrl(search);

  // Copy to clipboard
  navigator.clipboard.writeText(searchUrl).then(() => {
    showToast('SEARCH LINK COPIED TO CLIPBOARD', 'success');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = searchUrl;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('SEARCH LINK COPIED TO CLIPBOARD', 'success');
  });

  // Refresh display to show updated sort order
  // eslint-disable-next-line no-use-before-define
  await updateSearchesDisplay();
}

/**
 * Toggle favorite status
 * @param {Object} search - Search object
 */
async function handleToggleFavorite(search) {
  // Update last used when user interacts with search
  await updateSearchLastUsed(search.id);

  // Update the favorite status
  await updateSavedSearch(search.id, {
    favorite: !search.favorite,
  });

  const action = search.favorite ? 'REMOVED FROM' : 'ADDED TO';
  showToast(`SEARCH ${action} FAVORITES`, 'success');

  // Refresh display to show updated sort order
  // eslint-disable-next-line no-use-before-define
  await updateSearchesDisplay();
}

/**
 * Update the searches display
 * @param {boolean} shouldClearSearch - Whether to clear the search filter
 */
async function updateSearchesDisplay(shouldClearSearch = false) {
  if (shouldClearSearch) {
    // eslint-disable-next-line no-use-before-define
    clearSearch();
    return;
  }

  const allSearches = await loadSavedSearches();
  // Create copy to avoid mutating original
  const sortedSearches = sortSearchesByLastUsed([...allSearches]);
  const filteredSearches = filterSearches(sortedSearches, currentSearchTerm);
  const totalCount = allSearches.length;
  const showingCount = filteredSearches.length;

  // Update the showing text
  const showingText = document.querySelector('.showing-text');
  if (showingText) {
    if (currentSearchTerm) {
      showingText.textContent = `Showing ${showingCount} of ${totalCount}`;
    } else {
      showingText.textContent = `Showing ${totalCount} of ${totalCount}`;
    }
  }

  // Create event handlers object
  const handlers = {
    onExecute: handleExecuteSearch,
    onCopy: handleCopySearchLink,
    onToggleFavorite: handleToggleFavorite,
    onEdit: (search) => showEditModal(search),
    onDelete: (searchId, searchName) => showDeleteModal(searchId, searchName),
  };

  // Update searches list
  const existingList = document.querySelector('.saved-searches-list');
  if (existingList) {
    const newList = createSavedSearchesList(filteredSearches, currentSearchTerm, handlers);
    existingList.parentNode.replaceChild(newList, existingList);
  }
}

/**
 * Clear search
 */
function clearSearch() {
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.value = '';
  }
  currentSearchTerm = '';
  updateSearchesDisplay();
}

// Make clearSearch globally available for HTML onclick
window.clearSearch = clearSearch;

/**
 * Handle search input
 */
function handleSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchTerm = searchInput ? searchInput.value.trim() : '';
  currentSearchTerm = searchTerm.toLowerCase();
  updateSearchesDisplay();
}

/**
 * Main decorate function
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  // Clear existing content
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'my-saved-search-container';

  // Show loading state
  container.innerHTML = '<div style="padding: 2rem; text-align: center;">Loading saved searches...</div>';
  block.appendChild(container);

  // Create header with search
  const header = createHeader(handleSearch);

  // Load saved searches from KV storage
  const savedSearches = await loadSavedSearches();
  const sortedSearches = sortSearchesByLastUsed([...savedSearches]);
  const searchesCount = savedSearches.length;

  // Create controls row
  const controlsRow = createControlsRow(searchesCount, searchesCount);

  // Create event handlers object
  const handlers = {
    onExecute: handleExecuteSearch,
    onCopy: handleCopySearchLink,
    onToggleFavorite: handleToggleFavorite,
    onEdit: (search) => showEditModal(search),
    onDelete: (searchId, searchName) => showDeleteModal(searchId, searchName),
  };

  // Create saved searches list
  const searchesList = createSavedSearchesList(sortedSearches, currentSearchTerm, handlers);

  // Create modals
  const editModal = createEditModal();
  const deleteModal = createDeleteModal();

  // Initialize modals with update callback
  initModals(updateSearchesDisplay);

  // Clear loading and assemble the component
  container.innerHTML = '';
  container.appendChild(header);
  container.appendChild(controlsRow);
  container.appendChild(searchesList);
  container.appendChild(editModal);
  container.appendChild(deleteModal);
}
