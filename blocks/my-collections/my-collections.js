// Import the centralized JavaScript collections client with auth
import { DynamicMediaCollectionsClient } from '../../scripts/collections/collections-api-client.js';
import { transformApiCollectionToInternal } from '../../scripts/collections/collections-utils.js';

// Check if we're in cookie auth mode (same logic as main app)
function isCookieAuth() {
  return window.location.origin.endsWith('adobeaem.workers.dev')
    || window.location.origin === 'http://localhost:8787';
}

// Global state for collections and API client
let collectionsClient = null;
let allCollections = [];
let isLoading = false;

export default async function decorate(block) {
  // Clear existing content
  block.innerHTML = '';

  // Load user if not already available
  if (!window.user) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ [Collections Client] Failed to load user, proceeding without user context');
  }

  // Initialize the Collections client with same config as main app (after user is loaded)
  try {
    const accessToken = localStorage.getItem('accessToken') || '';
    const currentUser = window.user; // Get current user for auth (now guaranteed to be loaded)

    collectionsClient = new DynamicMediaCollectionsClient({
      accessToken,
      user: currentUser, // Pass user for auth filtering
    });

    // eslint-disable-next-line no-console
    console.log('🔧 [Collections Client] Initialized with:', {
      hasAccessToken: Boolean(accessToken),
      isCookieAuth: isCookieAuth(),
      hasUser: Boolean(currentUser),
      userEmail: currentUser?.email || 'anonymous',
      userId: currentUser?.id || currentUser?.userId || 'none',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Collections client:', error);
    showError(block, 'Failed to initialize collections service');
    return;
  }

  // Create main container
  const container = document.createElement('div');
  container.className = 'my-collections-container';

  // Create header section with title and search on same row
  const header = document.createElement('div');
  header.className = 'my-collections-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const title = document.createElement('h1');
  title.className = 'my-collections-title';
  title.textContent = 'My Collections';

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

  // Load collections from Dynamic Media API
  await loadCollectionsFromAPI();
  const collectionsCount = allCollections.length;

  // Create controls row
  const controlsRow = document.createElement('div');
  controlsRow.className = 'my-collections-controls';

  const showingText = document.createElement('div');
  showingText.className = 'showing-text';
  showingText.textContent = `Showing ${collectionsCount} of ${collectionsCount}`;

  const createButton = document.createElement('button');
  createButton.className = 'create-new-collection-btn';
  createButton.textContent = 'Create New Collection';
  createButton.onclick = showCreateModal;

  controlsRow.appendChild(showingText);
  controlsRow.appendChild(createButton);

  // Create collections list (initially show loading, will be updated after API call)
  const collectionsList = createCollectionsList(allCollections);

  // Create modals
  const createModal = createCollectionModal();
  const editModal = createEditModal();
  const deleteModal = createDeleteModal();

  // Assemble the component
  container.appendChild(header);
  container.appendChild(controlsRow);
  container.appendChild(collectionsList);
  container.appendChild(createModal);
  container.appendChild(editModal);
  container.appendChild(deleteModal);

  block.appendChild(container);
}

// API Functions
async function loadCollectionsFromAPI() {
  if (isLoading || !collectionsClient) return;

  isLoading = true;
  try {
    // eslint-disable-next-line no-console
    console.log('Loading collections from Dynamic Media API...');
    const response = await collectionsClient.listCollections({ limit: 100 });

    // Transform API response to internal format
    allCollections = response.items.map(transformApiCollectionToInternal);

    // eslint-disable-next-line no-console
    console.log(`Loaded ${allCollections.length} collections from API`);

    // Update the display after loading
    updateCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load collections from API:', error);
    showToast('Failed to load collections', 'error');
    allCollections = [];
  } finally {
    isLoading = false;
  }
}

function showError(block, message) {
  block.innerHTML = `
    <div class="my-collections-container">
      <div class="collections-error">
        <h2>Error</h2>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn-create">Retry</button>
      </div>
    </div>
  `;
}

/**
 * Search collections by name or description
 * @param {string} searchTerm - Search term
 * @param {Array} collections - Collections to search
 * @returns {Array} Filtered collections
 */
function searchCollections(searchTerm, collections) {
  if (!searchTerm || !searchTerm.trim()) {
    return collections;
  }

  const term = searchTerm.toLowerCase().trim();
  return collections.filter((collection) => {
    const nameMatch = collection.name.toLowerCase().includes(term);
    const descMatch = collection.description
                     && collection.description.toLowerCase().includes(term);
    return nameMatch || descMatch;
  });
}

// Current search state
let currentSearchTerm = '';

function handleSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchTerm = searchInput ? searchInput.value.trim() : '';
  currentSearchTerm = searchTerm;
  updateCollectionsDisplay();
}

