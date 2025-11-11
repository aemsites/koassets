/**
 * UI Components for My Messages
 * Reusable components for message list, rows, and display elements
 */

import { formatMessageDate, getSystemNotificationsRead, SYSTEM_MESSAGE_OWNER } from '../../scripts/notifications/notifications-helpers.js';
import showToast from '../../scripts/toast/toast.js';

// Export showToast for backwards compatibility
export { showToast };

/**
 * Create table header for messages list
 * @returns {HTMLElement} Table header element
 */
function createMessagesTableHeader() {
  const header = document.createElement('div');
  header.className = 'notifications-table-header';

  const columns = [
    { label: '', className: 'header-status' }, // Status indicator
    { label: '', className: 'header-priority' }, // Priority indicator
    { label: 'DATE', className: 'header-date' },
    { label: 'SUBJECT', className: 'header-subject' },
    { label: 'TYPE', className: 'header-type' },
    { label: 'FROM', className: 'header-from' },
    { label: 'ACTION', className: 'header-action' },
  ];

  columns.forEach((col) => {
    const headerCell = document.createElement('div');
    headerCell.className = `header-cell ${col.className}`;
    headerCell.innerHTML = col.label;
    header.appendChild(headerCell);
  });

  return header;
}

/**
 * Create the messages list container
 * @param {Array} messages - Array of message objects
 * @param {Object} handlers - Event handlers { onView, onDelete, onMarkRead }
 * @returns {HTMLElement} Messages list element
 */
export function createMessagesList(messages, handlers) {
  const container = document.createElement('div');
  container.className = 'notifications-list-container';

  if (!messages || messages.length === 0) {
    const emptyState = createEmptyState();
    container.appendChild(emptyState);
    return container;
  }

  // Add table header
  container.appendChild(createMessagesTableHeader());

  // Create messages list
  const listContainer = document.createElement('div');
  listContainer.className = 'notifications-list';

  // Create message rows
  messages.forEach((message) => {
    const messageRow = createMessageRow(message, handlers);
    listContainer.appendChild(messageRow);
  });

  container.appendChild(listContainer);

  return container;
}

/**
 * Create empty state message
 * @returns {HTMLElement} Empty state element
 */
function createEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'notifications-empty-state';
  emptyState.innerHTML = `
    <div class="empty-state-icon">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
    </div>
    <h3>No Notifications</h3>
    <p>You don't have any notifications at this time.</p>
  `;
  return emptyState;
}

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

/**
 * Create a message row
 * @param {Object} message - Message object
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} Message row element
 */
function createMessageRow(message, handlers) {
  const row = document.createElement('div');
  row.className = 'notification-row';
  row.setAttribute('data-notification-id', message.id);

  // Determine if message is unread
  // For system messages, check localStorage; for user messages, check status
  let isUnread = false;
  if (message.owner === SYSTEM_MESSAGE_OWNER) {
    const systemReadIds = getSystemNotificationsRead();
    isUnread = !systemReadIds.includes(message.id);
  } else {
    isUnread = message.status === 'unread';
  }

  // Add unread class if message is unread
  if (isUnread) {
    row.classList.add('notification-row-unread');
  }

  // Create message header (always visible)
  const header = document.createElement('div');
  header.className = 'notification-header';

  // Status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'notification-status-indicator';
  if (isUnread) {
    statusIndicator.innerHTML = '<span class="unread-dot"></span>';
  }

  // Priority indicator (!)
  const priorityIndicator = document.createElement('div');
  priorityIndicator.className = 'notification-priority-indicator';
  if (message.priority === 'important') {
    priorityIndicator.innerHTML = '<span class="priority-exclamation">!</span>';
  }

  // Date
  const date = document.createElement('div');
  date.className = 'notification-date';
  date.textContent = formatMessageDate(message.date);

  // Subject (second column)
  const subject = document.createElement('div');
  subject.className = 'notification-subject';
  subject.textContent = message.subject;

  // Type (third column)
  const type = document.createElement('div');
  type.className = 'notification-type';
  const typeBadge = document.createElement('span');
  typeBadge.className = `notification-type-badge notification-type-${message.type.toLowerCase()}`;
  typeBadge.textContent = message.type;
  type.appendChild(typeBadge);

  // From (fourth column)
  const from = document.createElement('div');
  from.className = 'notification-from';
  from.textContent = message.from;

  // Actions container (last column)
  const actions = document.createElement('div');
  actions.className = 'notification-actions';

  // Expand button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'notification-expand-btn';
  expandBtn.setAttribute('aria-label', 'Expand message');
  expandBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMessageExpansion(row);
  };

  actions.appendChild(expandBtn);

  // Delete button (shown for all messages)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'notification-delete-btn';
  deleteBtn.setAttribute('aria-label', 'Delete message');
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    if (handlers.onDelete) {
      handlers.onDelete(message);
    }
  };
  actions.appendChild(deleteBtn);

  // Assemble header as grid cells: status, priority, date, subject, type, from, actions
  header.appendChild(statusIndicator);
  header.appendChild(priorityIndicator);
  header.appendChild(date);
  header.appendChild(subject);
  header.appendChild(type);
  header.appendChild(from);
  header.appendChild(actions);

  // Create message body (expandable)
  const body = document.createElement('div');
  body.className = 'notification-body';
  body.style.display = 'none';

  const messageContent = document.createElement('div');
  messageContent.className = 'notification-content';

  // Convert plain text with URLs to HTML with clickable links
  const linkedText = linkifyText(message.message);
  // Preserve line breaks and convert to <br> tags
  const htmlContent = linkedText.replace(/\n/g, '<br>');
  messageContent.innerHTML = htmlContent;

  body.appendChild(messageContent);

  // Assemble row
  row.appendChild(header);
  row.appendChild(body);

  // Click on header to expand/collapse
  header.addEventListener('click', () => {
    toggleMessageExpansion(row);
    // Mark as read when expanded
    if (row.classList.contains('notification-expanded') && message.status === 'unread') {
      if (handlers.onMarkRead) {
        handlers.onMarkRead(message);
      }
    }
  });

  return row;
}

