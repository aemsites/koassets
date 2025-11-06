// Import the centralized JavaScript collections client with auth
import { DynamicMediaCollectionsClient } from '../../scripts/collections/collections-api-client.js';
import { transformApiCollectionToInternal } from '../../scripts/collections/collections-utils.js';

// Import collection helpers (constants and utility functions)
import { ACL_FIELDS, ACL_ROLES, getCollectionACL } from './collection-helpers.js';

// Import UI components
import { showToast, createCollectionsList } from './ui-components.js';

// Import modals and modal management
import {
  createShareModal,
  createViewAccessModal,
  createRemoveUserModal,
  createEditModal,
  createDeleteModal,
  createCollectionModal,
  showShareModal,
  hideShareModal,
  setSharingState,
  getSharingState,
  showViewAccessModal,
  hideViewAccessModal,
  updateViewAccessDisplay,
  showRemoveUserConfirmation,
  hideRemoveUserModal,
  getPendingRemoveUser,
  showEditModal,
  hideEditModal,
  getEditingCollection,
  showDeleteModal,
  hideDeleteModal,
  getDeleteState,
  showCreateModal,
  hideCreateModal,
} from './modals.js';

// Metadata path constants for collection ACL
const METADATA_NAMESPACE = 'tccc:metadata';
const ACL_KEY = 'tccc:acl';

// Check if we're in cookie auth mode (same logic as main app)
function isCookieAuth() {
  return window.location.origin.endsWith('adobeaem.workers.dev')
    || window.location.origin === 'http://localhost:8787';
}

/**
 * Ensure the ACL metadata path exists in a collection object
 * Creates nested objects if they don't exist to prevent errors when updating ACL
 * @param {Object} collection - Collection object to initialize
 */
function ensureAclPath(collection) {
  if (!collection.apiData) collection.apiData = {};
  if (!collection.apiData.collectionMetadata) collection.apiData.collectionMetadata = {};
  if (!collection.apiData.collectionMetadata[METADATA_NAMESPACE]) {
    collection.apiData.collectionMetadata[METADATA_NAMESPACE] = {};
  }
  if (!collection.apiData.collectionMetadata[METADATA_NAMESPACE][ACL_KEY]) {
    collection.apiData.collectionMetadata[METADATA_NAMESPACE][ACL_KEY] = {};
  }
}

// Global state for collections and API client
let collectionsClient = null;
let allCollections = [];
let isLoading = false;

