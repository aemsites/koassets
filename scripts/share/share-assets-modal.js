/**
 * Share Assets Modal functionality
 * Listens for custom events from React components and shows share modal
 */

// Global state
let currentAssets = [];
let shareModal = null;
let emailPreviewModal = null;

// Initialize the modal system
async function initShareAssetsModal() {
  // Listen for the custom event from React components
  window.addEventListener('openShareModal', handleOpenShareModal);

  // Create the modal structure if it doesn't exist
  if (!shareModal) {
    createShareModal();
  }
  if (!emailPreviewModal) {
    createEmailPreviewModal();
  }
}

// Handle the custom event from React components
function handleOpenShareModal(event) {
  const { asset, assets } = event.detail || {};
  if (Array.isArray(assets)) {
    currentAssets = assets.slice();
  } else if (asset) {
    currentAssets = [asset];
  } else {
    currentAssets = [];
  }

  // eslint-disable-next-line no-console
  console.log('[Share] Opening share modal with assets:', currentAssets);
  showShareModal();
}

// Create the modal HTML structure
function createShareModal() {
  shareModal = document.createElement('div');
  shareModal.className = 'share-assets-modal';
  shareModal.style.display = 'none';

  shareModal.innerHTML = `
    <div class="share-assets-modal-content">
      <div class="share-assets-modal-header">
        <div class="share-assets-modal-title">Share Assets</div>
        <button class="share-assets-modal-close">&times;</button>
      </div>
      
      <div class="share-assets-modal-body">
        <div class="share-modal-columns">
          <!-- Left Column: Selected Assets -->
          <div class="share-assets-column">
            <div class="share-column-header">Selected Assets</div>
            <div class="share-assets-list">
              <!-- Assets will be populated here -->
            </div>
          </div>
          
          <!-- Right Column: Share Options -->
          <div class="share-options-column">
            <div class="share-column-header">Share Options</div>
            <div class="share-form">
              <div class="form-group">
                <label for="share-email">Email Address</label>
                <input 
                  type="email" 
                  id="share-email" 
                  class="form-input"
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div class="form-group">
                <label for="share-message">Message (optional)</label>
                <textarea 
                  id="share-message" 
                  class="form-input form-textarea"
                  placeholder="Add a message..."
                  rows="4"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="share-assets-modal-footer">
        <button class="btn-cancel">Cancel</button>
        <button class="btn-share">Share</button>
      </div>
    </div>
  `;

  // Add event listeners
  const closeBtn = shareModal.querySelector('.share-assets-modal-close');
  const cancelBtn = shareModal.querySelector('.btn-cancel');
  const shareBtn = shareModal.querySelector('.btn-share');

  closeBtn.onclick = hideShareModal;
  cancelBtn.onclick = hideShareModal;
  shareBtn.onclick = handleShareAssets;

  // Close modal when clicking outside
  shareModal.onclick = (e) => {
    if (e.target === shareModal) {
      hideShareModal();
    }
  };

  // Append to body
  document.body.appendChild(shareModal);
}

// Show the modal and populate with current assets
function showShareModal() {
  if (!currentAssets || currentAssets.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('[Share] No assets to share');
    return;
  }

  // Populate the assets list
  populateAssetsList();

  // Clear previous form inputs
  const emailInput = shareModal.querySelector('#share-email');
  const messageInput = shareModal.querySelector('#share-message');
  if (emailInput) emailInput.value = '';
  if (messageInput) messageInput.value = '';

  // Show modal
  shareModal.style.display = 'flex';
}

// Hide the modal
function hideShareModal() {
  shareModal.style.display = 'none';
  // Don't clear currentAssets here - we need them for the email preview modal
}

// Populate the assets list in the left column
function populateAssetsList() {
  const assetsContainer = shareModal.querySelector('.share-assets-list');
  if (!assetsContainer) return;

  // Clear existing content
  assetsContainer.innerHTML = '';

  // Create item for each asset
  currentAssets.forEach((asset) => {
    const assetItem = document.createElement('div');
    assetItem.className = 'share-asset-item';

    // Asset preview image
    const assetPreview = document.createElement('div');
    assetPreview.className = 'share-asset-preview';

    // Try to get preview URL
    const previewUrl = asset.previewUrl || asset.thumbnailUrl || '';
    if (previewUrl) {
      const img = document.createElement('img');
      img.src = previewUrl;
      img.alt = asset.name || 'Asset';
      assetPreview.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'asset-placeholder';
      assetPreview.appendChild(placeholder);
    }

    // Asset info
    const assetInfo = document.createElement('div');
    assetInfo.className = 'share-asset-info';

    const assetName = document.createElement('div');
    assetName.className = 'share-asset-name';
    assetName.textContent = asset.name || asset.assetId || 'Untitled Asset';
    assetName.title = asset.name || asset.assetId || 'Untitled Asset';

    assetInfo.appendChild(assetName);

    assetItem.appendChild(assetPreview);
    assetItem.appendChild(assetInfo);
    assetsContainer.appendChild(assetItem);
  });
}

// Generate asset link (placeholder - adjust based on your actual URL structure)
function getAssetLink(asset) {
  const baseUrl = window.location.origin;
  const assetId = asset.assetId || asset.id;
  // Adjust this URL pattern based on your actual asset detail page structure
  return `${baseUrl}/asset-details?id=${encodeURIComponent(assetId)}`;
}