/**
 * Toggle message expansion
 * @param {HTMLElement} row - Message row element
 */
function toggleMessageExpansion(row) {
  const body = row.querySelector('.notification-body');
  const expandBtn = row.querySelector('.notification-expand-btn');
  const isExpanded = row.classList.contains('notification-expanded');

  if (isExpanded) {
    // Collapse
    row.classList.remove('notification-expanded');
    body.style.display = 'none';
    expandBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    expandBtn.setAttribute('aria-label', 'Expand message');
  } else {
    // Expand
    row.classList.add('notification-expanded');
    body.style.display = 'block';
    expandBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="18 15 12 9 6 15"></polyline>
      </svg>
    `;
    expandBtn.setAttribute('aria-label', 'Collapse message');
  }
}

/**
 * Create filter controls
 * @param {Object} currentFilters - Current filter state
 * @param {Function} onFilterChange - Filter change callback
 * @returns {HTMLElement} Filter controls element
 */
export function createFilterControls(currentFilters, onFilterChange) {
  const filterContainer = document.createElement('div');
  filterContainer.className = 'notification-filters';

  // Status filter
  const statusFilter = document.createElement('div');
  statusFilter.className = 'filter-group';

  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status:';
  statusLabel.className = 'filter-label';

  const statusSelect = document.createElement('select');
  statusSelect.className = 'filter-select';
  statusSelect.innerHTML = `
    <option value="all">All Notifications</option>
    <option value="unread">Unread</option>
    <option value="read">Read</option>
  `;
  statusSelect.value = currentFilters.status || 'all';
  statusSelect.onchange = () => {
    if (onFilterChange) {
      onFilterChange({ ...currentFilters, status: statusSelect.value });
    }
  };

  statusFilter.appendChild(statusLabel);
  statusFilter.appendChild(statusSelect);

  // Type filter
  const typeFilter = document.createElement('div');
  typeFilter.className = 'filter-group';

  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Type:';
  typeLabel.className = 'filter-label';

  const typeSelect = document.createElement('select');
  typeSelect.className = 'filter-select';
  typeSelect.innerHTML = `
    <option value="all">All Types</option>
    <option value="Announcement">Announcements</option>
    <option value="Alert">Alerts</option>
    <option value="Notification">Notifications</option>
  `;
  typeSelect.value = currentFilters.type || 'all';
  typeSelect.onchange = () => {
    if (onFilterChange) {
      onFilterChange({ ...currentFilters, type: typeSelect.value });
    }
  };

  typeFilter.appendChild(typeLabel);
  typeFilter.appendChild(typeSelect);

  // Priority filter
  const priorityFilter = document.createElement('div');
  priorityFilter.className = 'filter-group';

  const priorityLabel = document.createElement('label');
  priorityLabel.textContent = 'Priority:';
  priorityLabel.className = 'filter-label';

  const prioritySelect = document.createElement('select');
  prioritySelect.className = 'filter-select';
  prioritySelect.innerHTML = `
    <option value="all">All Priorities</option>
    <option value="important">Important</option>
    <option value="normal">Normal</option>
  `;
  prioritySelect.value = currentFilters.priority || 'all';
  prioritySelect.onchange = () => {
    if (onFilterChange) {
      onFilterChange({ ...currentFilters, priority: prioritySelect.value });
    }
  };

  priorityFilter.appendChild(priorityLabel);
  priorityFilter.appendChild(prioritySelect);

  filterContainer.appendChild(statusFilter);
  filterContainer.appendChild(typeFilter);
  filterContainer.appendChild(priorityFilter);

  return filterContainer;
}

/**
 * Create message count display
 * @param {number} total - Total message count
 * @param {number} unread - Unread message count
 * @param {number} filtered - Filtered message count
 * @returns {HTMLElement} Count display element
 */
export function createMessageCount(total, unread, filtered) {
  const countContainer = document.createElement('div');
  countContainer.className = 'notification-count';

  const totalSpan = document.createElement('span');
  totalSpan.className = 'count-total';
  totalSpan.textContent = `${filtered} of ${total} notifications`;

  const unreadSpan = document.createElement('span');
  unreadSpan.className = 'count-unread';
  if (unread > 0) {
    unreadSpan.textContent = `${unread} unread`;
  }

  countContainer.appendChild(totalSpan);
  if (unread > 0) {
    countContainer.appendChild(unreadSpan);
  }

  return countContainer;
}
