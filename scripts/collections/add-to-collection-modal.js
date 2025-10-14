/**
 * Global Add to Collection Modal functionality
 * Listens for custom events from React components and shows collection selection modal
 */

// Import the centralized JavaScript collections client with auth
import { DynamicMediaCollectionsClient } from './collections-api-client.js';
import { transformApiCollectionToInternal } from './collections-utils.js';

// Check if we're in cookie auth mode (same logic as main app)
function isCookieAuth() {
  return window.location.origin.endsWith('adobeaem.workers.dev')
    || window.location.origin === 'http://localhost:8787';
}

// Global state
let collectionsClient = null;
let allCollections = [];
let currentAsset = null; // legacy single asset support
let currentAssets = [];
let collectionsModal = null;

// Initialize the modal system
async function initAddToCollectionModal() {
  // Load user if not already available
  if (!window.user) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ [Collections Client Modal] Failed to load user, proceeding without user context');
  }

  // Initialize the Collections client with same config as main app
  try {
    const accessToken = localStorage.getItem('accessToken') || '';
    const currentUser = window.user; // Get current user for auth

    collectionsClient = new DynamicMediaCollectionsClient({
      accessToken,
      user: currentUser, // Pass user for auth filtering
    });
    // eslint-disable-next-line no-console
    console.log('🔧 [Collections Client Modal] Initialized with:', {
      hasAccessToken: Boolean(accessToken),
      isCookieAuth: isCookieAuth(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Collections client for modal:', error);
  }

  // Listen for the custom event from React components
  window.addEventListener('openCollectionModal', handleOpenCollectionModal);

  // Create the modal structure if it doesn't exist
  if (!collectionsModal) {
    createCollectionsModal();
  }
}

// Handle the custom event from React components
function handleOpenCollectionModal(event) {
  const { asset, assets, assetPath } = event.detail || {};
  if (Array.isArray(assets)) {
    currentAssets = assets.slice();
  } else if (asset) {
    currentAssets = [asset];
  } else {
    currentAssets = [];
  }
  if (currentAssets[0]) {
    currentAsset = { ...currentAssets[0], assetPath: assetPath || currentAssets[0].assetPath };
  } else {
    currentAsset = null;
  }
  try {
    // Log asset details when opening the modal to inspect available fields
    // Using JSON.stringify for readable formatting
    // eslint-disable-next-line no-console
    if (currentAssets.length > 1) {
      console.log('[Collections] openCollectionModal assets count:', currentAssets.length);
    } else {
      console.log('[Collections] openCollectionModal asset details:', JSON.stringify(currentAsset, null, 2));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[Collections] openCollectionModal assets (raw):', currentAssets);
  }
  showCollectionsModal();
}

// Create the modal HTML structure
function createCollectionsModal() {
  collectionsModal = document.createElement('div');
  collectionsModal.className = 'add-to-collection-modal';
  collectionsModal.style.display = 'none';

  collectionsModal.innerHTML = `
    <div class="add-to-collection-modal-content">
      <div class="add-to-collection-modal-header">
        <h2 class="add-to-collection-modal-title">Add to Collection</h2>
        <button class="add-to-collection-modal-close">&times;</button>
      </div>
      
      <div class="add-to-collection-modal-body">
        
        
        <div class="collections-section">
          <div class="collections-list">
            <!-- Collections will be populated here -->
          </div>
          <div class="no-collections-message" style="display: none;">
            <p>No collections found. <a href="/my-collections">Create your first collection</a>.</p>
          </div>
        </div>
      </div>
      
      <div class="add-to-collection-modal-footer">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-add">Add to Selected</button>
      </div>
    </div>
  `;

  // Add event listeners
  const closeBtn = collectionsModal.querySelector('.add-to-collection-modal-close');
  const cancelBtn = collectionsModal.querySelector('.btn-cancel');
  const addBtn = collectionsModal.querySelector('.btn-add');

  closeBtn.onclick = hideCollectionsModal;
  cancelBtn.onclick = hideCollectionsModal;
  addBtn.onclick = handleAddToSelectedCollections;

  // Close modal when clicking outside
  collectionsModal.onclick = (e) => {
    if (e.target === collectionsModal) {
      hideCollectionsModal();
    }
  };

  // Append to body
  document.body.appendChild(collectionsModal);
}

// Show the modal and populate with current asset and collections
function showCollectionsModal() {
  if (!currentAsset) return;

  // Load and display collections
  loadCollectionsForSelection();

  // Show modal
  collectionsModal.style.display = 'flex';
}

// Hide the modal
function hideCollectionsModal() {
  collectionsModal.style.display = 'none';
  currentAsset = null;
  currentAssets = [];
}

// Load collections from API and create checkboxes
async function loadCollectionsForSelection() {
  const collectionsContainer = collectionsModal.querySelector('.collections-list');
  const noCollectionsMessage = collectionsModal.querySelector('.no-collections-message');

  if (!collectionsClient) {
    collectionsContainer.innerHTML = '<div class="error">Collections service not available</div>';
    return;
  }

  try {
    // Show loading state
    collectionsContainer.innerHTML = '<div class="loading">Loading collections...</div>';
    // eslint-disable-next-line no-console
    console.log('Loading collections from Dynamic Media API for modal...');
    const response = await collectionsClient.listCollections({ limit: 100 });

    // Transform API response to internal format
    allCollections = response.items.map(transformApiCollectionToInternal);

    // eslint-disable-next-line no-console
    console.log(`Loaded ${allCollections.length} collections from API for modal`);

    if (allCollections.length === 0) {
      collectionsContainer.style.display = 'none';
      noCollectionsMessage.style.display = 'block';
      return;
    }

    collectionsContainer.style.display = 'block';
    noCollectionsMessage.style.display = 'none';

    // Clear existing content
    collectionsContainer.innerHTML = '';

    // Create checkbox for each collection
    allCollections.forEach((collection) => {
      const collectionItem = document.createElement('div');
      collectionItem.className = 'collection-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `collection-${collection.id}`;
      checkbox.value = collection.id;
      checkbox.className = 'collection-checkbox';

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.className = 'collection-label';

      const labelContent = document.createElement('div');
      labelContent.className = 'collection-label-content';

      // Collection name
      const name = document.createElement('div');
      name.className = 'collection-name';
      name.textContent = collection.name;

      labelContent.appendChild(name);

      // Second row: description (if exists)
      if (collection.description && collection.description.trim()) {
        const description = document.createElement('div');
        description.className = 'collection-description';
        description.textContent = collection.description;
        labelContent.appendChild(description);
      }

      label.appendChild(labelContent);

      collectionItem.appendChild(checkbox);
      collectionItem.appendChild(label);

      collectionsContainer.appendChild(collectionItem);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading collections for modal:', error);
    collectionsContainer.innerHTML = '<div class="error">Error loading collections</div>';
  }
}

// Handle adding asset to selected collections
async function handleAddToSelectedCollections() {
  // Dump the full currentAsset JSON at the time of add for debugging
  try {
    // eslint-disable-next-line no-console
    if (currentAssets.length > 1) {
      console.log('[Collections] handleAddToSelectedCollections assets count:', currentAssets.length);
    } else {
      console.log('[Collections] handleAddToSelectedCollections currentAsset:', JSON.stringify(currentAsset, null, 2));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('[Collections] handleAddToSelectedCollections assets (raw):', currentAssets);
  }
  const checkboxes = collectionsModal.querySelectorAll('.collection-checkbox:checked');

  if (checkboxes.length === 0) {
    showToast('Please select at least one collection', 'info');
    return;
  }

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  const selectedCollectionIds = Array.from(checkboxes).map((cb) => cb.value);

  try {
    let updatedCount = 0;
    // Prepare assets to add
    let assets;
    if (currentAssets.length > 0) {
      assets = currentAssets;
    } else if (currentAsset) {
      assets = [currentAsset];
    } else {
      assets = [];
    }

    // Add assets to each selected collection using API
    const addPromises = selectedCollectionIds.map(async (collectionId) => {
      try {
        // Prepare add operations for all assets (API expects array format)
        const addOperations = assets.map((asset) => ({
          op: 'add',
          id: asset.assetId || asset.id,
          type: 'asset',
        }));

        // eslint-disable-next-line no-console
        console.log('➕ [Add to Collection] Adding assets to collection:', { collectionId, operations: addOperations });

        // Add assets to collection via API
        await collectionsClient.updateCollectionItems(collectionId, addOperations);

        return assets.length;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to add assets to collection ${collectionId}:`, error);
        // Continue with other collections even if one fails
        return 0;
      }
    });

    const results = await Promise.all(addPromises);
    updatedCount = results.reduce((sum, count) => sum + count, 0);

    // Hide modal and show success
    hideCollectionsModal();

    if (updatedCount > 0) {
      showToast('ASSETS ADDED TO COLLECTIONS SUCCESSFULLY', 'success');
    } else {
      showToast('Failed to add assets to collections', 'error');
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding asset to collections:', error);
    showToast('Error adding asset to collections', 'error');
  }
}

// Toast notification function (reused from my-collections)
function showToast(message, type = 'success') {
  // Check if toast already exists
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initAddToCollectionModal);

// Export for module usage
export { initAddToCollectionModal, handleOpenCollectionModal };