function clearSearch() {
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.value = '';
  }
  currentSearchTerm = '';
  updateCollectionsDisplay();
}

// Make clearSearch globally available for HTML onclick
window.clearSearch = clearSearch;

// Filter and sort functions now handled by SDK

/**
 * Refresh the collections display by reloading from API
 * Clears search term and updates the display
 */
async function refreshCollectionsDisplay() {
  // Clear search term to ensure changes are visible
  currentSearchTerm = '';
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.value = '';
  }

  // Reload collections from API
  await loadCollectionsFromAPI();
}

function updateCollectionsDisplay() {
  // Sort collections by last modified date (most recent first)
  const sortedCollections = [...allCollections].sort((a, b) => (
    new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  ));

  // Filter collections based on search term
  const filteredCollections = searchCollections(currentSearchTerm, sortedCollections);
  const totalCount = allCollections.length;
  const showingCount = filteredCollections.length;

  // Update the showing text
  const showingText = document.querySelector('.showing-text');
  if (showingText) {
    if (currentSearchTerm) {
      showingText.textContent = `Showing ${showingCount} of ${totalCount}`;
    } else {
      showingText.textContent = `Showing ${totalCount} of ${totalCount}`;
    }
  }

  // Update collections list
  const existingList = document.querySelector('.collections-list');
  if (existingList) {
    const newList = createCollectionsList(filteredCollections);
    existingList.parentNode.replaceChild(newList, existingList);
  }
}

function createCollectionsList(collections) {
  const listContainer = document.createElement('div');
  listContainer.className = 'collections-list';

  if (collections.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'collections-empty';

    if (currentSearchTerm) {
      emptyState.innerHTML = `
        <p>No collections found matching "${currentSearchTerm}".</p>
        <p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">Try different search terms or <button onclick="clearSearch()" style="background: none; border: none; color: #e60012; text-decoration: underline; cursor: pointer;">clear search</button> to see all collections.</p>
      `;
    } else {
      emptyState.textContent = 'No collections yet. Create your first collection!';
    }

    listContainer.appendChild(emptyState);
    return listContainer;
  }

  // Create table header
  const header = document.createElement('div');
  header.className = 'collections-header';

  const previewHeader = document.createElement('div');
  previewHeader.className = 'header-cell header-preview';
  previewHeader.textContent = 'PREVIEW';

  const nameHeader = document.createElement('div');
  nameHeader.className = 'header-cell header-name';
  nameHeader.textContent = 'NAME';

  const actionHeader = document.createElement('div');
  actionHeader.className = 'header-cell header-action';
  actionHeader.textContent = 'ACTION';

  header.appendChild(previewHeader);
  header.appendChild(nameHeader);
  header.appendChild(actionHeader);

  // Create collections rows
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'collections-rows';

  collections.forEach((collection) => {
    const row = createCollectionRow(collection);
    rowsContainer.appendChild(row);
  });

  listContainer.appendChild(header);
  listContainer.appendChild(rowsContainer);

  return listContainer;
}

// Helpers to resolve preview URL from stored asset
function resolveUrlValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.url === 'string') return value.url;
    if (typeof value.src === 'string') return value.src;
  }
  return '';
}

function resolvePreviewUrlFromAsset(asset) {
  return (
    resolveUrlValue(asset && asset.previewUrl)
    || resolveUrlValue(asset && asset.thumbnail)
    || resolveUrlValue(asset && asset.imageUrl)
    || resolveUrlValue(asset && asset.url)
    || ''
  );
}

