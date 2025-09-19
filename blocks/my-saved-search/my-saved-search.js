import buildSavedSearchUrl from '../../scripts/saved-search-utils.js';

export default function decorate(block) {
  // Clear existing content
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'my-saved-search-container';

  // Create header section with title and search on same row
  const header = document.createElement('div');
  header.className = 'my-saved-search-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const title = document.createElement('h1');
  title.className = 'my-saved-search-title';
  title.textContent = 'My Saved Searches';

  // Create search section (smaller, in header)
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'What are you looking for?';
  searchInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const searchButton = document.createElement('button');
  searchButton.className = 'search-btn';
  searchButton.textContent = 'Search';
  searchButton.onclick = handleSearch;

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchButton);

  titleRow.appendChild(title);
  titleRow.appendChild(searchContainer);

  header.appendChild(titleRow);

  // Load saved searches from localStorage
  const savedSearches = loadSavedSearches();
  const sortedSearches = sortSearchesByLastUsed([...savedSearches]);
  const searchesCount = savedSearches.length;

  // Create controls row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'my-saved-search-controls';

  const showingText = document.createElement('div');
  showingText.className = 'showing-text';
  showingText.textContent = `Showing ${searchesCount} of ${searchesCount}`;

  controlsRow.appendChild(showingText);

  // Create saved searches list
  const searchesList = createSavedSearchesList(sortedSearches);

  // Create modals
  const editModal = createEditModal();
  const deleteModal = createDeleteModal();

  // Assemble the component
  container.appendChild(header);
  container.appendChild(controlsRow);
  container.appendChild(searchesList);
  container.appendChild(editModal);
  container.appendChild(deleteModal);

  block.appendChild(container);
}

function loadSavedSearches() {
  try {
    const searches = JSON.parse(localStorage.getItem('koassets-saved-searches') || '[]');
    return migrateSavedSearches(searches);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading saved searches:', error);
    return [];
  }
}

function migrateSavedSearches(searches) {
  let needsUpdate = false;
  const migratedSearches = searches.map((search) => {
    if (!search.dateLastUsed) {
      needsUpdate = true;
      return {
        ...search,
        dateLastUsed: search.dateLastModified || search.dateCreated,
      };
    }
    return search;
  });

  // Save migrated searches back to localStorage if needed
  if (needsUpdate) {
    localStorage.setItem('koassets-saved-searches', JSON.stringify(migratedSearches));
  }

  return migratedSearches;
}

// Current search state
let currentSearchTerm = '';

function handleSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchTerm = searchInput ? searchInput.value.trim() : '';
  currentSearchTerm = searchTerm.toLowerCase();
  updateSearchesDisplay();
}

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
// Additional functions for my-saved-search.js

function filterSearches(searches, searchTerm) {
  if (!searchTerm) {
    return searches;
  }

  return searches.filter((search) => {
    const nameMatch = search.name.toLowerCase().includes(searchTerm);
    const searchTermMatch = search.searchTerm.toLowerCase().includes(searchTerm);
    return nameMatch || searchTermMatch;
  });
}

function sortSearchesByLastUsed(searches) {
  return searches.sort((a, b) => {
    // Handle searches that might not have dateLastUsed (legacy searches)
    const aLastUsed = a.dateLastUsed || a.dateLastModified || a.dateCreated;
    const bLastUsed = b.dateLastUsed || b.dateLastModified || b.dateCreated;
    return bLastUsed - aLastUsed; // Most recent first
  });
}

function updateSearchesDisplay() {
  const allSearches = loadSavedSearches();
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

  // Update searches list
  const existingList = document.querySelector('.saved-searches-list');
  if (existingList) {
    const newList = createSavedSearchesList(filteredSearches);
    existingList.parentNode.replaceChild(newList, existingList);
  }
}