// Handle share action
function handleShareAssets() {
  const emailInput = shareModal.querySelector('#share-email');
  const messageInput = shareModal.querySelector('#share-message');

  const email = emailInput?.value.trim() || '';
  const message = messageInput?.value.trim() || '';

  // Validate email
  if (!email) {
    showToast('Please enter an email address', 'error');
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('Please enter a valid email address', 'error');
    return;
  }

  // Log the share action
  // eslint-disable-next-line no-console
  console.log('[Share] Share action triggered:', {
    email,
    message,
    assets: currentAssets.map((asset) => ({
      id: asset.assetId || asset.id,
      name: asset.name,
    })),
    assetCount: currentAssets.length,
  });

  // Hide share modal and show email preview modal
  hideShareModal();
  showEmailPreviewModal(email, message);
}

// Create email preview modal
function createEmailPreviewModal() {
  emailPreviewModal = document.createElement('div');
  emailPreviewModal.className = 'email-preview-modal';
  emailPreviewModal.style.display = 'none';

  emailPreviewModal.innerHTML = `
    <div class="email-preview-modal-content">
      <div class="email-preview-modal-header">
        <div class="email-preview-modal-title">Email Content</div>
        <button class="email-preview-modal-close">&times;</button>
      </div>
      
      <div class="email-preview-modal-body">
        <div class="email-section">
          <div class="email-section-header">
            <span class="email-section-label">Subject:</span>
            <button class="btn-copy-subject">Copy to Clipboard</button>
          </div>
          <div class="email-content-box" id="email-subject-content">
            Check out these assets!
          </div>
        </div>

        <div class="email-section">
          <div class="email-section-header">
            <span class="email-section-label">Body:</span>
            <button class="btn-copy-body">Copy to Clipboard</button>
          </div>
          <div class="email-content-box email-body-content" id="email-body-content">
            <!-- Body content will be populated here -->
          </div>
        </div>
      </div>
      
      <div class="email-preview-modal-footer">
        <button class="btn-close-preview">Close</button>
      </div>
    </div>
  `;

  // Add event listeners
  const closeBtn = emailPreviewModal.querySelector('.email-preview-modal-close');
  const closeFooterBtn = emailPreviewModal.querySelector('.btn-close-preview');
  const copySubjectBtn = emailPreviewModal.querySelector('.btn-copy-subject');
  const copyBodyBtn = emailPreviewModal.querySelector('.btn-copy-body');

  closeBtn.onclick = hideEmailPreviewModal;
  closeFooterBtn.onclick = hideEmailPreviewModal;
  copySubjectBtn.onclick = copySubjectToClipboard;
  copyBodyBtn.onclick = copyBodyToClipboard;

  // Close modal when clicking outside
  emailPreviewModal.onclick = (e) => {
    if (e.target === emailPreviewModal) {
      hideEmailPreviewModal();
    }
  };

  // Append to body
  document.body.appendChild(emailPreviewModal);
}

// Show email preview modal with content
function showEmailPreviewModal(email, userMessage) {
  // eslint-disable-next-line no-console
  console.log('[Share] Generating email for assets:', currentAssets);

  // Generate email body
  let bodyText = 'Hi,\n\nI\'ve shared some assets with you.\n';

  if (userMessage) {
    bodyText += `\n${userMessage}\n`;
  }

  bodyText += '\nClick the links below to view the shared assets:\n\n';

  // Add asset links as HTML hyperlinks
  if (currentAssets && currentAssets.length > 0) {
    currentAssets.forEach((asset) => {
      const assetName = asset.name || asset.assetId || asset.id || 'Asset';
      const assetLink = getAssetLink(asset);
      // eslint-disable-next-line no-console
      console.log('[Share] Asset:', assetName, 'Link:', assetLink);
      // Format as HTML link for email clients
      bodyText += `<a href="${assetLink}">${assetName}</a>\n`;
    });
  } else {
    // eslint-disable-next-line no-console
    console.warn('[Share] No assets found in currentAssets array');
  }

  bodyText += '\nThanks!';

  // eslint-disable-next-line no-console
  console.log('[Share] Final email body:', bodyText);

  // Update body content
  const bodyContent = emailPreviewModal.querySelector('#email-body-content');
  bodyContent.textContent = bodyText;

  // Store content for copying
  emailPreviewModal.dataset.subject = 'Check out these assets!';
  emailPreviewModal.dataset.body = bodyText;

  // Show modal
  emailPreviewModal.style.display = 'flex';
}

// Hide email preview modal
function hideEmailPreviewModal() {
  emailPreviewModal.style.display = 'none';
  // Clear the assets array now that we're done with the share flow
  currentAssets = [];
}

// Copy subject to clipboard
function copySubjectToClipboard() {
  const { subject } = emailPreviewModal.dataset;
  navigator.clipboard.writeText(subject).then(() => {
    showToast('Subject copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy subject', 'error');
  });
}

// Copy body to clipboard
function copyBodyToClipboard() {
  const { body } = emailPreviewModal.dataset;
  navigator.clipboard.writeText(body).then(() => {
    showToast('Body copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy body', 'error');
  });
}

// Toast notification function
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
document.addEventListener('DOMContentLoaded', initShareAssetsModal);

// Export for module usage
export { initShareAssetsModal, handleOpenShareModal };