function createCollectionRow(collection) {
  const row = document.createElement('div');
  row.className = 'collection-row';

  // Preview placeholder
  const previewCell = document.createElement('div');
  previewCell.className = 'row-cell cell-preview';

  const firstAsset = (
    collection
    && Array.isArray(collection.contents)
    && collection.contents.length > 0
  )
    ? collection.contents[0]
    : null;
  const previewSrc = firstAsset ? resolvePreviewUrlFromAsset(firstAsset) : '';

  if (previewSrc) {
    const img = document.createElement('img');
    img.alt = (firstAsset && (firstAsset.title || firstAsset.name)) || 'Collection preview';
    img.src = previewSrc;
    img.loading = 'eager';
    img.className = 'collection-preview-image';
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('[Collections] preview failed to load (list view)', {
        assetId: firstAsset && (firstAsset.assetId || firstAsset.id),
        title: firstAsset && (firstAsset.title || firstAsset.name),
        src: previewSrc,
        collectionId: collection && collection.id,
        collectionName: collection && collection.name,
      });
      const placeholder = document.createElement('div');
      placeholder.className = 'preview-placeholder';
      placeholder.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="8" width="28" height="24" rx="2" fill="#f0f0f0" stroke="#ddd"/>
          <text x="20" y="22" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">?</text>
        </svg>
      `;
      if (previewCell.isConnected) previewCell.replaceChildren(placeholder);
    };
    previewCell.appendChild(img);
  } else {
    const previewIcon = document.createElement('div');
    previewIcon.className = 'preview-placeholder';
    previewIcon.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="8" width="28" height="24" rx="2" fill="#f0f0f0" stroke="#ddd"/>
        <text x="20" y="22" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">?</text>
      </svg>
    `;
    previewCell.appendChild(previewIcon);
  }

  // Name and date cell
  const nameCell = document.createElement('div');
  nameCell.className = 'row-cell cell-name';

  const nameText = document.createElement('div');
  nameText.className = 'collection-name clickable';
  nameText.textContent = collection.name;
  nameText.style.cursor = 'pointer';
  nameText.onclick = () => handleViewCollection(collection);

  const descText = document.createElement('div');
  descText.className = 'collection-description';
  if (collection.description && collection.description.trim()) {
    descText.textContent = collection.description;
  } else {
    descText.textContent = 'No description';
    descText.style.color = '#999';
  }

  const dateText = document.createElement('div');
  dateText.className = 'collection-date';
  const date = new Date(collection.lastUpdated);
  dateText.textContent = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  nameCell.appendChild(nameText);
  nameCell.appendChild(descText);
  nameCell.appendChild(dateText);

  // Action cell
  const actionCell = document.createElement('div');
  actionCell.className = 'row-cell cell-action';

  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  // Icon applied via CSS background
  editBtn.innerHTML = '';
  editBtn.title = 'Edit Collection';
  editBtn.setAttribute('aria-label', 'Edit Collection');
  editBtn.onclick = () => handleEditCollection(collection);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  // Icon applied via CSS background per design guidelines
  deleteBtn.innerHTML = '';
  deleteBtn.title = 'Delete Collection';
  deleteBtn.setAttribute('aria-label', 'Delete Collection');
  deleteBtn.onclick = () => handleDeleteCollection(collection.id, collection.name);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'action-btn share-btn';
  // Icon applied via CSS background
  shareBtn.innerHTML = '';
  shareBtn.title = 'Share Collection';
  shareBtn.setAttribute('aria-label', 'Share Collection');
  shareBtn.onclick = () => handleShareCollection(collection.id);

  actionCell.appendChild(editBtn);
  actionCell.appendChild(deleteBtn);
  actionCell.appendChild(shareBtn);

  row.appendChild(previewCell);
  row.appendChild(nameCell);
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

function updateCollectionLastUsed(collectionId) {
  // TODO: Implement API call to update last used timestamp
  // For now, just log the action
  // eslint-disable-next-line no-console
  console.log('TODO: Update last used for collection:', collectionId);
}

function handleViewCollection(collection) {
  // Update last used when user views collection
  updateCollectionLastUsed(collection.id);

  // Navigate to collection details page with collection ID
  window.location.href = `/my-collections-details?id=${collection.id}`;
}

function handleShareCollection(collectionId) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collectionId);

  showToast('Share Collection feature is not implemented yet.', 'info');

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

