/**
 * My Rights Reviews Block
 * Reviewer perspective: view unassigned requests and assigned reviews
 */

import { showStatusModal } from './modals.js';
import { REQUEST_STATUSES, getStatusClassName } from './config.js';
import { formatDate } from '../../scripts/rights-management/date-formatter.js';
import { ASSET_PREVIEW } from '../../scripts/rights-management/rights-constants.js';

// Global state
let allReviews = [];
let filteredReviews = [];
let currentTab = 'unassigned';
const selectedFilters = new Set(['all']);

/**
 * Generate preview URL from asset ID and filename
 * @param {string} assetId - Asset ID
 * @param {string} fileName - File name (default: 'thumbnail')
 * @param {string} format - Image format (default: 'jpg')
 * @param {number} width - Image width (default: 160)
 * @returns {string} - Asset preview URL
 */
function buildAssetImageUrl(
  assetId,
  fileName = ASSET_PREVIEW.DEFAULT_FILENAME,
  format = ASSET_PREVIEW.DEFAULT_FORMAT,
  width = 160,
) {
  if (!assetId) return '';
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
  const encodedFileName = encodeURIComponent(cleanFileName);
  return `/api/adobe/assets/${assetId}/as/${encodedFileName}.${format}?width=${width}`;
}

/**
 * Load reviews from API
 */
