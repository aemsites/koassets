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

// Global escape key handler that runs at the highest priority
// This is added once when the module loads, not when modal opens
(function setupGlobalEscapeHandler() {
  // Add to window in capture phase for earliest possible interception
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('pdf-viewer-modal');
      if (modal && modal.style.display === 'flex') {
        // PDF modal is open, intercept the escape key completely
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
  const modalTitle = modal.querySelector('.pdf-modal-title');
  const modalBody = modal.querySelector('.pdf-modal-body');

  modalTitle.textContent = title;
  modalBody.innerHTML = '<div class="pdf-loading">Loading PDF...</div>';

  // Show modal
  modal.style.display = 'flex';

  try {
    // Check if server forces download with Content-Disposition header
    const headResponse = await fetch(pdfLink, { method: 'HEAD' });
    const contentDisposition = headResponse.headers.get('Content-Disposition');
    const forceDownload = contentDisposition && contentDisposition.includes('attachment');

    let iframeUrl = pdfLink;

    // If server forces download, fetch as blob and create blob URL
    if (forceDownload) {
      const response = await fetch(pdfLink);
      const blob = await response.blob();
      iframeUrl = URL.createObjectURL(blob);
    }

    // Create iframe with appropriate URL
    const iframe = document.createElement('iframe');
    iframe.src = iframeUrl;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.setAttribute('aria-label', title);
    iframe.style.border = 'none';

    modalBody.innerHTML = '';
    modalBody.appendChild(iframe);
  } catch (error) {
    // Fallback: show error message
    modalBody.innerHTML = `<p class="pdf-error">Failed to load PDF: ${error.message}</p>`;
  }
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

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'pdf-modal-header';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'pdf-modal-title';
  modalTitle.textContent = 'PDF Viewer';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'pdf-modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close PDF viewer');
  closeBtn.onclick = closePdfModal;

  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(closeBtn);

  // Modal body
  const modalBody = document.createElement('div');
  modalBody.className = 'pdf-modal-body';

  modalContent.appendChild(modalHeader);
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