// Edit collection state
let editingCollection = null;

function handleEditCollection(collection) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collection.id);

  editingCollection = { ...collection };
  showEditModal();

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

function showEditModal() {
  const modal = document.querySelector('.edit-modal');
  const nameInput = document.getElementById('edit-collection-name');
  const descInput = document.getElementById('edit-collection-description');

  if (nameInput && editingCollection) {
    nameInput.value = editingCollection.name;
  }
  if (descInput && editingCollection) {
    descInput.value = editingCollection.description || '';
  }

  modal.style.display = 'flex';
  if (nameInput) nameInput.focus();
}

function hideEditModal() {
  const modal = document.querySelector('.edit-modal');
  modal.style.display = 'none';
  editingCollection = null;

  // Clear form
  const nameInput = document.getElementById('edit-collection-name');
  const descInput = document.getElementById('edit-collection-description');
  if (nameInput) nameInput.value = '';
  if (descInput) descInput.value = '';
}

async function handleUpdateCollection() {
  if (!editingCollection) return;

  const nameInput = document.getElementById('edit-collection-name');
  const descInput = document.getElementById('edit-collection-description');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Collection name is required', 'info');
    if (nameInput) nameInput.focus();
    return;
  }

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  try {
    // Prepare update data for API (same format as test-dm)
    const updateData = {
      title: name, // API uses 'title' not 'name'
    };

    const description = descInput ? descInput.value.trim() : '';
    if (description) {
      updateData.description = description;
    }

    // eslint-disable-next-line no-console
    console.log('🎯 [Update Collection] Sending update data:', updateData);

    // Update collection via API using the collection ID from the API data
    const collectionId = editingCollection.apiData?.id || editingCollection.id;
    const result = await collectionsClient.updateCollectionMetadata(collectionId, updateData);

    // Hide modal first
    hideEditModal();

    // Show success message
    const collectionTitle = result.collectionMetadata?.title || result.title || name;
    showToast(`COLLECTION "${collectionTitle}" UPDATED SUCCESSFULLY`, 'success');

    // Refresh display to show the updated collection
    await refreshCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update collection:', error);
    showToast(`Failed to update collection: ${error.message}`, 'error');
  }
}

// Delete confirmation state
let deleteCollectionId = null;
let deleteCollectionName = '';

function handleDeleteCollection(collectionId, collectionName) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collectionId);

  deleteCollectionId = collectionId;
  deleteCollectionName = collectionName;
  showDeleteModal();

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

function showDeleteModal() {
  const modal = document.querySelector('.delete-modal');
  const nameElement = document.getElementById('delete-collection-name');
  if (nameElement) {
    nameElement.textContent = deleteCollectionName;
  }
  modal.style.display = 'flex';
}

function hideDeleteModal() {
  const modal = document.querySelector('.delete-modal');
  modal.style.display = 'none';
  deleteCollectionId = null;
  deleteCollectionName = '';
}

