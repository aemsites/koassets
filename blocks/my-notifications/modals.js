/**
 * Modal components for My Messages
 * Handles priority message modal and delete confirmation modal
 */

/**
 * Convert plain text URLs to clickable links
 * @param {string} text - Plain text with URLs
 * @returns {string} HTML string with clickable links
 */
function linkifyText(text) {
  if (!text) return '';

  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Replace URLs with anchor tags
  return text.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

// Modal state management
let deleteModalState = {
  messageId: null,
  subject: '',
};

/**
 * Create delete confirmation modal
 * @param {Function} onConfirm - Callback when delete is confirmed
 * @param {Function} onCancel - Callback when delete is cancelled
 * @returns {HTMLElement} Delete modal element
 */
export function createDeleteModal(onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'delete-notification-modal';
  modal.style.display = 'none';

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.onclick = onCancel;

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  // Modal header
  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';

  const modalTitle = document.createElement('h2');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = 'Delete Notification';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = onCancel;

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
  warningText.textContent = 'Are you sure you want to delete this notification?';

  const subjectText = document.createElement('p');
  subjectText.style.fontWeight = 'bold';
  subjectText.style.color = '#e60012';
  subjectText.id = 'delete-notification-subject';

  const cautionText = document.createElement('p');
  cautionText.style.fontSize = '0.9rem';
  cautionText.style.color = '#666';
  cautionText.style.marginTop = '1rem';
  cautionText.textContent = 'This action cannot be undone.';

  modalBody.appendChild(warningText);
  modalBody.appendChild(subjectText);
  modalBody.appendChild(cautionText);

  // Modal footer
  const modalFooter = document.createElement('div');
  modalFooter.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = onCancel;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn-delete';
  confirmBtn.textContent = 'Delete';
  confirmBtn.onclick = onConfirm;

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(confirmBtn);

  // Assemble modal
  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);

  modal.appendChild(modalOverlay);
  modal.appendChild(modalContent);

  return modal;
}

/**
 * Show delete confirmation modal
 * @param {string} messageId - Message ID to delete
 * @param {string} subject - Message subject
 */
export function showDeleteModal(messageId, subject) {
  deleteModalState = { messageId, subject };

  const modal = document.querySelector('.delete-notification-modal');
  if (modal) {
    const subjectElement = modal.querySelector('#delete-notification-subject');
    if (subjectElement) {
      subjectElement.textContent = subject;
    }
    modal.style.display = 'flex';
  }
}

/**
 * Hide delete confirmation modal
 */
export function hideDeleteModal() {
  const modal = document.querySelector('.delete-notification-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  deleteModalState = { messageId: null, subject: '' };
}

/**
 * Get current delete state
 * @returns {Object} Delete state with messageId and subject
 */
export function getDeleteState() {
  return deleteModalState;
}

/**
 * Create priority message modal
 * @param {Object} message - Priority message object
 * @param {Function} onDismiss - Callback when modal is dismissed
 * @returns {HTMLElement} Priority modal element
 */
export function createPriorityModal(message, onDismiss) {
  const modal = document.createElement('div');
  modal.className = 'priority-notification-modal';
  modal.style.display = 'flex';

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay priority-overlay';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content priority-content';
  modalContent.style.padding = '2rem';

  // Message subject
  const subject = document.createElement('h2');
  subject.className = 'priority-modal-subject';
  subject.textContent = message.subject;

  // Message from
  const from = document.createElement('div');
  from.className = 'priority-modal-from';
  from.textContent = `From: ${message.from}`;

  // Message content
  const content = document.createElement('div');
  content.className = 'priority-modal-content';

  // Convert plain text with URLs to HTML with clickable links
  const linkedText = linkifyText(message.message);
  // Preserve line breaks and convert to <br> tags
  const htmlContent = linkedText.replace(/\n/g, '<br>');
  content.innerHTML = htmlContent;

  // Modal footer
  const footer = document.createElement('div');
  footer.className = 'priority-modal-footer';

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'btn-priority-dismiss';
  dismissBtn.textContent = 'Ok';
  dismissBtn.onclick = () => {
    onDismiss(message.id);
    modal.remove();
  };

  footer.appendChild(dismissBtn);

  // Assemble modal
  modalContent.appendChild(subject);
  modalContent.appendChild(from);
  modalContent.appendChild(content);
  modalContent.appendChild(footer);

  modal.appendChild(modalOverlay);
  modal.appendChild(modalContent);

  return modal;
}

/**
 * Show priority message modal (if any priority messages exist)
 * @param {Array} messages - Array of messages
 * @param {Function} onDismiss - Callback when modal is dismissed
 * @returns {Promise<HTMLElement|null>} Priority modal element or null
 */
export async function showPriorityModal(messages, onDismiss) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  // Import helper to check read status from localStorage for system messages
  const { getPriorityMessages } = await import('../../scripts/notifications/notifications-helpers.js');

  // Get priority messages (filters out read messages, including system messages via localStorage)
  const priorityMessages = getPriorityMessages(messages);

  if (priorityMessages.length === 0) {
    return null;
  }

  const priorityMessage = priorityMessages[0];

  const modal = createPriorityModal(priorityMessage, onDismiss);
  document.body.appendChild(modal);

  return modal;
}
