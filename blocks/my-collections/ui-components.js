/**
 * Reusable UI components for My Collections
 * Handles rendering of collection lists, rows, and common UI elements
 */

import { hasCollectionAccess } from '../../scripts/collections/collections-auth.js';
import { ACL_FIELDS, getUserRole, getCollectionACL } from './collection-helpers.js';

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast ('success', 'error', 'info')
 */
export function showToast(message, type = 'success') {
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

/**
 * Resolve URL value from various formats
 * @param {*} value - Value that might contain a URL
 * @returns {string} URL string or empty string
 */
function resolveUrlValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.url === 'string') return value.url;
    if (typeof value.src === 'string') return value.src;
  }
  return '';
}

/**
 * Resolve preview URL from asset object
 * @param {Object} asset - Asset object
 * @returns {string} Preview URL or empty string
 */
function resolvePreviewUrlFromAsset(asset) {
  return (
    resolveUrlValue(asset && asset.previewUrl)
    || resolveUrlValue(asset && asset.thumbnail)
    || resolveUrlValue(asset && asset.imageUrl)
    || resolveUrlValue(asset && asset.url)
    || ''
  );
}

/**
 * Create a role group section (Owner/Editors/Viewers) for access display
 * @param {string} label - Display label for the role group (e.g., "Editors (3)")
 * @param {Array<string>} users - Array of user email addresses
 * @param {string} role - Role type ('owner', 'editor', or 'viewer')
 * @param {string} collectionId - Collection ID for remove action
 * @param {string} collectionName - Collection name for remove confirmation
 * @param {boolean} canRemove - Whether to show remove buttons for users (default: false)
 * @param {Function} onRemoveClick - Callback when remove button is clicked
 * @returns {HTMLElement} DOM element containing the role group
 */
export function createAccessRoleGroup(
  label,
  users,
  role,
  collectionId,
  collectionName,
  canRemove = false,
  onRemoveClick = null,
) {
  const group = document.createElement('div');
  group.className = 'access-role-group';

  const roleLabel = document.createElement('div');
  roleLabel.className = 'access-role-label';
  roleLabel.textContent = label;

  const userList = document.createElement('ul');
  userList.className = 'access-user-list';

  users.forEach((email) => {
    const userItem = document.createElement('li');
    userItem.className = 'access-user-item';

    const emailSpan = document.createElement('span');
    emailSpan.className = 'access-user-email';
    emailSpan.textContent = email;
    userItem.appendChild(emailSpan);

    // Add remove button if allowed (not for owner)
    if (canRemove && onRemoveClick) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'access-user-remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.title = 'Remove user';
      removeBtn.setAttribute('aria-label', `Remove ${email}`);
      removeBtn.onclick = () => {
        onRemoveClick(email, role, collectionId, collectionName);
      };
      userItem.appendChild(removeBtn);
    }

    userList.appendChild(userItem);
  });

  group.appendChild(roleLabel);
  group.appendChild(userList);

  return group;
}

/**
 * Create a single collection row
 * @param {Object} collection - Collection object
 * @param {Object} handlers - Event handlers {onView, onEdit, onDelete, onShare, onViewAccess}
 * @param {Object} currentUser - Current user object
 * @returns {HTMLElement} Collection row element
 */