async function loadReviews() {
  try {
    // eslint-disable-next-line no-console
    console.log('Loading reviews from API...');

    const response = await fetch('/api/rightsrequests/reviews', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to load reviews: ${response.status}`);
    }

    const result = await response.json();
    // eslint-disable-next-line no-console
    console.log('Reviews loaded:', result);

    allReviews = Object.values(result.data || {});
    return allReviews;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading reviews:', error);
    throw error;
  }
}

/**
 * Assign a review to the current user
 */
async function assignReviewToMe(requestId) {
  try {
    const response = await fetch('/api/rightsrequests/reviews/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to assign review: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error assigning review:', error);
    throw error;
  }
}

/**
 * Create detail rows (expanded content) for a review
 */
function createDetailRows(review) {
  const detailsContainer = document.createElement('div');
  detailsContainer.className = 'review-details-expanded';

  const details = review.rightsRequestDetails;
  const usage = details?.intendedUsage || {};
  const agency = details?.associateAgency || {};

  // Create a summary section
  const summary = document.createElement('div');
  summary.className = 'review-summary';
  summary.innerHTML = `
    <div class="summary-row">
      <div class="summary-cell">
        <strong>Submitted By:</strong> ${review.rightsRequestSubmittedUserID}
      </div>
      <div class="summary-cell">
        <strong>Contact:</strong> ${agency.contactName || 'N/A'} (${agency.emailAddress || 'N/A'})
      </div>
    </div>
    <div class="summary-row">
      <div class="summary-cell">
        <strong>Usage Window:</strong> ${formatDate(usage.rightsStartDate)} - ${formatDate(usage.rightsEndDate)}
      </div>
      <div class="summary-cell">
        <strong>Assets:</strong> ${details?.general?.assets?.length || 0}
      </div>
    </div>
    <div class="summary-row">
      <div class="summary-cell">
        <strong>Markets:</strong> ${usage.marketsCovered?.map((m) => m.name).join(', ') || 'N/A'}
      </div>
      <div class="summary-cell">
        <strong>Media:</strong> ${usage.mediaRights?.map((m) => m.name).join(', ') || 'N/A'}
      </div>
    </div>
  `;

  detailsContainer.appendChild(summary);
  return detailsContainer;
}

/**
 * Create a single review row (table format)
 */
function createReviewRow(review) {
  const row = document.createElement('div');
  row.className = 'review-row';
  row.setAttribute('data-expanded', 'false');
  row.setAttribute('data-request-id', review.rightsRequestID);

  const isUnassigned = !review.reviewInfo?.rightsReviewer;

  // Expand/Collapse toggle button
  const toggleCell = document.createElement('div');
  toggleCell.className = 'row-cell cell-toggle';

  const toggleButton = document.createElement('button');
  toggleButton.className = 'expand-toggle-btn';
  toggleButton.setAttribute('aria-label', 'Expand details');
  toggleCell.appendChild(toggleButton);

  // Preview column - show first asset preview
  const previewCell = document.createElement('div');
  previewCell.className = 'row-cell cell-preview';

  const firstAsset = review.rightsRequestDetails?.general?.assets?.[0];
  if (firstAsset?.assetId) {
    const previewImg = document.createElement('img');
    previewImg.src = buildAssetImageUrl(firstAsset.assetId, firstAsset.name);
    previewImg.alt = firstAsset.name || 'Preview';
    previewImg.className = 'preview-thumbnail';
    previewImg.loading = 'lazy';

    previewImg.onerror = () => {
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

    previewCell.appendChild(previewImg);

    const assetCount = review.rightsRequestDetails?.general?.assets?.length || 0;
    if (assetCount > 1) {
      const badge = document.createElement('div');
      badge.className = 'asset-count-badge';
      badge.textContent = `+${assetCount - 1}`;
      previewCell.appendChild(badge);
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'preview-placeholder';
    placeholder.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <rect x="6" y="8" width="28" height="24" rx="2" fill="#f0f0f0" stroke="#ddd"/>
        <text x="20" y="22" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">?</text>
      </svg>
    `;
    previewCell.appendChild(placeholder);
  }

  // Name column
  const nameCell = document.createElement('div');
  nameCell.className = 'row-cell cell-name';

  const requestName = document.createElement('div');
  requestName.className = 'request-id';
  requestName.textContent = review.rightsRequestDetails?.name || `Request ${review.rightsRequestID}`;

  const submittedBy = document.createElement('div');
  submittedBy.className = 'submitted-by';
  submittedBy.textContent = `Submitted by ${review.rightsRequestSubmittedUserID}`;

  const createdDate = document.createElement('div');
  createdDate.className = 'request-date';
  createdDate.textContent = formatDate(review.created);

  nameCell.appendChild(requestName);
  nameCell.appendChild(submittedBy);
  nameCell.appendChild(createdDate);

  // Status column
  const statusCell = document.createElement('div');
  statusCell.className = 'row-cell cell-status';

  const statusBadge = document.createElement('div');
  const statusText = review.rightsRequestReviewDetails?.rightsRequestStatus
    || REQUEST_STATUSES.NOT_STARTED;
  statusBadge.className = `status-badge ${getStatusClassName(statusText)}`;
  statusBadge.textContent = statusText;

  statusCell.appendChild(statusBadge);

  // Action column
  const actionCell = document.createElement('div');
  actionCell.className = 'row-cell cell-action';

  if (isUnassigned) {
    const assignBtn = document.createElement('button');
    assignBtn.className = 'action-button assign-button';
    assignBtn.textContent = 'Assign to Me';
    assignBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        assignBtn.disabled = true;
        assignBtn.textContent = 'Assigning...';
        await assignReviewToMe(review.rightsRequestID);
        await loadReviews();
        // eslint-disable-next-line no-use-before-define
        applyFilters();
        // eslint-disable-next-line no-use-before-define
        renderReviews();
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to assign review: ${error.message}`);
        assignBtn.disabled = false;
        assignBtn.textContent = 'Assign to Me';
      }
    });
    actionCell.appendChild(assignBtn);
  }

  // Change Status button (only for assigned reviews)
  if (!isUnassigned) {
    const statusBtn = document.createElement('button');
    statusBtn.className = 'action-button status-button';
    statusBtn.textContent = 'Change Status';
    statusBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      showStatusModal(review, async () => {
        await loadReviews();
        applyFilters();
        renderReviews();
      });
    });
    actionCell.appendChild(statusBtn);
  }

  const viewBtn = document.createElement('button');
  viewBtn.className = 'action-button view-button';
  viewBtn.textContent = 'View Details';
  viewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const detailUrl = `/my-rights-review-details?requestId=${review.rightsRequestID}`;
    window.open(detailUrl, '_blank');
  });
  actionCell.appendChild(viewBtn);

  // Detail row (spans full width)
  const detailRow = document.createElement('div');
  detailRow.className = 'detail-row';
  const detailContent = createDetailRows(review);
  detailRow.appendChild(detailContent);

  // Append all cells to row
  row.appendChild(toggleCell);
  row.appendChild(previewCell);
  row.appendChild(nameCell);
  row.appendChild(statusCell);
  row.appendChild(actionCell);
  row.appendChild(detailRow);

  // Add toggle event handler
  toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = row.getAttribute('data-expanded') === 'true';

    if (isExpanded) {
      row.setAttribute('data-expanded', 'false');
      toggleButton.setAttribute('aria-label', 'Expand details');
      detailRow.style.display = 'none';
    } else {
      row.setAttribute('data-expanded', 'true');
      toggleButton.setAttribute('aria-label', 'Collapse details');
      detailRow.style.display = 'block';
    }
  });

  return row;
}

/**
 * Apply filter to reviews based on selected filters and current tab
 */
function applyFilters() {
  // First filter by tab (unassigned vs assigned)
  let tabFiltered = [];
  if (currentTab === 'unassigned') {
    tabFiltered = allReviews.filter((r) => !r.reviewInfo?.rightsReviewer);
  } else {
    tabFiltered = allReviews.filter((r) => r.reviewInfo?.rightsReviewer);
  }

  // Then filter by status
  if (selectedFilters.has('all') || selectedFilters.size === 0) {
    filteredReviews = [...tabFiltered];
  } else {
    filteredReviews = tabFiltered.filter((review) => {
      const status = review.rightsRequestReviewDetails?.rightsRequestStatus?.toLowerCase().replace(/\s+/g, '-') || 'not-started';
      return Array.from(selectedFilters).some((filter) => {
        if (filter === 'not-started') return status === 'not-started';
        if (filter === 'in-progress') return status === 'in-progress';
        if (filter === 'user-canceled') return status === 'user-canceled';
        if (filter === 'rm-canceled') return status === 'rm-canceled';
        if (filter === 'quote-pending') return status === 'quote-pending';
        if (filter === 'release-pending') return status === 'release-pending';
        if (filter === 'done') return status === 'done';
        return false;
      });
    });
  }
}

/**
 * Create table header
 */
function createTableHeader() {
  const header = document.createElement('div');
  header.className = 'reviews-table-header';

  const columns = [
    { label: '', className: 'header-toggle' },
    { label: 'PREVIEW', className: 'header-preview' },
    { label: 'NAME', className: 'header-name' },
    { label: 'STATUS', className: 'header-status' },
    { label: 'ACTION', className: 'header-action' },
  ];

  columns.forEach((col) => {
    const headerCell = document.createElement('div');
    headerCell.className = `header-cell ${col.className}`;
    headerCell.textContent = col.label;
    header.appendChild(headerCell);
  });

  return header;
}

/**
 * Render reviews based on current filters
 */
function renderReviews() {
  const container = document.querySelector('.reviews-list-container');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Add table header
  const tableHeader = createTableHeader();
  container.appendChild(tableHeader);

  // Create reviews list
  const reviewsList = document.createElement('div');
  reviewsList.className = 'reviews-list';

  if (filteredReviews.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = currentTab === 'unassigned'
      ? 'No unassigned reviews found.'
      : 'You have no assigned reviews.';
    reviewsList.appendChild(empty);
  } else {
    filteredReviews.forEach((review) => {
      reviewsList.appendChild(createReviewRow(review));
    });
  }

  container.appendChild(reviewsList);

  // Update tab counts
  const unassignedCount = allReviews.filter((r) => !r.reviewInfo?.rightsReviewer).length;
  const assignedCount = allReviews.filter((r) => r.reviewInfo?.rightsReviewer).length;

  const unassignedTab = document.querySelector('[data-tab="unassigned"]');
  const assignedTab = document.querySelector('[data-tab="assigned"]');

  if (unassignedTab) {
    unassignedTab.textContent = `Unassigned (${unassignedCount})`;
  }
  if (assignedTab) {
    assignedTab.textContent = `My Reviews (${assignedCount})`;
  }

  // Update showing count
  updateShowingCount();
}

/**
 * Update the showing count text
 */
function updateShowingCount() {
  const showingText = document.querySelector('.my-rights-reviews .showing-text');
  if (showingText) {
    const count = filteredReviews.length;
    const tabTotal = currentTab === 'unassigned'
      ? allReviews.filter((r) => !r.reviewInfo?.rightsReviewer).length
      : allReviews.filter((r) => r.reviewInfo?.rightsReviewer).length;
    showingText.innerHTML = `Showing <strong>${count}</strong> of <strong>${tabTotal}</strong>`;
  }
}

/**
 * Create tabs
 */
function createTabs() {
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'reviews-tabs';

  const unassignedTab = document.createElement('button');
  unassignedTab.className = 'tab-button active';
  unassignedTab.textContent = 'Unassigned (0)';
  unassignedTab.setAttribute('data-tab', 'unassigned');
  unassignedTab.addEventListener('click', () => {
    currentTab = 'unassigned';
    document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
    unassignedTab.classList.add('active');
    applyFilters();
    renderReviews();
  });

  const assignedTab = document.createElement('button');
  assignedTab.className = 'tab-button';
  assignedTab.textContent = 'My Reviews (0)';
  assignedTab.setAttribute('data-tab', 'assigned');
  assignedTab.addEventListener('click', () => {
    currentTab = 'assigned';
    document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
    assignedTab.classList.add('active');
    applyFilters();
    renderReviews();
  });

  tabsContainer.appendChild(unassignedTab);
  tabsContainer.appendChild(assignedTab);

  return tabsContainer;
}

/**
 * Create controls (showing count and filter)
 */
function createControls() {
  const controls = document.createElement('div');
  controls.className = 'reviews-controls';

  const showingText = document.createElement('div');
  showingText.className = 'showing-text';
  showingText.innerHTML = 'Showing <strong>0</strong> of <strong>0</strong>';

  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-container';

  const filterLabel = document.createElement('span');
  filterLabel.className = 'filter-label';
  filterLabel.textContent = 'FILTER BY';

  // Create multi-select dropdown
  const filterDropdown = document.createElement('div');
  filterDropdown.className = 'filter-dropdown';

  const filterButton = document.createElement('button');
  filterButton.className = 'filter-button';
  filterButton.textContent = 'Select Filter';
  filterButton.setAttribute('aria-expanded', 'false');

  const filterMenu = document.createElement('div');
  filterMenu.className = 'filter-menu';
  filterMenu.setAttribute('role', 'menu');

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'not-started', label: REQUEST_STATUSES.NOT_STARTED },
    { value: 'in-progress', label: REQUEST_STATUSES.IN_PROGRESS },
    { value: 'user-canceled', label: REQUEST_STATUSES.USER_CANCELED },
    { value: 'rm-canceled', label: REQUEST_STATUSES.RM_CANCELED },
    { value: 'quote-pending', label: REQUEST_STATUSES.QUOTE_PENDING },
    { value: 'release-pending', label: REQUEST_STATUSES.RELEASE_PENDING },
    { value: 'done', label: REQUEST_STATUSES.DONE },
  ];

  filterOptions.forEach((option) => {
    const optionItem = document.createElement('label');
    optionItem.className = 'filter-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = option.value;
    checkbox.checked = selectedFilters.has(option.value);

    checkbox.addEventListener('change', () => {
      if (option.value === 'all') {
        if (checkbox.checked) {
          selectedFilters.clear();
          selectedFilters.add('all');
          // Uncheck all other checkboxes
          filterMenu.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            if (cb.value !== 'all') cb.checked = false;
          });
        } else {
          selectedFilters.delete('all');
        }
      } else if (checkbox.checked) {
        selectedFilters.delete('all');
        selectedFilters.add(option.value);
        // Uncheck "All"
        const allCheckbox = filterMenu.querySelector('input[value="all"]');
        if (allCheckbox) allCheckbox.checked = false;
      } else {
        selectedFilters.delete(option.value);
        // If no filters selected, check "All"
        if (selectedFilters.size === 0) {
          selectedFilters.add('all');
          const allCheckbox = filterMenu.querySelector('input[value="all"]');
          if (allCheckbox) allCheckbox.checked = true;
        }
      }

      applyFilters();
      renderReviews();
    });

    const label = document.createElement('span');
    label.textContent = option.label;

    optionItem.appendChild(checkbox);
    optionItem.appendChild(label);
    filterMenu.appendChild(optionItem);
  });

  // Toggle dropdown
  filterButton.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filterButton.getAttribute('aria-expanded') === 'true';
    filterButton.setAttribute('aria-expanded', !isOpen);
    filterMenu.classList.toggle('open', !isOpen);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!filterDropdown.contains(e.target)) {
      filterButton.setAttribute('aria-expanded', 'false');
      filterMenu.classList.remove('open');
    }
  });

  filterDropdown.appendChild(filterButton);
  filterDropdown.appendChild(filterMenu);

  filterContainer.appendChild(filterLabel);
  filterContainer.appendChild(filterDropdown);

  controls.appendChild(showingText);
  controls.appendChild(filterContainer);

  return controls;
}

/**
 * Main decorate function
 */
export default async function decorate(block) {
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'reviews-container';

  // Create header with title and tabs
  const header = document.createElement('div');
  header.className = 'reviews-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'title-row';

  const title = document.createElement('h1');
  title.className = 'reviews-title';
  title.textContent = 'Rights Request Reviews';

  titleRow.appendChild(title);
  header.appendChild(titleRow);

  // Add tabs
  const tabs = createTabs();
  header.appendChild(tabs);

  container.appendChild(header);

  // Loading state
  const loading = document.createElement('div');
  loading.className = 'loading-state';
  loading.textContent = 'Loading reviews...';
  container.appendChild(loading);

  block.appendChild(container);

  // Load reviews
  try {
    await loadReviews();

    // Remove loading state
    loading.remove();

    // Apply initial filters
    applyFilters();

    // Create controls
    const controls = createControls();
    container.appendChild(controls);

    // Create list container
    const listContainer = document.createElement('div');
    listContainer.className = 'reviews-list-container';
    container.appendChild(listContainer);

    // Initial render
    renderReviews();
  } catch (error) {
    loading.remove();
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.textContent = `Failed to load reviews: ${error.message}`;
    container.appendChild(errorDiv);
  }
}
