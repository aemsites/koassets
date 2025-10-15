/**
 * UI component creation functions for saved searches
 */

/**
 * Create a row for a saved search
 * @param {Object} search - Search object
 * @param {Object} handlers - Event handlers object
 * @returns {HTMLElement} Row element
 */
export function createSavedSearchRow(search, handlers) {
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
  nameText.onclick = () => handlers.onExecute(search);

  nameContainer.appendChild(nameText);

  const facetFiltersCount = search.facetFilters
    ? Object.values(search.facetFilters).reduce((total, facetGroup) => {
      const selectedCount = Object.values(facetGroup)
        .filter((isSelected) => isSelected === true).length;
      return total + selectedCount;
    }, 0)
    : 0;
  const filtersCount = facetFiltersCount
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
  copyBtn.onclick = () => handlers.onCopy(search);

  const favoriteBtn = document.createElement('button');
  favoriteBtn.className = `action-btn favorite-btn ${search.favorite ? 'favorited' : ''}`;
  favoriteBtn.innerHTML = '';
  favoriteBtn.title = search.favorite ? 'Remove from Favorites' : 'Add to Favorites';
  favoriteBtn.setAttribute('aria-label', search.favorite ? 'Remove from Favorites' : 'Add to Favorites');
  favoriteBtn.onclick = () => handlers.onToggleFavorite(search);

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.innerHTML = '';
  editBtn.title = 'Edit Saved Search';
  editBtn.setAttribute('aria-label', 'Edit Saved Search');
  editBtn.onclick = () => handlers.onEdit(search);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.innerHTML = '';
  deleteBtn.title = 'Delete Saved Search';
  deleteBtn.setAttribute('aria-label', 'Delete Saved Search');
  deleteBtn.onclick = () => handlers.onDelete(search.id, search.name);

  actionCell.appendChild(favoriteBtn);
  actionCell.appendChild(editBtn);
  actionCell.appendChild(deleteBtn);
  actionCell.appendChild(copyBtn);

  row.appendChild(nameCell);
  row.appendChild(searchTermCell);
  row.appendChild(actionCell);

  return row;
}

/**
 * Create the saved searches list
 * @param {Array} searches - Array of search objects
 * @param {string} currentSearchTerm - Current filter term
 * @param {Object} handlers - Event handlers object
 * @returns {HTMLElement} List container element
 */
export function createSavedSearchesList(searches, currentSearchTerm, handlers) {
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
    const row = createSavedSearchRow(search, handlers);
    rowsContainer.appendChild(row);
  });

  listContainer.appendChild(header);
  listContainer.appendChild(rowsContainer);

  return listContainer;
}

/**
 * Create header section with title and search
 * @param {Function} onSearch - Search handler function
 * @returns {HTMLElement} Header element
 */
export function createHeader(onSearch) {
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
      onSearch();
    }
  };

  const searchButton = document.createElement('button');
  searchButton.className = 'search-btn';
  searchButton.textContent = 'Search';
  searchButton.onclick = onSearch;

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchButton);

  titleRow.appendChild(title);
  titleRow.appendChild(searchContainer);

  header.appendChild(titleRow);

  return header;
}

/**
 * Create controls row with showing text
 * @param {number} showingCount - Number of searches being shown
 * @param {number} totalCount - Total number of searches
 * @returns {HTMLElement} Controls row element
 */
export function createControlsRow(showingCount, totalCount) {
  const controlsRow = document.createElement('div');
  controlsRow.className = 'my-saved-search-controls';

  const showingText = document.createElement('div');
  showingText.className = 'showing-text';
  showingText.textContent = `Showing ${showingCount} of ${totalCount}`;

  controlsRow.appendChild(showingText);

  return controlsRow;
}
