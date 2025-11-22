/**
 * Create a PDF card with thumbnail and preview button
 * @param {string} title - PDF title
 * @param {string} pdfLink - PDF URL
 * @param {string} previewImage - Optional preview image URL
 * @returns {HTMLElement} Card element
 */
function createPdfCard(title, pdfLink, previewImage) {
  const card = document.createElement('div');
  card.className = 'pdf-card';

  // Card inner wrapper
  const cardInner = document.createElement('div');
  cardInner.className = 'pdf-card-inner';

  // Thumbnail area
  const thumbnailArea = document.createElement('div');
  thumbnailArea.className = 'pdf-card-thumbnail';

  // Preview image or PDF icon
  const thumbnail = document.createElement('img');
  if (previewImage) {
    // Use custom preview image
    thumbnail.src = previewImage;
    thumbnail.alt = title;
    thumbnail.className = 'pdf-card-preview-image';
  } else {
    // Use default PDF icon
    thumbnail.src = '/icons/pdf-icon.svg';
    thumbnail.alt = 'PDF Document';
    thumbnail.className = 'pdf-card-icon';
  }
  thumbnailArea.appendChild(thumbnail);

  // Magnifying glass preview button
  const previewButton = document.createElement('button');
  previewButton.className = 'pdf-preview-button';
  previewButton.title = 'View PDF';
  previewButton.setAttribute('aria-label', `View ${title}`);

  const zoomIcon = document.createElement('img');
  zoomIcon.src = '/icons/zoom.svg';
  zoomIcon.alt = 'View PDF';
  previewButton.appendChild(zoomIcon);

  previewButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openPdfModal(title, pdfLink);
  });
  thumbnailArea.appendChild(previewButton);

  // Title area
  const titleArea = document.createElement('div');
  titleArea.className = 'pdf-card-title';

  const titleElement = document.createElement('h3');
  titleElement.textContent = title;
  titleArea.appendChild(titleElement);

  cardInner.appendChild(thumbnailArea);
  cardInner.appendChild(titleArea);
  card.appendChild(cardInner);

  return card;
}

/**
 * Open PDF in modal
 * @param {string} title - PDF title
 * @param {string} pdfLink - PDF URL
 */
// Flag to track if PDF modal just handled escape (prevents React modals from closing)
let pdfModalHandledEscape = false;

// Track fullscreen state
let isInFullscreen = false;

// Listen for fullscreen changes
(function setupFullscreenTracking() {
  const handleFullscreenChange = () => {
    isInFullscreen = !!(
      document.fullscreenElement
      || document.webkitFullscreenElement
      || document.mozFullScreenElement
      || document.msFullscreenElement
    );

    // When exiting fullscreen, refocus to ensure keyboard events work
    if (!isInFullscreen) {
      setTimeout(() => {
        const viewerContainer = document.getElementById('adobe-dc-view-help');
        if (viewerContainer) {
          viewerContainer.focus();
        }
      }, 100);
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
}());

// Global escape key handler that runs at the highest priority
// This is added once when the module loads, not when modal opens
(function setupGlobalEscapeHandler() {
  // Add to window in capture phase for earliest possible interception
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('pdf-viewer-modal');
      if (modal && modal.style.display === 'flex') {
        // If in fullscreen, let the browser handle ESC to exit fullscreen
        // Don't close the modal
        if (isInFullscreen) {
          return true;
        }

        // PDF modal is open and not in fullscreen, intercept the escape key completely
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        pdfModalHandledEscape = true;
        closePdfModal();
        // Clear flag after a brief delay
        setTimeout(() => {
          pdfModalHandledEscape = false;
        }, 100);
        return false;
      }
    }
    return true;
  }, { capture: true, passive: false }); // Capture phase, non-passive to allow preventDefault
}());

// Export function to check if PDF modal is handling escape
export function isPdfModalHandlingEscape() {
  return pdfModalHandledEscape;
}