async function handleConfirmDelete() {
  if (!deleteCollectionId) return;

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  try {
    // eslint-disable-next-line no-console
    console.log('🗑️ [Delete Collection] Deleting collection:', deleteCollectionId);

    // Delete collection via API
    await collectionsClient.deleteCollection(deleteCollectionId);

    // Hide modal first
    hideDeleteModal();

    // Show success message
    showToast(`COLLECTION "${deleteCollectionName}" DELETED SUCCESSFULLY`, 'success');

    // Refresh display to show the changes
    await refreshCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to delete collection:', error);

    // Hide modal even on error
    hideDeleteModal();

    showToast(`Failed to delete collection: ${error.message}`, 'error');
  }
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
  modalTitle.textContent = 'Edit Collection';

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
  nameLabel.textContent = 'Collection Name';
  nameLabel.className = 'form-label';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'edit-collection-name';
  nameInput.className = 'form-input';
  nameInput.required = true;

  const descLabel = document.createElement('label');
  descLabel.textContent = 'Collection Description (optional)';
  descLabel.className = 'form-label';

  const descTextarea = document.createElement('textarea');
  descTextarea.id = 'edit-collection-description';
  descTextarea.className = 'form-textarea';
  descTextarea.rows = 4;

  modalBody.appendChild(nameLabel);
  modalBody.appendChild(nameInput);
  modalBody.appendChild(descLabel);
  modalBody.appendChild(descTextarea);

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
  updateBtn.onclick = handleUpdateCollection;

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
  modalTitle.textContent = 'Delete Collection';

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
  warningText.textContent = 'Are you sure you want to delete this collection?';

  const collectionNameText = document.createElement('p');
  collectionNameText.style.fontWeight = 'bold';
  collectionNameText.style.color = '#e60012';
  collectionNameText.id = 'delete-collection-name';

  const cautionText = document.createElement('p');
  cautionText.style.fontSize = '0.9rem';
  cautionText.style.color = '#666';
  cautionText.style.marginTop = '1rem';
  cautionText.textContent = 'This action cannot be undone.';

  modalBody.appendChild(warningText);
  modalBody.appendChild(collectionNameText);
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

function createCollectionModal() {
  const modal = document.createElement('div');
  modal.className = 'collection-modal';
  modal.style.display = 'none';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = 'Create Collection';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = hideCreateModal;

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Collection Name';
  nameLabel.className = 'form-label';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'collection-name';
  nameInput.className = 'form-input';
  nameInput.required = true;

  const descLabel = document.createElement('label');
  descLabel.textContent = 'Collection Description (optional)';
  descLabel.className = 'form-label';

  const descTextarea = document.createElement('textarea');
  descTextarea.id = 'collection-description';
  descTextarea.className = 'form-textarea';
  descTextarea.rows = 4;

  modalBody.appendChild(nameLabel);
  modalBody.appendChild(nameInput);
  modalBody.appendChild(descLabel);
  modalBody.appendChild(descTextarea);

  // Modal footer
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = hideCreateModal;

  const createBtn = document.createElement('button');
  createBtn.className = 'btn-create';
  createBtn.textContent = 'Create';
  createBtn.onclick = handleCreateCollection;

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(createBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modal.appendChild(modalContent);

  return modal;
}

function showCreateModal() {
  const modal = document.querySelector('.collection-modal');
  modal.style.display = 'flex';
  document.getElementById('collection-name').focus();
}

function hideCreateModal() {
  const modal = document.querySelector('.collection-modal');
  modal.style.display = 'none';
  // Clear form
  document.getElementById('collection-name').value = '';
  document.getElementById('collection-description').value = '';
}

async function handleCreateCollection() {
  const nameInput = document.getElementById('collection-name');
  const descInput = document.getElementById('collection-description');

  const name = nameInput.value.trim();
  if (!name) {
    showToast('Collection name is required', 'info');
    nameInput.focus();
    return;
  }

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  try {
    // Get current user email for custom metadata
    const currentUser = window.user;
    const userEmail = currentUser?.email || '';

    // Prepare collection data for API (same format as test-dm)
    const collectionData = {
      title: name, // API uses 'title' not 'name'
      accessLevel: 'private', // Default to private
      items: [], // Required empty items array
      // Custom metadata with ko: prefix
      'ko:metadata': {
        'ko:acl': {
          owner: userEmail,
          read: [userEmail],
          write: [userEmail],
        },
      },
    };

    const description = descInput.value.trim();
    if (description) {
      collectionData.description = description;
    }

    // eslint-disable-next-line no-console
    console.log('🎯 [Create Collection] Sending collection data:', collectionData);

    // Create collection via API
    const result = await collectionsClient.createCollection(collectionData);

    // Hide modal first
    hideCreateModal();

    // Show success message
    const collectionTitle = result.collectionMetadata?.title || result.title || 'Unknown';
    showToast(`COLLECTION "${collectionTitle}" CREATED SUCCESSFULLY`, 'success');

    // Refresh display to show the new collection
    await refreshCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create collection:', error);
    showToast(`Failed to create collection: ${error.message}`, 'error');
  }
}