// Current search state
let currentSearchTerm = '';

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
    console.trace('🔧 [Collections Client] Initialized with:', {
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
  const currentUser = window.user;
  const handlers = {
    onView: handleViewCollection,
    onEdit: handleEditCollection,
    onDelete: handleDeleteCollection,
    onShare: handleShareCollection,
    onViewAccess: (collectionId, collectionName) => {
      showViewAccessModal(collectionId, collectionName, collectionsClient);
    },
  };
  const collectionsList = createCollectionsList(
    allCollections,
    handlers,
    currentUser,
    currentSearchTerm,
  );

  // Create modals
  const shareModal = createShareModal(handleShareSubmit, hideShareModal);
  const viewAccessModal = createViewAccessModal(
    hideViewAccessModal,
    showRemoveUserConfirmation,
  );
  const removeUserModal = createRemoveUserModal(handleRemoveUser, hideRemoveUserModal);
  const editModal = createEditModal(handleUpdateCollection, hideEditModal);
  const deleteModal = createDeleteModal(handleConfirmDelete, hideDeleteModal);
  const createModal = createCollectionModal(handleCreateCollection, hideCreateModal);

  // Assemble the component
  container.appendChild(header);
  container.appendChild(controlsRow);
  container.appendChild(collectionsList);
  container.appendChild(createModal);
  container.appendChild(editModal);
  container.appendChild(deleteModal);
  container.appendChild(shareModal);
  container.appendChild(viewAccessModal);
  container.appendChild(removeUserModal);

  block.appendChild(container);
}

/**
 * Build asset preview URL for Dynamic Media
 * @param {Object} asset - Asset object with assetId and name
 * @param {string} format - Image format (webp, jpg, etc.)
 * @param {number} width - Image width
 * @returns {string} Formatted preview URL
 */
function buildAssetPreviewUrl(asset, format = 'jpg', width = 80) {
  if (!asset || !asset.assetId) return '';

  // For collection preview, use a generic filename since we might not have the actual filename
  // The API will resolve the correct asset based on the assetId
  const fileName = 'thumbnail';

  return `/api/adobe/assets/${asset.assetId}/as/${fileName}.${format}?width=${width}`;
}

/**
 * Fetch collection items and extract preview info from first asset
 * @param {Object} collection - Collection object
 * @returns {Promise<Object|null>} Preview asset info or null
 */
async function fetchCollectionPreview(collection) {
  try {
    const itemsResponse = await collectionsClient.getCollectionItems(collection.id, { limit: 1 });

    if (itemsResponse && itemsResponse.items && itemsResponse.items.length > 0) {
      const firstItem = itemsResponse.items[0];

      // API returns 'id' field, not 'assetId'
      // Use the ID as both assetId and name (same approach as my-collections-details)
      const assetId = firstItem.id;
      const assetName = firstItem.name || firstItem.title || assetId;

      // Build preview URL from the first asset
      const previewAsset = {
        assetId,
        name: assetName,
        title: assetName,
      };

      const previewUrl = buildAssetPreviewUrl(previewAsset, 'jpg', 80);

      // eslint-disable-next-line no-console
      console.log(`📸 [Preview] Generated preview URL for collection ${collection.name}:`, {
        assetId,
        previewUrl,
      });

      return {
        assetId,
        name: assetName,
        title: assetName,
        previewUrl,
      };
    }

    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to fetch preview for collection ${collection.id}:`, error);
    return null;
  }
}

// API Functions
async function loadCollectionsFromAPI() {
  if (isLoading || !collectionsClient) return;

  isLoading = true;
  try {
    // eslint-disable-next-line no-console
    console.trace('Loading collections from Dynamic Media API...');
    const response = await collectionsClient.searchCollections({ limit: 100 });

    // Transform API response to internal format
    allCollections = response.items.map(transformApiCollectionToInternal);

    // eslint-disable-next-line no-console
    console.trace(`Loaded ${allCollections.length} collections from API`);

    // Fetch preview info for each collection (in parallel for better performance)
    // eslint-disable-next-line no-console
    console.trace('Fetching preview images for collections...');
    const previewPromises = allCollections.map(async (collection) => {
      const preview = await fetchCollectionPreview(collection);
      if (preview) {
        // Add the first asset as contents for preview display
        collection.contents = [preview];
      }
      return collection;
    });

    // Wait for all previews to be fetched
    await Promise.all(previewPromises);

    // eslint-disable-next-line no-console
    console.trace('Finished loading collection previews');

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
    const currentUser = window.user;
    const handlers = {
      onView: handleViewCollection,
      onEdit: handleEditCollection,
      onDelete: handleDeleteCollection,
      onShare: handleShareCollection,
      onViewAccess: (collectionId, collectionName) => {
        showViewAccessModal(
          collectionId,
          collectionName,
          collectionsClient,
        );
      },
    };
    const newList = createCollectionsList(
      filteredCollections,
      handlers,
      currentUser,
      currentSearchTerm,
    );
    existingList.parentNode.replaceChild(newList, existingList);
  }
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

/**
 * Handle share collection action - opens the share modal for a collection
 * @param {string} collectionId - ID of the collection to share
 */
function handleShareCollection(collectionId) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collectionId);

  // Find collection name
  const collection = allCollections.find((c) => c.id === collectionId);
  setSharingState(collectionId, collection ? collection.name : 'Collection');

  showShareModal();

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

/**
 * Handle share form submission - adds users to collection with selected role
 * Reads email addresses from the form, validates them, and updates collection ACL
 */
async function handleShareSubmit() {
  const {
    collectionId: sharingCollectionId,
    collectionName: sharingCollectionName,
  } = getSharingState();
  if (!sharingCollectionId) return;

  const emailInput = document.getElementById('share-collection-emails');
  const roleSelect = document.getElementById('share-collection-role');

  const emails = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'Viewer';

  if (!emails) {
    showToast('Please enter at least one email address', 'info');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  try {
    // Parse emails (split by comma, semicolon, space, or newline)
    const emailList = emails
      .split(/[,;\s\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length === 0) {
      showToast('Please enter valid email addresses', 'info');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('🤝 [Share Collection] Sharing collection:', {
      collectionId: sharingCollectionId,
      collectionName: sharingCollectionName,
      emails: emailList,
      role,
    });

    // Get current collection metadata to update ACL
    const currentCollection = await collectionsClient.getCollectionMetadata(sharingCollectionId);
    const currentAcl = getCollectionACL(currentCollection) || {};

    // Determine which ACL array to update based on role
    const aclField = role === ACL_ROLES.EDITOR ? ACL_FIELDS.EDITOR : ACL_FIELDS.VIEWER;

    // Get existing users in the selected role
    const existingUsers = Array.isArray(currentAcl[aclField]) ? [...currentAcl[aclField]] : [];

    // Add new users (avoid duplicates)
    emailList.forEach((email) => {
      if (!existingUsers.includes(email)) {
        existingUsers.push(email);
      }
    });

    // Update collection metadata with new ACL
    const updateData = {
      [METADATA_NAMESPACE]: {
        [ACL_KEY]: {
          ...currentAcl,
          [aclField]: existingUsers,
        },
      },
    };

    await collectionsClient.updateCollectionMetadata(sharingCollectionId, updateData);

    // Optimistically update local collection data to reflect ACL changes immediately.
    // The API's search endpoint doesn't return updated custom metadata right away,
    // so we update our local copy to avoid requiring a page refresh for the UI to reflect changes.
    const collectionIndex = allCollections.findIndex((c) => c.id === sharingCollectionId);
    if (collectionIndex !== -1) {
      const collection = allCollections[collectionIndex];

      // Ensure the nested ACL path exists
      ensureAclPath(collection);

      // Update the ACL with the new user list
      collection.apiData.collectionMetadata[METADATA_NAMESPACE][ACL_KEY] = {
        ...currentAcl,
        [aclField]: existingUsers,
      };

      // Note: We don't update lastUpdated because the API doesn't update it
      // for ACL-only changes, so keeping it unchanged maintains consistency
    }

    // Show success message
    showToast(`COLLECTION SHARED SUCCESSFULLY WITH ${emailList.length} USER(S)`, 'success');

    // Clear email input
    if (emailInput) emailInput.value = '';

    // Hide the share modal
    hideShareModal();

    // Update display with local data immediately (no API reload needed)
    updateCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to share collection:', error);

    // Hide modal even on error
    hideShareModal();

    showToast(`Failed to share collection: ${error.message}`, 'error');
  }
}

/**
 * Handle user removal from collection after confirmation
 * Updates the collection's ACL, refreshes displays, and handles self-removal
 */
async function handleRemoveUser() {
  const {
    email, role, collectionId, collectionName,
  } = getPendingRemoveUser();

  if (!email || !role || !collectionId) {
    showToast('Invalid removal request', 'error');
    hideRemoveUserModal();
    return;
  }

  try {
    // Get current ACL
    const collection = await collectionsClient.getCollectionMetadata(collectionId);
    const currentAcl = getCollectionACL(collection) || {};

    // Determine which ACL field to update based on role
    let aclField;
    if (role === 'editor') {
      aclField = ACL_FIELDS.EDITOR;
    } else if (role === 'viewer') {
      aclField = ACL_FIELDS.VIEWER;
    } else {
      throw new Error('Cannot remove owner from collection');
    }

    // Get current list and remove the user
    const currentUsers = currentAcl[aclField] || [];
    const updatedUsers = currentUsers.filter((userEmail) => userEmail !== email);

    // Update collection metadata with new ACL
    const updateData = {
      [METADATA_NAMESPACE]: {
        [ACL_KEY]: {
          ...currentAcl,
          [aclField]: updatedUsers,
        },
      },
    };

    await collectionsClient.updateCollectionMetadata(collectionId, updateData);

    // Check if user removed themselves
    const currentUserEmail = (window.user?.email || '').toLowerCase();
    const removedSelf = currentUserEmail === email.toLowerCase();

    // Optimistically update local collection data to reflect ACL changes immediately.
    // The API's search endpoint doesn't return updated custom metadata right away,
    // so we update our local copy to avoid requiring a page refresh for the UI to reflect changes.
    if (!removedSelf) {
      // Only do optimistic update if removing someone else
      // If user removed themselves, we need to reload from API to see if collection is gone
      const collectionIndex = allCollections.findIndex((c) => c.id === collectionId);
      if (collectionIndex !== -1) {
        const localCollection = allCollections[collectionIndex];

        // Ensure the nested ACL path exists
        ensureAclPath(localCollection);

        // Update the ACL with the removed user
        localCollection.apiData.collectionMetadata[METADATA_NAMESPACE][ACL_KEY] = {
          ...currentAcl,
          [aclField]: updatedUsers,
        };

        // Note: We don't update lastUpdated because the API doesn't update it
        // for ACL-only changes, so keeping it unchanged maintains consistency
      }
    }

    // Hide the remove modal
    hideRemoveUserModal();

    // Show success message
    if (removedSelf) {
      showToast(`YOU'VE BEEN REMOVED FROM '${collectionName}'`, 'success');

      // Refresh the main collections list to remove this collection if they lost all access
      hideViewAccessModal();
      await refreshCollectionsDisplay();
    } else {
      showToast('USER REMOVED FROM COLLECTION', 'success');

      // Refresh the view access modal to show updated list
      await updateViewAccessDisplay(collectionId, collectionsClient, showRemoveUserConfirmation);

      // Update main display with local data immediately (no API reload needed)
      updateCollectionsDisplay();
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to remove user:', error);

    hideRemoveUserModal();
    showToast(`Failed to remove user: ${error.message}`, 'error');
  }
}

function handleEditCollection(collection) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collection.id);

  showEditModal(collection);

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