export function createCollectionRow(collection, handlers, currentUser) {
  const row = document.createElement('div');
  row.className = 'collection-row';

  // Preview placeholder
  const previewCell = document.createElement('div');
  previewCell.className = 'row-cell cell-preview';

  const firstAsset = (
    collection
    && Array.isArray(collection.contents)
    && collection.contents.length > 0
  )
    ? collection.contents[0]
    : null;
  const previewSrc = firstAsset ? resolvePreviewUrlFromAsset(firstAsset) : '';

  if (previewSrc) {
    const img = document.createElement('img');
    img.alt = (firstAsset && (firstAsset.title || firstAsset.name)) || 'Collection preview';
    img.src = previewSrc;
    img.loading = 'eager';
    img.className = 'collection-preview-image';
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('[Collections] preview failed to load (list view)', {
        assetId: firstAsset && (firstAsset.assetId || firstAsset.id),
        title: firstAsset && (firstAsset.title || firstAsset.name),
        src: previewSrc,
        collectionId: collection && collection.id,
        collectionName: collection && collection.name,
      });
      const placeholder = document.createElement('div');
      placeholder.className = 'preview-placeholder';
      placeholder.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="6" y="8" width="28" height="24" rx="2" fill="#f0f0f0" stroke="#ddd"/>
          <text x="20" y="22" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">?</text>
        </svg>
      `;
      if (previewCell.isConnected) previewCell.replaceChildren(placeholder);
    };
    previewCell.appendChild(img);
  } else {
    const previewIcon = document.createElement('div');
    previewIcon.className = 'preview-placeholder';
    previewIcon.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="8" width="28" height="24" rx="2" fill="#f0f0f0" stroke="#ddd"/>
        <text x="20" y="22" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">?</text>
      </svg>
    `;
    previewCell.appendChild(previewIcon);
  }

  // Name and date cell
  const nameCell = document.createElement('div');
  nameCell.className = 'row-cell cell-name';

  const nameText = document.createElement('div');
  nameText.className = 'collection-name clickable';
  nameText.textContent = collection.name;
  nameText.style.cursor = 'pointer';
  nameText.onclick = () => handlers.onView(collection);

  const descText = document.createElement('div');
  descText.className = 'collection-description';
  if (collection.description && collection.description.trim()) {
    descText.textContent = collection.description;
  } else {
    descText.textContent = 'No description';
    descText.style.color = '#999';
  }

  const dateText = document.createElement('div');
  dateText.className = 'collection-date';
  const date = new Date(collection.lastUpdated);
  dateText.textContent = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  nameCell.appendChild(nameText);
  nameCell.appendChild(descText);
  nameCell.appendChild(dateText);

  // Action cell
  const actionCell = document.createElement('div');
  actionCell.className = 'row-cell cell-action';

  // Check if user has write access (owner or editor)
  const hasWriteAccess = collection.apiData
    ? hasCollectionAccess(collection.apiData, currentUser, 'write')
    : false;

  // Show action buttons for users with write access (owner or editor)
  if (hasWriteAccess) {
    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn edit-btn';
    editBtn.innerHTML = '';
    editBtn.title = 'Edit Collection';
    editBtn.setAttribute('aria-label', 'Edit Collection');
    editBtn.onclick = () => handlers.onEdit(collection);

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete-btn';
    deleteBtn.innerHTML = '';
    deleteBtn.title = 'Delete Collection';
    deleteBtn.setAttribute('aria-label', 'Delete Collection');
    deleteBtn.onclick = () => handlers.onDelete(collection.id, collection.name);

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn share-btn';
    shareBtn.innerHTML = '';
    shareBtn.title = 'Share Collection';
    shareBtn.setAttribute('aria-label', 'Share Collection');
    shareBtn.onclick = () => handlers.onShare(collection.id);

    actionCell.appendChild(editBtn);
    actionCell.appendChild(deleteBtn);
    actionCell.appendChild(shareBtn);
  } else {
    // Show read-only indicator for viewers
    const readOnlyText = document.createElement('span');
    readOnlyText.className = 'read-only-text';
    readOnlyText.textContent = 'View Only';
    readOnlyText.style.color = '#999';
    readOnlyText.style.fontSize = '0.9rem';
    readOnlyText.style.fontStyle = 'italic';
    actionCell.appendChild(readOnlyText);
  }

  // Access cell (role + share count)
  const accessCell = document.createElement('div');
  accessCell.className = 'row-cell cell-access';

  // Get ACL and determine user's role using helper functions
  const acl = getCollectionACL(collection.apiData);
  const userRole = getUserRole(acl, currentUser);

  // Get editor and viewer lists for share count
  const editors = acl?.[ACL_FIELDS.EDITOR] || [];
  const viewers = acl?.[ACL_FIELDS.VIEWER] || [];

  // Calculate total shared count (exclude the owner from count)
  const sharedCount = editors.length + viewers.length;

  const roleText = document.createElement('div');
  roleText.className = 'access-role-text';
  roleText.textContent = userRole;

  const sharedText = document.createElement('div');
  sharedText.className = 'access-shared-text';
  sharedText.textContent = `Shared: ${sharedCount}`;

  // Make "Shared: X" clickable only if user has write access (owner or editor)
  if (sharedCount > 0 && hasWriteAccess) {
    sharedText.classList.add('clickable');
    sharedText.style.cursor = 'pointer';
    sharedText.style.textDecoration = 'underline';
    sharedText.onclick = (e) => {
      e.stopPropagation();
      handlers.onViewAccess(collection.id, collection.name);
    };
  }

  accessCell.appendChild(roleText);
  accessCell.appendChild(sharedText);

  row.appendChild(previewCell);
  row.appendChild(nameCell);
  row.appendChild(accessCell);
  row.appendChild(actionCell);

  return row;
}

/**
 * Create the collections list with header
 * @param {Array} collections - Array of collection objects
 * @param {Object} handlers - Event handlers for actions
 * @param {Object} currentUser - Current user object
 * @param {string} currentSearchTerm - Current search term (for empty state)
 * @returns {HTMLElement} Collections list element
 */
// Escapes HTML meta-characters in a string (simple XSS prevention)
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createCollectionsList(collections, handlers, currentUser, currentSearchTerm = '') {
  const listContainer = document.createElement('div');
  listContainer.className = 'collections-list';

  if (collections.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'collections-empty';

    if (currentSearchTerm) {
      const safeSearchTerm = escapeHTML(currentSearchTerm);
      emptyState.innerHTML = `<p>No collections found matching "${safeSearchTerm}".</p>`
        + '<p style="font-size: 0.9rem; color: #999; margin-top: 0.5rem;">Try different search terms or <button onclick="clearSearch()" style="background: none; border: none; color: #e60012; text-decoration: underline; cursor: pointer;">clear search</button> to see all collections.</p>';
    } else {
      emptyState.textContent = 'No collections yet. Create your first collection!';
    }

    listContainer.appendChild(emptyState);
    return listContainer;
  }

  // Create table header
  const header = document.createElement('div');
  header.className = 'collections-header';

  const previewHeader = document.createElement('div');
  previewHeader.className = 'header-cell header-preview';
  previewHeader.textContent = 'PREVIEW';

  const nameHeader = document.createElement('div');
  nameHeader.className = 'header-cell header-name';
  nameHeader.textContent = 'NAME';

  const accessHeader = document.createElement('div');
  accessHeader.className = 'header-cell header-access';
  accessHeader.textContent = 'ACCESS';

  const actionHeader = document.createElement('div');
  actionHeader.className = 'header-cell header-action';
  actionHeader.textContent = 'ACTION';

  header.appendChild(previewHeader);
  header.appendChild(nameHeader);
  header.appendChild(accessHeader);
  header.appendChild(actionHeader);

  // Create collections rows
  const rowsContainer = document.createElement('div');
  rowsContainer.className = 'collections-rows';

  collections.forEach((collection) => {
    const row = createCollectionRow(collection, handlers, currentUser);
    rowsContainer.appendChild(row);
  });

  listContainer.appendChild(header);
  listContainer.appendChild(rowsContainer);

  return listContainer;
}
