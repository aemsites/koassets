// Import the centralized JavaScript collections client with auth
import { DynamicMediaCollectionsClient } from '../../scripts/collections/collections-api-client.js';
import { populateAssetFromHit, saveCartItems } from '../../scripts/asset-transformers.js';

// Check if we're in cookie auth mode (same logic as main app)
function isCookieAuth() {
  return window.location.origin.endsWith('adobeaem.workers.dev')
    || window.location.origin === 'http://localhost:8787';
}

// Global state for collections and API client
let collectionsClient = null;
let currentCollection = null;
let isLoading = false;

// API Functions
async function loadCollectionFromAPI(collectionId) {
  if (isLoading || !collectionsClient) return;

  isLoading = true;
  try {
    // eslint-disable-next-line no-console
    console.log('Loading collection assets using search API...');

    // Get collection metadata first (for title, description, etc.)
    const collectionMetadata = await collectionsClient.getCollectionMetadata(collectionId);

    // Search for assets in this collection to get full metadata
    const searchData = await collectionsClient.searchAssetsInCollection('', {
      collectionId,
      hitsPerPage: 100,
      page: 0,
    });

    // Transform search response to internal format
    currentCollection = transformSearchResultsToInternal(
      searchData,
      collectionId,
      collectionMetadata,
    );

    // eslint-disable-next-line no-console
    console.log(`Loaded collection with ${currentCollection.contents.length} assets from search`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load collection from API:', error);
    currentCollection = null;
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Transform search results to internal collection format
 * @param {Object} searchResponse - Response from searchAssets API (Algolia format)
 * @param {string} collectionId - Collection ID
 * @param {Object} collectionMetadata - Collection metadata from getCollectionMetadata
 * @returns {Object} Internal collection format
 */
function transformSearchResultsToInternal(searchResponse, collectionId, collectionMetadata) {
  // Extract hits from Algolia response
  const result = searchResponse.results?.[0];
  const hits = result?.hits || [];

  // eslint-disable-next-line no-console
  console.log(`🔍 [Collection Details] Transforming ${hits.length} search results`);

  // Transform search hits to internal asset format
  const contents = hits.map(transformSearchHitToAsset);

  // Extract metadata from collection metadata response
  const metadata = collectionMetadata.collectionMetadata || {};
  const repoMetadata = collectionMetadata.repositoryMetadata || {};

  return {
    id: collectionId,
    name: metadata.title || 'Untitled Collection',
    description: metadata.description || '',
    lastUpdated: repoMetadata['repo:modifyDate'] || new Date().toISOString(),
    dateLastUsed: new Date(repoMetadata['repo:modifyDate'] || Date.now()).getTime(),
    dateCreated: repoMetadata['repo:createDate'] || new Date().toISOString(),
    createdBy: repoMetadata['repo:createdBy'] || '',
    modifiedBy: repoMetadata['repo:modifiedBy'] || '',
    contents,
    favorite: false, // Not supported by API yet
    // Keep original API data for reference
    _searchData: searchResponse,
    _collectionMetadata: collectionMetadata,
  };
}

/**
 * Transform Algolia search hit to internal asset format
 * @param {Object} hit - Search hit from Algolia response
 * @returns {Object} Internal asset format with full metadata
 */
function transformSearchHitToAsset(hit) {
  // Extract the most useful fields from the search hit
  // Algolia returns full asset metadata with hyphenated field names (dc-title, repo-name, etc.)
  // The 'assetId' field contains the clean asset ID (urn:aaid:aem:xxx)
  // while 'objectID' includes repository ID suffix (_urn:rid:aem:xxx)
  return {
    assetId: hit.assetId || hit['repo-assetId'] || hit.objectID,
    id: hit.assetId || hit['repo-assetId'] || hit.objectID,
    name: hit['dc-title'] || hit['repo-name'] || 'Untitled Asset',
    title: hit['dc-title'] || hit['repo-name'] || 'Untitled Asset',
    type: hit['dc-format'] || 'asset',
    repositoryId: hit['repo-repositoryId'],
    repoName: hit['repo-name'],
    // Metadata fields that are useful for search and display
    format: hit['dc-format'],
    assetType: hit['tccc-assetType'],
    brand: hit['tccc-brand']?.TCCC?.['#values'],
    campaign: hit['tccc-campaignName'],
    intendedChannel: hit['tccc-intendedChannel'],
    marketCovered: hit['tccc-marketCovered'],
    // Keep original search hit data for reference
    _searchHit: hit, // Don't remove this, used in the AssetDetails component to populate the asset
  };
}

export default async function decorate(block) {
  // Get collection ID from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const collectionId = urlParams.get('id');

  if (!collectionId) {
    displayErrorMessage(block, 'No collection ID provided');
    return;
  }

  // Load user if not already available
  if (!window.user) {
    // eslint-disable-next-line no-console
    console.log('🔄 [Collections Client Details] Loading user data...');
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
    console.log('🔧 [Collections Client Details] Initialized with:', {
      hasAccessToken: Boolean(accessToken),
      isCookieAuth: isCookieAuth(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize Collections client:', error);
    displayErrorMessage(block, 'Failed to initialize collections service');
    return;
  }

  // Load collection data from API
  try {
    await loadCollectionFromAPI(collectionId);
    if (!currentCollection) {
      displayErrorMessage(block, 'Collection not found');
      return;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load collection:', error);
    displayErrorMessage(block, 'Failed to load collection');
    return;
  }

  // Clear existing content
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'collection-details-container';

  // Create header section with title and search
  const header = document.createElement('div');
  header.className = 'collection-details-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const title = document.createElement('h1');
  title.className = 'collection-details-title';
  title.textContent = 'Collection Details';

  // Create search section
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

  // Create controls row with collection name and counts
  const controlsRow = document.createElement('div');
  controlsRow.className = 'collection-details-controls';

  const collectionInfo = document.createElement('div');
  collectionInfo.className = 'collection-info';

  const collectionName = document.createElement('p');
  collectionName.className = 'collection-name-display';
  collectionName.textContent = currentCollection.name;

  // Add description
  const descText = document.createElement('div');
  descText.className = 'collection-description-display';
  if (currentCollection.description && currentCollection.description.trim()) {
    descText.textContent = currentCollection.description;
  } else {
    descText.textContent = 'No description';
    descText.style.color = '#999';
    descText.style.fontStyle = 'italic';
  }

  // Add date
  const dateText = document.createElement('div');
  dateText.className = 'collection-date-display';
  const date = new Date(currentCollection.lastUpdated);
  dateText.textContent = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const showingText = document.createElement('div');
  showingText.className = 'showing-text';
  const totalCount = currentCollection.contents ? currentCollection.contents.length : 0;
  showingText.textContent = `Displayed ${totalCount} Total ${totalCount}`;

  collectionInfo.appendChild(collectionName);
  collectionInfo.appendChild(descText);
  collectionInfo.appendChild(dateText);
  collectionInfo.appendChild(showingText);

  controlsRow.appendChild(collectionInfo);

  // Create content area with asset cards
  const contentArea = document.createElement('div');
  contentArea.className = 'collection-content';

  if (totalCount === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'collection-empty';
    emptyState.textContent = 'This collection is empty.';
    contentArea.appendChild(emptyState);
  } else {
    // Create grid container for asset cards
    const assetsGrid = document.createElement('div');
    assetsGrid.className = 'assets-grid';

    // Display collection contents as asset cards
    currentCollection.contents.forEach((asset) => {
      const assetCard = createAssetCard(asset, currentCollection.id);
      assetsGrid.appendChild(assetCard);
    });

    contentArea.appendChild(assetsGrid);
  }

  // Assemble the component
  container.appendChild(header);
  container.appendChild(controlsRow);
  container.appendChild(contentArea);

  block.appendChild(container);

  // Ensure remove-asset modal is available
  const existingRemoveModal = document.querySelector('.remove-asset-modal');
  if (!existingRemoveModal) {
    container.appendChild(createRemoveAssetModal());
  }
}

// Collection loading now handled by SDK

// Current search state
// eslint-disable-next-line no-unused-vars
let currentSearchTerm = '';

function handleSearch() {
  const searchInput = document.querySelector('.search-input');
  const searchTerm = searchInput ? searchInput.value.trim() : '';
  currentSearchTerm = searchTerm.toLowerCase();
  const grid = document.querySelector('.assets-grid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.asset-card'));
  const totalCount = cards.length;
  let visibleCount = 0;

  if (!currentSearchTerm) {
    cards.forEach((card) => {
      card.style.display = '';
    });
    visibleCount = totalCount;
  } else {
    cards.forEach((card) => {
      const text = (card && card.dataset && card.dataset.searchtext) ? card.dataset.searchtext : '';
      const match = text.includes(currentSearchTerm);
      card.style.display = match ? '' : 'none';
      if (match) visibleCount += 1;
    });
  }

  const showingText = document.querySelector('.showing-text');
  if (showingText) {
    showingText.textContent = `Displayed ${visibleCount} Total ${totalCount}`;
  }

  // Empty state for zero matches
  const contentArea = document.querySelector('.collection-content');
  if (contentArea) {
    let emptyEl = contentArea.querySelector('.collection-empty-search');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'collection-empty collection-empty-search';
      emptyEl.style.display = 'none';
      contentArea.appendChild(emptyEl);
    }
    if (visibleCount === 0 && currentSearchTerm) {
      emptyEl.innerHTML = `
        <p>No assets found matching "${searchTerm}".</p>
        <p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">
          Try different search terms or <button onclick="window.clearDetailsSearch && window.clearDetailsSearch()" style="background: none; border: none; color: #e60012; text-decoration: underline; cursor: pointer;">clear search</button> to see all items.
        </p>
      `;
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
    }
  }
}

/**
 * Build asset image URL for Dynamic Media
 * @param {Object} asset - Asset object
 * @param {string} format - Image format (webp, jpg, etc.)
 * @param {number} width - Image width
 * @returns {string} Formatted image URL
 */
function buildAssetImageUrl(asset, format = 'jpg', width = 350) {
  if (!asset || !asset.assetId) return '';

  // Get asset name and remove file extension
  const assetName = asset.name || asset.title || 'thumbnail';
  const fileName = encodeURIComponent(assetName.replace(/\.[^/.]+$/, ''));

  return `/api/adobe/assets/${asset.assetId}/as/${fileName}.${format}?width=${width}`;
}

/**
 * Create picture element with WebP and JPG sources
 * @param {Object} asset - Asset object
 * @param {number} width - Image width
 * @returns {HTMLElement} Picture element
 */
function createPictureElement(asset, width = 350) {
  const picture = document.createElement('picture');

  // WebP source
  const webpSource = document.createElement('source');
  webpSource.type = 'image/webp';
  webpSource.srcset = buildAssetImageUrl(asset, 'webp', width);
  picture.appendChild(webpSource);

  // JPG source
  const jpgSource = document.createElement('source');
  jpgSource.type = 'image/jpg';
  jpgSource.srcset = buildAssetImageUrl(asset, 'jpg', width);
  picture.appendChild(jpgSource);

  // Fallback img
  const img = document.createElement('img');
  img.className = 'asset-image';
  img.alt = asset.title || asset.name || 'Asset image';
  img.loading = 'eager';
  img.src = buildAssetImageUrl(asset, 'jpg', width);
  img.onerror = () => {
    // eslint-disable-next-line no-console
    console.error('[Collections] preview failed to load', {
      assetId: asset.assetId || asset.id,
      title: asset.title || asset.name,
    });
    const placeholder = document.createElement('div');
    placeholder.className = 'asset-image-placeholder';
    placeholder.textContent = 'Preview not available';
    if (picture.parentElement) {
      picture.parentElement.replaceChildren(placeholder);
    }
  };
  picture.appendChild(img);

  return picture;
}

function createAssetCard(asset, collectionId) {
  const card = document.createElement('div');
  card.className = 'asset-card';

  // Image area
  const imageArea = document.createElement('div');
  imageArea.className = 'asset-image-area';
  imageArea.style.cursor = 'pointer'; // Make it clear the image is clickable

  // Create picture element with WebP and JPG sources (like search does)
  if (asset.assetId) {
    const pictureEl = createPictureElement(asset, 350);
    imageArea.appendChild(pictureEl);
  } else {
    // eslint-disable-next-line no-console
    console.warn('[Collections] no assetId found for asset', {
      assetId: asset.assetId || asset.id,
      title: asset.title || asset.name,
    });
    const placeholder = document.createElement('div');
    placeholder.className = 'asset-image-placeholder';
    placeholder.textContent = 'Preview not available';
    imageArea.appendChild(placeholder);
  }

  // Add click event to imageArea to trigger details view
  imageArea.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (window.openDetailsView) {
      window.openDetailsView(asset, true);
    }
  });

  // Info area
  const infoArea = document.createElement('div');
  infoArea.className = 'asset-info-area';

  const assetTitle = document.createElement('p');
  assetTitle.className = 'asset-title';
  assetTitle.textContent = asset.title || asset.name || 'Untitled Asset';

  infoArea.appendChild(assetTitle);

  // Action area
  const actionArea = document.createElement('div');
  actionArea.className = 'asset-action-area';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'asset-action-btn remove-btn';
  // Icon provided via CSS background
  removeBtn.innerHTML = '';
  removeBtn.title = 'Remove from Collection';
  removeBtn.setAttribute('aria-label', 'Remove from Collection');
  removeBtn.onclick = () => handleRemoveFromCollection(asset, collectionId);

  const addToCartBtn = document.createElement('button');
  addToCartBtn.className = 'asset-action-btn add-to-cart-btn';
  // Initialize button state based on cart
  const inCartInit = isAssetInCart(asset);
  addToCartBtn.textContent = inCartInit ? 'Remove From Cart' : 'Add To Cart';
  if (inCartInit) addToCartBtn.classList.add('remove-from-cart');
  addToCartBtn.onclick = () => handleToggleCart(asset, addToCartBtn);

  actionArea.appendChild(removeBtn);
  actionArea.appendChild(addToCartBtn);

  // Assemble the card
  card.appendChild(imageArea);
  card.appendChild(infoArea);
  card.appendChild(actionArea);

  // Make card searchable - now with more metadata fields
  try {
    const searchable = [
      asset && (asset.title || asset.name),
      asset && asset.repoName,
      asset && (asset.assetId || asset.id),
      asset && asset.campaign,
      asset && asset.assetType,
      asset && (Array.isArray(asset.brand) ? asset.brand.join(' ') : asset.brand),
      asset && (Array.isArray(asset.intendedChannel) ? asset.intendedChannel.join(' ') : asset.intendedChannel),
      asset && (Array.isArray(asset.marketCovered) ? asset.marketCovered.join(' ') : asset.marketCovered),
    ].filter(Boolean).join(' ').toLowerCase();
    card.dataset.searchtext = searchable;
  } catch (_e) {
    card.dataset.searchtext = '';
  }

  return card;
}

// Expose a clear search helper for the inline button
function clearDetailsSearch() {
  const input = document.querySelector('.search-input');
  if (input) input.value = '';
  handleSearch();
}

try { window.clearDetailsSearch = clearDetailsSearch; } catch (_) { /* no-op */ }

let pendingRemove = { asset: null, collectionId: null };

function showRemoveAssetModal(asset, collectionId) {
  pendingRemove = { asset, collectionId };
  const modal = document.querySelector('.remove-asset-modal');
  if (modal) modal.style.display = 'flex';
}

function hideRemoveAssetModal() {
  const modal = document.querySelector('.remove-asset-modal');
  if (modal) modal.style.display = 'none';
  pendingRemove = { asset: null, collectionId: null };
}

async function confirmRemoveAsset() {
  const { asset, collectionId } = pendingRemove;
  if (!asset || !collectionId) return;

  if (!collectionsClient) {
    showToast('Collections service not available', 'error');
    return;
  }

  try {
    // Prepare remove operation data for API (API expects array format)
    const removeData = [{
      op: 'remove',
      id: asset.assetId || asset.id,
      type: 'asset',
    }];

    // eslint-disable-next-line no-console
    console.log('🗑️ [Remove Asset] Removing asset from collection:', { collectionId, asset: asset.assetId || asset.id });

    // Remove asset from collection via API
    await collectionsClient.updateCollectionItems(collectionId, removeData);

    // Hide modal first
    hideRemoveAssetModal();

    // Show success message
    showToast('ASSET REMOVED FROM COLLECTION SUCCESSFULLY', 'success');

    // Reload the page to show updated collection
    setTimeout(() => window.location.reload(), 800);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to remove asset from collection:', error);

    // Hide modal even on error
    hideRemoveAssetModal();

    showToast(`Failed to remove asset: ${error.message}`, 'error');
  }
}

function handleRemoveFromCollection(asset, collectionId) {
  showRemoveAssetModal(asset, collectionId);
}

function createRemoveAssetModal() {
  const modal = document.createElement('div');
  modal.className = 'remove-asset-modal';
  modal.style.display = 'none';

  const modalContent = document.createElement('div');
  modalContent.className = 'remove-asset-modal-content';

  const header = document.createElement('div');
  header.className = 'remove-asset-modal-header';
  const title = document.createElement('h2');
  title.className = 'remove-asset-modal-title';
  title.textContent = 'Remove Asset From Collection';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'remove-asset-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = hideRemoveAssetModal;
  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'remove-asset-modal-body';
  body.textContent = 'Do you want to remove this asset from the collection?';

  const footer = document.createElement('div');
  footer.className = 'remove-asset-modal-footer';
  const noBtn = document.createElement('button');
  noBtn.className = 'btn-cancel-outline';
  noBtn.textContent = 'No';
  noBtn.onclick = hideRemoveAssetModal;
  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn-primary-yes';
  yesBtn.textContent = 'Yes';
  yesBtn.onclick = confirmRemoveAsset;
  footer.appendChild(noBtn);
  footer.appendChild(yesBtn);

  modalContent.appendChild(header);
  modalContent.appendChild(body);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);

  // close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideRemoveAssetModal();
  });

  return modal;
}