export async function openPdfModal(title, pdfLink) {
  // Create modal if it doesn't exist
  let modal = document.getElementById('pdf-viewer-modal');
  if (!modal) {
    modal = createPdfModal();
    document.body.appendChild(modal);
  }

  // Update modal content
  const modalBody = modal.querySelector('.pdf-modal-body');

  modalBody.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';

  // Show modal
  modal.style.display = 'flex';

  try {
    // Adobe PDF Embed API Client ID for the worker domain
    const clientId = 'fb94816ccd554baf8d992217035ad8fc';

    // Load Adobe PDF Embed API if not already loaded
    if (!window.AdobeDC) {
      await loadAdobePdfScript();
    }

    // Wait a bit for Adobe DC to fully initialize
    if (!window.AdobeDC) {
      throw new Error('Adobe PDF viewer not available after loading script');
    }

    // Create container for Adobe PDF viewer
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'adobe-dc-view-help';
    viewerContainer.style.width = '100%';
    viewerContainer.style.height = '100%';
    viewerContainer.tabIndex = -1; // Make focusable for keyboard events

    modalBody.innerHTML = '';
    modalBody.appendChild(viewerContainer);

    // Give the DOM a moment to add the container
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    // Initialize Adobe DC View
    const adobeDCView = new window.AdobeDC.View({
      clientId,
      divId: 'adobe-dc-view-help',
    });

    // Render PDF with download and print enabled
    adobeDCView.previewFile(
      {
        content: { location: { url: pdfLink } },
        metaData: { fileName: title || 'document.pdf' },
      },
      {
        embedMode: 'SIZED_CONTAINER',
        showDownloadPDF: true, // Enable download for help pages
        showPrintPDF: true, // Enable print for help pages
        showLeftHandPanel: false,
      },
    );
  } catch (error) {
    // Fallback: show error message
    modalBody.innerHTML = `<p class="pdf-error">Failed to load PDF: ${error.message}</p>`;
  }
}

/**
 * Load Adobe PDF Embed API script
 * @returns {Promise} Promise that resolves when script is loaded
 */
function loadAdobePdfScript() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.AdobeDC) {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="acrobatservices.adobe.com"]');
    if (existingScript) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.AdobeDC) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (!window.AdobeDC) {
          reject(new Error('Timeout waiting for Adobe PDF Embed API'));
        }
      }, 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
    script.async = true;

    script.onload = () => {
      // Wait a bit for AdobeDC to be available
      const checkReady = setInterval(() => {
        if (window.AdobeDC) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        if (window.AdobeDC) {
          resolve();
        } else {
          reject(new Error('Adobe DC not available after script load'));
        }
      }, 5000);
    };

    script.onerror = () => reject(new Error('Failed to load Adobe PDF Embed API'));
    document.body.appendChild(script);
  });
}

/**
 * Create the PDF modal structure
 * @returns {HTMLElement} Modal element
 */
export function createPdfModal() {
  const modal = document.createElement('div');
  modal.id = 'pdf-viewer-modal';
  modal.className = 'pdf-viewer-modal';
  modal.style.display = 'none';

  const modalContent = document.createElement('div');
  modalContent.className = 'pdf-modal-content';

  // Close button (floating style matching asset details)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'pdf-modal-close';
  closeBtn.innerHTML = '✕';
  closeBtn.setAttribute('aria-label', 'Close PDF viewer');
  closeBtn.onclick = closePdfModal;

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'pdf-modal-body';

  modalContent.appendChild(closeBtn);
  modalContent.appendChild(modalBody);
  modal.appendChild(modalContent);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePdfModal();
  });

  // Note: Escape key handler is now added/removed dynamically in openPdfModal/closePdfModal

  return modal;
}

/**
 * Close the PDF modal
 */
export function closePdfModal() {
  const modal = document.getElementById('pdf-viewer-modal');
  if (modal) {
    modal.style.display = 'none';
    // Clean up blob URLs if any
    const iframe = modal.querySelector('iframe');
    if (iframe && iframe.src.startsWith('blob:')) {
      URL.revokeObjectURL(iframe.src);
    }
  }
  // Note: Escape handler is now global and always active, no need to remove
}

export default async function decorate(block) {
  const pdfLinks = [];
  [...block.children].forEach((row) => {
    const divs = row.children;
    if (divs.length >= 2) {
      const pdfData = {
        title: divs[0].textContent.trim(),
        pdfLink: divs[1].textContent.trim(),
      };

      // Check for optional preview image in third column
      if (divs.length >= 3) {
        // Look for img tag in the third column
        const img = divs[2].querySelector('img');
        if (img && img.src) {
          pdfData.previewImage = img.src;
        }
      }

      pdfLinks.push(pdfData);
    }
  });

  block.textContent = '';

  // Create container for cards
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'pdf-cards-container';

  // Create cards for each PDF
  pdfLinks.forEach(({ title, pdfLink, previewImage }) => {
    const card = createPdfCard(title, pdfLink, previewImage);
    cardsContainer.appendChild(card);
  });

  block.appendChild(cardsContainer);
}