function createSavedSearchesList(searches) {
  const listContainer = document.createElement('div');
  listContainer.className = 'saved-searches-list';

  if (searches.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'saved-searches-empty';

    if (currentSearchTerm) {
      emptyState.innerHTML = `
        <p>No saved searches found matching "${currentSearchTerm}".</p>
        <p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">Try different search terms or <button onclick="clearSearch()" style="background: none; border: none; color: #e60012; text-decoration: underline; cursor: pointer;">clear search</button> to see all saved searches.</p>
      `;
    } else {
      emptyState.textContent = 'No saved searches yet. Save searches from the main search page!';
    }

    listContainer.appendChild(emptyState);
    return listContainer;
  }

  // Create table header
  const header = document.createElement('div');
  header.className = 'saved-searches-header';

  const nameHeader = document.createElement('div');
  nameHeader.className = 'header-cell header-name';
  nameHeader.textContent = 'NAME';

  const searchTermHeader = document.createElement('div');
  searchTermHeader.className = 'header-cell header-search-term';
  searchTermHeader.textContent = 'SEARCH TERM';

  const actionHeader = document.createElement('div');
  actionHeader.className = 'header-cell header-action';
  actionHeader.textContent = 'ACTION';

  header.appendChild(nameHeader);
  header.appendChild(searchTermHeader);
  header.appendChild(actionHeader);

  // Create searches rows
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'saved-searches-rows';

  searches.forEach((search) => {
    const row = createSavedSearchRow(search);
    rowsContainer.appendChild(row);
  });

  listContainer.appendChild(header);
  listContainer.appendChild(rowsContainer);

  return listContainer;
}

