/**
 * Global Add to Collection Modal functionality
 * Listens for custom events from React components and shows collection selection modal
 */

let currentAsset = null; // legacy single asset support
let currentAssets = [];
let collectionsModal = null;

// Initialize the modal system
function initAddToCollectionModal() {
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

// Load collections and create checkboxes
function loadCollectionsForSelection() {
  const collectionsContainer = collectionsModal.querySelector('.collections-list');
  const noCollectionsMessage = collectionsModal.querySelector('.no-collections-message');

  try {
    const collections = JSON.parse(localStorage.getItem('koassets-my-collections') || '[]');

    if (collections.length === 0) {
      collectionsContainer.style.display = 'none';
      noCollectionsMessage.style.display = 'block';
      return;
    }

    collectionsContainer.style.display = 'block';
    noCollectionsMessage.style.display = 'none';

    // Clear existing content
    collectionsContainer.innerHTML = '';

    // Create checkbox for each collection
    collections.forEach((collection) => {
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

      // First row: name and item count
      const firstRow = document.createElement('div');
      firstRow.className = 'collection-first-row';

      const name = document.createElement('span');
      name.className = 'collection-name';
      name.textContent = collection.name;

      const itemCount = document.createElement('span');
      itemCount.className = 'collection-count';
      itemCount.textContent = `(${collection.contents ? collection.contents.length : 0} items)`;

      firstRow.appendChild(name);
      firstRow.appendChild(itemCount);
      labelContent.appendChild(firstRow);

      // Second row: description (if exists)
      if (collection.description) {
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
    console.error('Error loading collections:', error);
    collectionsContainer.innerHTML = '<div class="error">Error loading collections</div>';
  }
}

// Handle adding asset to selected collections
function handleAddToSelectedCollections() {
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

  const selectedCollectionIds = Array.from(checkboxes).map((cb) => cb.value);

  try {
    const collections = JSON.parse(localStorage.getItem('koassets-my-collections') || '[]');
    let updatedCount = 0;

    const updatedCollections = collections.map((collection) => {
      if (selectedCollectionIds.includes(collection.id)) {
        if (!collection.contents) {
          collection.contents = [];
        }

        const asString = (v) => {
          if (!v) return '';
          if (typeof v === 'string') return v;
          if (typeof v === 'object') {
            if (typeof v.url === 'string') return v.url;
            if (typeof v.src === 'string') return v.src;
          }
          return '';
        };

        let assets;
        if (currentAssets.length > 0) {
          assets = currentAssets;
        } else if (currentAsset) {
          assets = [currentAsset];
        } else {
          assets = [];
        }
        assets.forEach((a) => {
          const ap = a.assetPath || a.assetId;
          const exists = collection.contents.some((item) => (typeof item === 'string' ? item : item.assetPath || item.assetId) === ap);
          if (exists) return;

          const thumbnailUrl = asString(a.previewUrl)
            || asString(a.thumbnail)
            || asString(a.url)
            || asString(a.imageUrl)
            || asString(a.thumbnailUrl)
            || asString(a.preview_image_url);

          collection.contents.push({
            assetId: a.assetId,
            assetPath: ap,
            title: a.title || a.name,
            repoName: a.name || (a.renditions && a.renditions['repo:name']) || '',
            thumbnail: thumbnailUrl || '',
            previewUrl: thumbnailUrl || '',
            addedDate: new Date().toISOString(),
          });
          updatedCount += 1;
        });

        if (updatedCount > 0) {
          collection.lastUpdated = new Date().toISOString();
          collection.dateLastUsed = Date.now();
        }
      }
      return collection;
    });

    // Save updated collections
    localStorage.setItem('koassets-my-collections', JSON.stringify(updatedCollections));

    // Hide modal and show success
    hideCollectionsModal();

    if (updatedCount > 0) {
      showToast('ASSETS ADDED TO COLLECTIONS', 'success');
    } else {
      showToast('ASSET ALREADY EXISTS IN SELECTED COLLECTIONS', 'info');
    }
  } catch (error) {
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
