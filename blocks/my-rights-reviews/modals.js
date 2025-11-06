/**
 * Modals for My Rights Reviews block
 */

import { getAvailableReviewerStatuses } from './config.js';
import showToast from '../../scripts/toast/toast.js';

/**
 * Update review status via API
 */
async function updateReviewStatus(requestId, newStatus) {
  try {
    const response = await fetch('/api/rightsrequests/reviews/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId, status: newStatus }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error updating status:', error);
    throw error;
  }
}

/**
 * Create and show status change modal
 * @param {Object} review - The review object
 * @param {Function} onStatusChanged - Callback function to execute after status is changed
 */
// eslint-disable-next-line import/prefer-default-export
export function showStatusModal(review, onStatusChanged) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'status-modal-overlay';

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'status-modal';

  // Modal header
  const header = document.createElement('div');
  header.className = 'status-modal-header';
  header.innerHTML = `
    <h3>Change Status</h3>
    <button class="status-modal-close" aria-label="Close">&times;</button>
  `;

  // Modal body
  const body = document.createElement('div');
  body.className = 'status-modal-body';

  const requestInfo = document.createElement('p');
  requestInfo.className = 'status-modal-info';
  requestInfo.innerHTML = `<strong>Request:</strong> ${review.rightsRequestDetails?.name || review.rightsRequestID}`;

  const currentStatus = document.createElement('p');
  currentStatus.className = 'status-modal-info';
  currentStatus.innerHTML = `<strong>Current Status:</strong> ${review.rightsRequestReviewDetails?.rightsRequestStatus || 'Not Started'}`;

  const label = document.createElement('label');
  label.className = 'status-modal-label';
  label.textContent = 'Select New Status:';

  const select = document.createElement('select');
  select.className = 'status-modal-select';

  // Get available statuses for reviewer (excluding current status)
  const currentStatusValue = review.rightsRequestReviewDetails?.rightsRequestStatus;
  const availableStatuses = getAvailableReviewerStatuses(currentStatusValue);

  availableStatuses.forEach((status) => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });

  body.appendChild(requestInfo);
  body.appendChild(currentStatus);
  body.appendChild(label);
  body.appendChild(select);

  // Modal footer
  const footer = document.createElement('div');
  footer.className = 'status-modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'status-modal-button cancel-button';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'status-modal-button confirm-button';
  confirmBtn.textContent = 'Confirm';

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);

  // Close modal function
  const closeModal = () => {
    overlay.remove();
  };

  // Event listeners
  const closeButton = header.querySelector('.status-modal-close');
  closeButton.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  confirmBtn.addEventListener('click', async () => {
    const newStatus = select.value;

    try {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Updating...';
      await updateReviewStatus(review.rightsRequestID, newStatus);
      closeModal();
      showToast(`Status updated to "${newStatus}"`, 'success');
      // Call the callback to refresh the reviews list
      if (onStatusChanged) {
        await onStatusChanged();
      }
    } catch (error) {
      showToast(`Failed to update status: ${error.message}`, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm';
    }
  });

  // Add to document
  document.body.appendChild(overlay);
}
