/**
 * Modal management for saved searches
 */

import {
  updateSavedSearch, deleteSavedSearch, showToast, updateSearchLastUsed,
} from './saved-search-helpers.js';

// Modal state
let editingSearch = null;
let deleteSearchId = null;
let deleteSearchName = '';
let onModalUpdate = null; // Callback for when modals make changes

/**
 * Initialize modal callbacks
 * @param {Function} updateCallback - Callback to refresh display
 */
export function initModals(updateCallback) {
  onModalUpdate = updateCallback;
}

/**
 * Create edit modal
 * @returns {HTMLElement} Modal element
 */
export function createEditModal() {
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
  modalTitle.textContent = 'Edit Saved Search';

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
  nameLabel.textContent = 'Search Name';
  nameLabel.className = 'form-label';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'edit-search-name';
  nameInput.className = 'form-input';
  nameInput.required = true;

  modalBody.appendChild(nameLabel);
  modalBody.appendChild(nameInput);

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
  updateBtn.onclick = handleUpdateSearch;

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(updateBtn);

  modalContent.appendChild(modalHeader);
  modalContent.appendChild(modalBody);
  modalContent.appendChild(modalFooter);
  modal.appendChild(modalContent);

  return modal;
}

/**
 * Create delete modal
 * @returns {HTMLElement} Modal element
 */
export function createDeleteModal() {
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
  modalTitle.textContent = 'Delete Saved Search';

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
  warningText.textContent = 'Are you sure you want to delete this saved search?';

  const searchNameText = document.createElement('p');
  searchNameText.style.fontWeight = 'bold';
  searchNameText.style.color = '#e60012';
  searchNameText.id = 'delete-search-name';

  const cautionText = document.createElement('p');
  cautionText.style.fontSize = '0.9rem';
  cautionText.style.color = '#666';
  cautionText.style.marginTop = '1rem';
  cautionText.textContent = 'This action cannot be undone.';

  modalBody.appendChild(warningText);
  modalBody.appendChild(searchNameText);
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

/**
 * Show edit modal
 * @param {Object} search - Search object to edit
 */
export function showEditModal(search) {
  // Update last used when user interacts with search
  updateSearchLastUsed(search.id);

  editingSearch = { ...search };
  const modal = document.querySelector('.edit-modal');
  const nameInput = document.getElementById('edit-search-name');

  if (nameInput && editingSearch) {
    nameInput.value = editingSearch.name;
  }

  modal.style.display = 'flex';
  if (nameInput) nameInput.focus();

  // Refresh display to show updated sort order
  if (onModalUpdate) onModalUpdate();
}

/**
 * Hide edit modal
 */
function hideEditModal() {
  const modal = document.querySelector('.edit-modal');
  modal.style.display = 'none';
  editingSearch = null;

  // Clear form
  const nameInput = document.getElementById('edit-search-name');
  if (nameInput) nameInput.value = '';
}

/**
 * Handle update search
 */
function handleUpdateSearch() {
  if (!editingSearch) return;

  const nameInput = document.getElementById('edit-search-name');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Search name is required', 'info');
    if (nameInput) nameInput.focus();
    return;
  }

  // Update the search
  updateSavedSearch(editingSearch.id, {
    name,
    dateLastUsed: Date.now(),
  });

  // Hide modal and show success
  hideEditModal();
  showToast('SAVED SEARCH UPDATED SUCCESSFULLY', 'success');

  // Notify main component to refresh
  if (onModalUpdate) {
    onModalUpdate(true); // true = clear search
  }
}

/**
 * Show delete modal
 * @param {string} searchId - ID of search to delete
 * @param {string} searchName - Name of search to delete
 */
export function showDeleteModal(searchId, searchName) {
  // Update last used when user interacts with search
  updateSearchLastUsed(searchId);

  deleteSearchId = searchId;
  deleteSearchName = searchName;

  const modal = document.querySelector('.delete-modal');
  const nameElement = document.getElementById('delete-search-name');
  if (nameElement) {
    nameElement.textContent = deleteSearchName;
  }
  modal.style.display = 'flex';

  // Refresh display to show updated sort order
  if (onModalUpdate) onModalUpdate();
}

/**
 * Hide delete modal
 */
function hideDeleteModal() {
  const modal = document.querySelector('.delete-modal');
  modal.style.display = 'none';
  deleteSearchId = null;
  deleteSearchName = '';
}

/**
 * Handle confirm delete
 */
function handleConfirmDelete() {
  if (!deleteSearchId) return;

  // Delete the search
  deleteSavedSearch(deleteSearchId);

  // Hide modal
  hideDeleteModal();

  // Show success toast
  showToast('SAVED SEARCH DELETED SUCCESSFULLY', 'success');

  // Notify main component to refresh
  if (onModalUpdate) {
    onModalUpdate(true); // true = clear search
  }
}