async function handleUpdateCollection() {
  const editingCollection = getEditingCollection();
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
    const updatedCollection = await collectionsClient.updateCollectionMetadata(
      collectionId,
      updateData,
    );

    // eslint-disable-next-line no-console
    console.log('✅ [Update Collection] API response:', updatedCollection);

    // Hide modal first
    hideEditModal();

    // Show success message
    showToast('COLLECTION UPDATED SUCCESSFULLY', 'success');

    // Refresh display to show the updated collection
    await refreshCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update collection:', error);
    showToast(`Failed to update collection: ${error.message}`, 'error');
  }
}

function handleDeleteCollection(collectionId, collectionName) {
  // Update last used when user interacts with collection
  updateCollectionLastUsed(collectionId);

  showDeleteModal(collectionId, collectionName);

  // Refresh display to show updated sort order
  updateCollectionsDisplay();
}

async function handleConfirmDelete() {
  const { collectionId: deleteCollectionId } = getDeleteState();
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
    showToast('COLLECTION DELETED SUCCESSFULLY', 'success');

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
      // Custom metadata with tccc: prefix
      [METADATA_NAMESPACE]: {
        [ACL_KEY]: {
          [ACL_FIELDS.OWNER]: userEmail,
          [ACL_FIELDS.VIEWER]: [],
          [ACL_FIELDS.EDITOR]: [],
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
    const newCollection = await collectionsClient.createCollection(collectionData);

    // eslint-disable-next-line no-console
    console.log('✅ [Create Collection] API response:', newCollection);

    // Hide modal first
    hideCreateModal();

    // Show success message
    showToast('COLLECTION CREATED SUCCESSFULLY', 'success');

    // Refresh display to show the new collection
    await refreshCollectionsDisplay();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create collection:', error);
    showToast(`Failed to create collection: ${error.message}`, 'error');
  }
}