function handleAddToCart(asset) {
  try {
    // Broadcast event so React app (if present) can handle adding to its cart
    const event = new CustomEvent('addToCart', { detail: { asset } });
    window.dispatchEvent(event);
  } catch (e) {
    // ignore
  }

  try {
    const stored = JSON.parse(localStorage.getItem('cartAssetItems') || '[]');
    const exists = stored.some((item) => item.assetId === (asset.assetId || asset.id));
    if (!exists) {
      // eslint-disable-next-line no-underscore-dangle
      const transformedAsset = populateAssetFromHit(asset._searchHit || {});
      stored.push(transformedAsset);
      saveCartItems(stored);
    }
    showToast('ASSET ADDED TO CART', 'success');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to add to cart from collection details:', e);
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

function isAssetInCart(asset) {
  try {
    const stored = JSON.parse(localStorage.getItem('cartAssetItems') || '[]');
    return stored.some((item) => item.assetId === (asset.assetId || asset.id));
  } catch {
    return false;
  }
}

function handleToggleCart(asset, buttonEl) {
  const inCart = isAssetInCart(asset);
  if (inCart) {
    // Remove from cart
    try {
      const stored = JSON.parse(localStorage.getItem('cartAssetItems') || '[]');
      const next = stored.filter((item) => item.assetId !== (asset.assetId || asset.id));
      saveCartItems(next);
    } catch (err) {
      // ignore JSON errors
    }
    try { showToast('ASSET REMOVED FROM CART', 'success'); } catch (_) { /* no-op */ }
    buttonEl.textContent = 'Add To Cart';
    buttonEl.classList.remove('remove-from-cart');
    window.dispatchEvent(new CustomEvent('removeFromCart', { detail: { asset } }));
  } else {
    handleAddToCart(asset);
    buttonEl.textContent = 'Remove From Cart';
    buttonEl.classList.add('remove-from-cart');
  }
}

function displayErrorMessage(block, message) {
  // Clear existing content
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'collection-details-container';

  // Create header section with title
  const header = document.createElement('div');
  header.className = 'collection-details-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const title = document.createElement('h1');
  title.className = 'collection-details-title';
  title.textContent = 'Collection Details';

  titleRow.appendChild(title);
  header.appendChild(titleRow);

  // Create error message area
  const errorArea = document.createElement('div');
  errorArea.className = 'collection-content';

  const errorMessage = document.createElement('div');
  errorMessage.className = 'collection-empty';
  errorMessage.style.color = '#e60012';
  errorMessage.style.fontWeight = '500';
  errorMessage.textContent = message;

  const backLink = document.createElement('div');
  backLink.style.marginTop = '1rem';
  backLink.innerHTML = `
    <a href="/my-collections" style="color: #e60012; text-decoration: none; font-weight: 500;">
      ← Back to My Collections
    </a>
  `;

  errorArea.appendChild(errorMessage);
  errorArea.appendChild(backLink);

  // Assemble the component
  container.appendChild(header);
  container.appendChild(errorArea);

  block.appendChild(container);
}