function createSavedSearchRow(search) {
  const row = document.createElement('div');
  row.className = 'saved-search-row';

  // Name and date cell
  const nameCell = document.createElement('div');
  nameCell.className = 'row-cell cell-name';

  const nameContainer = document.createElement('div');
  nameContainer.className = 'saved-search-name-container';

  const nameText = document.createElement('div');
  nameText.className = 'saved-search-name clickable';
  nameText.textContent = search.name;
  nameText.style.cursor = 'pointer';
  nameText.onclick = () => handleExecuteSearch(search);

  nameContainer.appendChild(nameText);

  const filtersCount = (search.facetFilters ? search.facetFilters.flat().length : 0)
                      + (search.numericFilters ? search.numericFilters.length : 0);
  const filtersText = document.createElement('div');
  filtersText.className = 'saved-search-filters';
  filtersText.textContent = `${filtersCount} filter${filtersCount !== 1 ? 's' : ''} applied`;
  filtersText.style.color = '#666';
  filtersText.style.fontSize = '0.9rem';

  const dateText = document.createElement('div');
  dateText.className = 'saved-search-date';
  const date = new Date(search.dateLastUsed || search.dateLastModified || search.dateCreated);
  dateText.textContent = `Last used: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  nameCell.appendChild(nameContainer);
  nameCell.appendChild(filtersText);
  nameCell.appendChild(dateText);

  // Search term cell
  const searchTermCell = document.createElement('div');
  searchTermCell.className = 'row-cell cell-search-term';

  const searchTermText = document.createElement('div');
  searchTermText.className = 'search-term-text';
  searchTermText.textContent = search.searchTerm || '(no search term)';
  if (!search.searchTerm) {
    searchTermText.style.color = '#999';
    searchTermText.style.fontStyle = 'italic';
  }

  searchTermCell.appendChild(searchTermText);

  // Action cell
  const actionCell = document.createElement('div');
  actionCell.className = 'row-cell cell-action';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'action-btn copy-btn';
  copyBtn.innerHTML = '';
  copyBtn.title = 'Copy Search Link';
  copyBtn.setAttribute('aria-label', 'Copy Search Link');
  copyBtn.onclick = () => handleCopySearchLink(search);

  const favoriteBtn = document.createElement('button');
  favoriteBtn.className = `action-btn favorite-btn ${search.favorite ? 'favorited' : ''}`;
  favoriteBtn.innerHTML = '';
  favoriteBtn.title = search.favorite ? 'Remove from Favorites' : 'Add to Favorites';
  favoriteBtn.setAttribute('aria-label', search.favorite ? 'Remove from Favorites' : 'Add to Favorites');
  favoriteBtn.onclick = () => handleToggleFavorite(search);

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.innerHTML = '';
  editBtn.title = 'Edit Saved Search';
  editBtn.setAttribute('aria-label', 'Edit Saved Search');
  editBtn.onclick = () => handleEditSearch(search);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.innerHTML = '';
  deleteBtn.title = 'Delete Saved Search';
  deleteBtn.setAttribute('aria-label', 'Delete Saved Search');
  deleteBtn.onclick = () => handleDeleteSearch(search.id, search.name);

  actionCell.appendChild(favoriteBtn);
  actionCell.appendChild(editBtn);
  actionCell.appendChild(deleteBtn);
  actionCell.appendChild(copyBtn);

  row.appendChild(nameCell);
  row.appendChild(searchTermCell);
  row.appendChild(actionCell);

  return row;
}

function showToast(message, type = 'success') {
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

function updateSearchLastUsed(searchId) {
  const searches = loadSavedSearches();
  const updatedSearches = searches.map((search) => {
    if (search.id === searchId) {
      return { ...search, dateLastUsed: Date.now() };
    }
    return search;
  });
  localStorage.setItem('koassets-saved-searches', JSON.stringify(updatedSearches));
}

function handleExecuteSearch(search) {
  // Update last used when user executes search
  updateSearchLastUsed(search.id);

  // Build the search URL with parameters
  const params = new URLSearchParams();

  if (search.searchTerm) {
    params.set('q', search.searchTerm);
  }

  if (search.facetFilters && search.facetFilters.length > 0) {
    // Convert facet filters back to URL format
    search.facetFilters.forEach((filterGroup, index) => {
      if (filterGroup.length > 0) {
        params.set(`facetFilters[${index}]`, filterGroup.join(','));
      }
    });
  }

  if (search.numericFilters && search.numericFilters.length > 0) {
    search.numericFilters.forEach((filter, index) => {
      params.set(`numericFilters[${index}]`, filter);
    });
  }

  // Navigate to search page with parameters
  const searchUrl = `/?${params.toString()}`;
  window.location.href = searchUrl;
}

function handleCopySearchLink(search) {
  // Update last used when user interacts with search
  updateSearchLastUsed(search.id);

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
  updateSearchesDisplay();
}

function handleToggleFavorite(search) {
  // Update last used when user interacts with search
  updateSearchLastUsed(search.id);

  const searches = loadSavedSearches();
  const updatedSearches = searches.map((s) => {
    if (s.id === search.id) {
      return { ...s, favorite: !s.favorite, dateLastModified: Date.now() };
    }
    return s;
  });

  localStorage.setItem('koassets-saved-searches', JSON.stringify(updatedSearches));

  const action = search.favorite ? 'REMOVED FROM' : 'ADDED TO';
  showToast(`SEARCH ${action} FAVORITES`, 'success');

  // Refresh display to show updated sort order
  updateSearchesDisplay();
}
// Edit search state
let editingSearch = null;

function handleEditSearch(search) {
  // Update last used when user interacts with search
  updateSearchLastUsed(search.id);

  editingSearch = { ...search };
  showEditModal();

  // Refresh display to show updated sort order
  updateSearchesDisplay();
}

function showEditModal() {
  const modal = document.querySelector('.edit-modal');
  const nameInput = document.getElementById('edit-search-name');

  if (nameInput && editingSearch) {
    nameInput.value = editingSearch.name;
  }

  modal.style.display = 'flex';
  if (nameInput) nameInput.focus();
}

function hideEditModal() {
  const modal = document.querySelector('.edit-modal');
  modal.style.display = 'none';
  editingSearch = null;

  // Clear form
  const nameInput = document.getElementById('edit-search-name');
  if (nameInput) nameInput.value = '';
}

function handleUpdateSearch() {
  if (!editingSearch) return;

  const nameInput = document.getElementById('edit-search-name');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Search name is required', 'info');
    if (nameInput) nameInput.focus();
    return;
  }

  // Update the search
  const searches = loadSavedSearches();
  const updatedSearches = searches.map((search) => {
    if (search.id === editingSearch.id) {
      return {
        ...search,
        name,
        dateLastModified: Date.now(),
        dateLastUsed: Date.now(),
      };
    }
    return search;
  });

  // Save to localStorage
  localStorage.setItem('koassets-saved-searches', JSON.stringify(updatedSearches));

  // Hide modal and show success
  hideEditModal();
  showToast('SAVED SEARCH UPDATED SUCCESSFULLY', 'success');

  // Clear search to show the updated search
  clearSearch();
}

// Delete confirmation state
let deleteSearchId = null;
let deleteSearchName = '';

function handleDeleteSearch(searchId, searchName) {
  // Update last used when user interacts with search
  updateSearchLastUsed(searchId);

  deleteSearchId = searchId;
  deleteSearchName = searchName;
  showDeleteModal();

  // Refresh display to show updated sort order
  updateSearchesDisplay();
}

function showDeleteModal() {
  const modal = document.querySelector('.delete-modal');
  const nameElement = document.getElementById('delete-search-name');
  if (nameElement) {
    nameElement.textContent = deleteSearchName;
  }
  modal.style.display = 'flex';
}

function hideDeleteModal() {
  const modal = document.querySelector('.delete-modal');
  modal.style.display = 'none';
  deleteSearchId = null;
  deleteSearchName = '';
}

function handleConfirmDelete() {
  if (!deleteSearchId) return;

  // Get existing searches
  const searches = loadSavedSearches();

  // Filter out the search to delete
  const updatedSearches = searches.filter((s) => s.id !== deleteSearchId);

  // Save back to localStorage
  localStorage.setItem('koassets-saved-searches', JSON.stringify(updatedSearches));

  // Hide modal
  hideDeleteModal();

  // Show success toast
  showToast('SAVED SEARCH DELETED SUCCESSFULLY', 'success');

  // Clear search to refresh the display properly
  clearSearch();
}

function createEditModal() {
  const modal = document.createElement('div');
  modal.className = 'edit-modal';
  modal.style.display = 'none';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = 'Edit Saved Search';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = hideEditModal;

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Search Name';
  nameLabel.className = 'form-label';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'edit-search-name';
  nameInput.className = 'form-input';
  nameInput.required = true;

  modalBody.appendChild(nameLabel);
  modalBody.appendChild(nameInput);

  // Modal footer
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = hideEditModal;

  const updateBtn = document.createElement('button');
  updateBtn.className = 'btn-create';
  updateBtn.textContent = 'Update';
  updateBtn.onclick = handleUpdateSearch;

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(updateBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modal.appendChild(modalContent);

  return modal;
}

function createDeleteModal() {
  const modal = document.createElement('div');
  modal.className = 'delete-modal';
  modal.style.display = 'none';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = 'Delete Saved Search';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = hideDeleteModal;

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.style.textAlign = 'center';
  modalBody.style.padding = '2rem';

  const warningText = document.createElement('p');
  warningText.style.fontSize = '1.1rem';
  warningText.style.marginBottom = '1rem';
  warningText.textContent = 'Are you sure you want to delete this saved search?';

  const searchNameText = document.createElement('p');
  searchNameText.style.fontWeight = 'bold';
  searchNameText.style.color = '#e60012';
  searchNameText.id = 'delete-search-name';

  const cautionText = document.createElement('p');
  cautionText.style.fontSize = '0.9rem';
  cautionText.style.color = '#666';
  cautionText.style.marginTop = '1rem';
  cautionText.textContent = 'This action cannot be undone.';

  modalBody.appendChild(warningText);
  modalBody.appendChild(searchNameText);
  modalBody.appendChild(cautionText);

  // Modal footer
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = hideDeleteModal;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = handleConfirmDelete;

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(deleteBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modal.appendChild(modalContent);

  return modal;
}
