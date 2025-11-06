import { formatDate } from '../../scripts/rights-management/date-formatter.js';
import showToast from '../../scripts/toast/toast.js';

// Configuration constants
const CONFIG = {
  CHART_JS_CDN: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  CHART_COLORS: ['#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4', '#FF5722', '#795548'],
  ASSET_CHART_COLORS: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'],
  MS_PER_DAY: 1000 * 60 * 60 * 24,
  CHART_INIT_DELAY_SHORT: 50,
  CHART_INIT_DELAY_LONG: 100,
  TABLE_COLUMNS_COUNT: 15,
  DEFAULT_STATUS: 'Not Started',
  DONE_STATUS: 'Done',
  MONTH_ORDER: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  DEBUG: false, // Set to true for debug logging
};

// Status constants
const RIGHTS_REQUEST_STATUSES = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  QUOTE_PENDING: 'Quote Pending',
  DONE: 'Done',
};

// Global state
let allRequests = [];
let filteredRequests = [];
let chartJsLoaded = false;
const currentFilters = {
  dateRange: 'all',
  status: 'all',
  reviewer: 'all',
};

/**
 * Debug logger - only logs when CONFIG.DEBUG is true
 * @param {...any} args - Arguments to log
 */
function debug(...args) {
  if (CONFIG.DEBUG) {
    // eslint-disable-next-line no-console
    console.trace('[Report Debug]', ...args);
  }
}

/**
 * Check if any filters are currently active
 * @returns {boolean} True if any filter is not set to 'all'
 */
function isFilterActive() {
  return currentFilters.dateRange !== 'all'
    || currentFilters.status !== 'all'
    || currentFilters.reviewer !== 'all';
}

/**
 * Load Chart.js library dynamically from CDN
 * @returns {Promise<boolean>} Resolves to true when loaded
 */
async function loadChartJs() {
  if (chartJsLoaded) return true;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CONFIG.CHART_JS_CDN;
    script.onload = () => {
      chartJsLoaded = true;
      resolve(true);
    };
    script.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(script);
  });
}

/**
 * Calculate request counts by status
 * Only includes statuses with at least 1 request
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<{status: string, count: number}>} Status counts sorted by count descending
 */
function calculateStatusCounts(requests) {
  const statusCounts = {};

  requests.forEach((request) => {
    const status = request.rightsRequestReviewDetails?.rightsRequestStatus || CONFIG.DEFAULT_STATUS;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Convert to array and sort by count (descending)
  return Object.entries(statusCounts)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate request counts by date (year and month)
 * @param {Array} requests - Array of rights request objects
 * @returns {{yearCounts: Object, monthCounts: Object}} Date aggregations
 */
function calculateDateCounts(requests) {
  const yearCounts = {};
  const monthCounts = {};

  requests.forEach((request) => {
    if (!request.created) return;

    const date = new Date(request.created);
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'short' });

    // Count by year
    yearCounts[year] = (yearCounts[year] || 0) + 1;

    // Count by month (with year key for filtering)
    if (!monthCounts[year]) {
      monthCounts[year] = {};
    }
    monthCounts[year][month] = (monthCounts[year][month] || 0) + 1;
  });

  return { yearCounts, monthCounts };
}

/**
 * Get unique years from requests data
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<number>} Sorted years (newest first)
 */
function getAvailableYears(requests) {
  const years = new Set();
  requests.forEach((request) => {
    if (request.created) {
      const year = new Date(request.created).getFullYear();
      years.add(year);
    }
  });
  return Array.from(years).sort().reverse();
}

/**
 * Get all unique statuses from requests
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<string>} Sorted unique statuses
 */
function getAvailableStatuses(requests) {
  const statuses = new Set();
  requests.forEach((request) => {
    const status = request.rightsRequestReviewDetails?.rightsRequestStatus || CONFIG.DEFAULT_STATUS;
    statuses.add(status);
  });
  return Array.from(statuses).sort();
}

/**
 * Get all unique reviewers from requests
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<string>} Sorted unique reviewer emails
 */
function getAvailableReviewers(requests) {
  const reviewers = new Set();
  requests.forEach((request) => {
    const reviewer = request.rightsRequestReviewDetails?.rightsReviewer;
    if (reviewer) {
      reviewers.add(reviewer);
    }
  });
  return Array.from(reviewers).sort();
}

/**
 * Calculate repeated asset requests
 * Returns assets that appear in multiple requests
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<{asset: string, count: number}>} Assets with count > 1,
 *   sorted by count descending
 */
function calculateRepeatedAssets(requests) {
  const assetCounts = {};

  requests.forEach((request) => {
    const general = request.rightsRequestDetails?.general || {};
    let assets = [];

    // Extract asset names from different formats
    if (general.assetPaths && general.assetPaths.length > 0) {
      assets = general.assetPaths;
    } else if (general.assets && general.assets.length > 0) {
      assets = general.assets.map((a) => a.name || a.assetId || '').filter(Boolean);
    }

    // Count each asset
    assets.forEach((assetName) => {
      if (assetName) {
        assetCounts[assetName] = (assetCounts[assetName] || 0) + 1;
      }
    });
  });

  // Filter to only assets requested more than once, and sort by count
  return Object.entries(assetCounts)
    .filter(([, count]) => count > 1)
    .map(([asset, count]) => ({ asset, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate requests by reviewer
 * @param {Array} requests - Array of rights request objects
 * @returns {Array<{reviewer: string, count: number}>} Reviewer counts sorted by count descending
 */
function calculateRequestsByReviewer(requests) {
  const reviewerCounts = {};

  requests.forEach((request) => {
    const reviewer = request.rightsRequestReviewDetails?.rightsReviewer;
    if (reviewer) {
      reviewerCounts[reviewer] = (reviewerCounts[reviewer] || 0) + 1;
    }
  });

  return Object.entries(reviewerCounts)
    .map(([reviewer, count]) => ({ reviewer, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate review completion time statistics (min, avg, max) in days
 * Only includes requests with status "Done"
 * @param {Array} requests - Array of rights request objects
 * @returns {{min: number, avg: number, max: number}|null} Time stats or null
 *   if no completed reviews
 */
function calculateReviewTimeStats(requests) {
  // Only include requests with status "Done"
  const completedReviews = requests.filter((request) => {
    const status = request.rightsRequestReviewDetails?.rightsRequestStatus;
    return status === RIGHTS_REQUEST_STATUSES.DONE;
  });

  if (completedReviews.length === 0) {
    return null;
  }

  const daysList = [];

  completedReviews.forEach((request) => {
    const created = request.created ? new Date(request.created) : null;
    const modified = request.lastModified ? new Date(request.lastModified) : null;

    if (created && modified) {
      const diffTime = Math.abs(modified - created);
      const diffDays = Math.ceil(diffTime / CONFIG.MS_PER_DAY);
      daysList.push(diffDays);
    }
  });

  if (daysList.length === 0) {
    return null;
  }

  const min = Math.min(...daysList);
  const max = Math.max(...daysList);
  const avg = Math.round(daysList.reduce((sum, days) => sum + days, 0) / daysList.length);

  return { min, avg, max };
}

/**
 * Apply filters to requests data based on currentFilters state
 * Filters by date range, status, and reviewer
 * @returns {Array} Filtered array of requests
 */
function applyFilters() {
  let filtered = [...allRequests];

  // Apply date filter
  if (currentFilters.dateRange !== 'all') {
    const now = new Date();
    let cutoffDate;

    if (currentFilters.dateRange === 'last30d') {
      cutoffDate = new Date(now.setDate(now.getDate() - 30));
    } else if (currentFilters.dateRange === 'last90d') {
      cutoffDate = new Date(now.setDate(now.getDate() - 90));
    } else if (currentFilters.dateRange === 'last12m') {
      cutoffDate = new Date(now.setMonth(now.getMonth() - 12));
    } else if (currentFilters.dateRange.match(/^\d{4}$/)) {
      // Year filter (e.g., "2025")
      const year = parseInt(currentFilters.dateRange, 10);
      filtered = filtered.filter((request) => {
        if (!request.created) return false;
        const requestYear = new Date(request.created).getFullYear();
        return requestYear === year;
      });
      cutoffDate = null;
    }

    if (cutoffDate) {
      filtered = filtered.filter((request) => {
        if (!request.created) return false;
        const requestDate = new Date(request.created);
        return requestDate >= cutoffDate;
      });
    }
  }

  // Apply status filter
  if (currentFilters.status !== 'all') {
    filtered = filtered.filter((request) => {
      const status = request.rightsRequestReviewDetails?.rightsRequestStatus
        || CONFIG.DEFAULT_STATUS;
      return status === currentFilters.status;
    });
  }

  // Apply reviewer filter
  if (currentFilters.reviewer !== 'all') {
    filtered = filtered.filter((request) => {
      const reviewer = request.rightsRequestReviewDetails?.rightsReviewer;
      return reviewer === currentFilters.reviewer;
    });
  }

  filteredRequests = filtered;
  return filtered;
}

/**
 * Update all displays with filtered data
 * Re-renders charts, table, and summary counts
 */
function updateDisplays() {
  applyFilters();

  debug(`Applied filters. Showing ${filteredRequests.length} of ${allRequests.length} requests`);

  // Update count text
  const countText = document.querySelector('.report-count');
  if (countText) {
    const filterLabel = isFilterActive() ? ` (filtered from ${allRequests.length})` : '';
    countText.innerHTML = `Showing <strong>${filteredRequests.length}</strong> total requests${filterLabel}`;
  }

  // Update summary section
  const totalCount = document.querySelector('.summary-total-count');
  if (totalCount) {
    totalCount.textContent = filteredRequests.length;
  }

  // Re-render charts with a small delay to ensure DOM is ready
  setTimeout(() => {
    initializeCharts();
  }, CONFIG.CHART_INIT_DELAY_SHORT);

  // Re-render table
  const tableContainer = document.querySelector('.report-table-container');
  if (tableContainer) {
    const newTable = createTable();
    tableContainer.replaceWith(newTable);
  }
}

/**
 * Create filters section with date, status, and reviewer dropdowns
 * @returns {HTMLElement} Filters container element
 */
function createFiltersSection() {
  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'report-filters';

  const filtersLabel = document.createElement('div');
  filtersLabel.className = 'filters-label';
  filtersLabel.textContent = 'Filters:';

  const filtersControls = document.createElement('div');
  filtersControls.className = 'filters-controls';

  // Date filter
  const dateFilterGroup = document.createElement('div');
  dateFilterGroup.className = 'filter-group';

  const dateLabel = document.createElement('label');
  dateLabel.textContent = 'By Date:';
  dateLabel.className = 'filter-label';

  const dateSelect = document.createElement('select');
  dateSelect.className = 'filter-select';
  dateSelect.id = 'date-filter';

  // Build date options
  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'last30d', label: 'Last 30 Days' },
    { value: 'last90d', label: 'Last 90 Days' },
    { value: 'last12m', label: 'Last 12 Months' },
  ];

  // Add year options
  const years = getAvailableYears(allRequests);
  years.forEach((year) => {
    dateOptions.push({ value: year.toString(), label: year.toString() });
  });

  dateOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    dateSelect.appendChild(option);
  });

  dateSelect.addEventListener('change', (e) => {
    currentFilters.dateRange = e.target.value;
    updateDisplays();
  });

  dateFilterGroup.appendChild(dateLabel);
  dateFilterGroup.appendChild(dateSelect);

  // Status filter
  const statusFilterGroup = document.createElement('div');
  statusFilterGroup.className = 'filter-group';

  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'By Status:';
  statusLabel.className = 'filter-label';

  const statusSelect = document.createElement('select');
  statusSelect.className = 'filter-select';
  statusSelect.id = 'status-filter';

  // Build status options
  const statusOptions = [{ value: 'all', label: 'All Statuses' }];
  const statuses = getAvailableStatuses(allRequests);
  statuses.forEach((status) => {
    statusOptions.push({ value: status, label: status });
  });

  statusOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    statusSelect.appendChild(option);
  });

  statusSelect.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    updateDisplays();
  });

  statusFilterGroup.appendChild(statusLabel);
  statusFilterGroup.appendChild(statusSelect);

  // Reviewer filter
  const reviewerFilterGroup = document.createElement('div');
  reviewerFilterGroup.className = 'filter-group';

  const reviewerLabel = document.createElement('label');
  reviewerLabel.textContent = 'By Reviewer:';
  reviewerLabel.className = 'filter-label';

  const reviewerSelect = document.createElement('select');
  reviewerSelect.className = 'filter-select';
  reviewerSelect.id = 'reviewer-filter';

  // Build reviewer options
  const reviewerOptions = [{ value: 'all', label: 'All Reviewers' }];
  const reviewers = getAvailableReviewers(allRequests);
  reviewers.forEach((reviewer) => {
    reviewerOptions.push({ value: reviewer, label: reviewer });
  });

  reviewerOptions.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    reviewerSelect.appendChild(option);
  });

  reviewerSelect.addEventListener('change', (e) => {
    currentFilters.reviewer = e.target.value;
    updateDisplays();
  });

  reviewerFilterGroup.appendChild(reviewerLabel);
  reviewerFilterGroup.appendChild(reviewerSelect);

  // Reset button
  const resetButton = document.createElement('button');
  resetButton.className = 'reset-filters-btn';
  resetButton.textContent = 'Reset Filters';
  resetButton.addEventListener('click', () => {
    currentFilters.dateRange = 'all';
    currentFilters.status = 'all';
    currentFilters.reviewer = 'all';
    dateSelect.value = 'all';
    statusSelect.value = 'all';
    reviewerSelect.value = 'all';
    updateDisplays();
  });

  filtersControls.appendChild(dateFilterGroup);
  filtersControls.appendChild(statusFilterGroup);
  filtersControls.appendChild(reviewerFilterGroup);
  filtersControls.appendChild(resetButton);

  filtersContainer.appendChild(filtersLabel);
  filtersContainer.appendChild(filtersControls);

  return filtersContainer;
}

/**
 * Render status pie chart showing request distribution by status
 */
let statusChartInstance = null;

/**
 * Render status pie chart
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Array<{status: string, count: number}>} statusData - Status counts
 * @returns {Chart|null} Chart instance or null if Chart.js not loaded
 */
function renderStatusChart(canvas, statusData) {
  if (!window.Chart) {
    // eslint-disable-next-line no-console
    console.error('Chart.js not loaded');
    return null;
  }

  // Destroy existing chart
  if (statusChartInstance) {
    statusChartInstance.destroy();
  }

  const data = {
    labels: statusData.map((item) => `${item.status} (${item.count})`),
    datasets: [{
      data: statusData.map((item) => item.count),
      backgroundColor: CONFIG.CHART_COLORS.slice(0, statusData.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const config = {
    type: 'pie',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 10,
            font: { size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = statusData[context.dataIndex].status;
              const value = context.parsed;
              const total = statusData.reduce((sum, item) => sum + item.count, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} (${percentage}%)`;
            },
          },
        },
      },
    },
  };

  statusChartInstance = new window.Chart(canvas, config);
  return statusChartInstance;
}

/**
 * Render requests by reviewer pie chart
 */
let reviewerChartInstance = null;

/**
 * Render reviewer distribution pie chart
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Array<{reviewer: string, count: number}>} reviewerData - Reviewer counts
 * @returns {Chart|null} Chart instance or null if no data
 */
function renderReviewerChart(canvas, reviewerData) {
  if (!window.Chart) {
    // eslint-disable-next-line no-console
    console.error('Chart.js not loaded');
    return null;
  }

  // Destroy existing chart
  if (reviewerChartInstance) {
    reviewerChartInstance.destroy();
  }

  if (!reviewerData || reviewerData.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('No reviewer data', canvas.width / 2, canvas.height / 2);
    return null;
  }

  const config = {
    type: 'pie',
    data: {
      labels: reviewerData.map((item) => `${item.reviewer} (${item.count})`),
      datasets: [{
        data: reviewerData.map((item) => item.count),
        backgroundColor: CONFIG.CHART_COLORS.slice(0, reviewerData.length),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 10,
            font: { size: 11 },
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = reviewerData[context.dataIndex].reviewer;
              const value = context.parsed;
              const total = reviewerData.reduce((sum, item) => sum + item.count, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} requests (${percentage}%)`;
            },
          },
        },
      },
    },
  };

  reviewerChartInstance = new window.Chart(canvas, config);
  return reviewerChartInstance;
}

/**
 * Render repeated assets pie chart
 */
let assetsChartInstance = null;

/**
 * Render repeated assets pie chart (only assets requested more than once)
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Array<{asset: string, count: number}>} assetData - Asset counts > 1
 * @returns {Chart|null} Chart instance or null if no repeated assets
 */
function renderRepeatedAssetsChart(canvas, assetData) {
  if (!window.Chart) {
    // eslint-disable-next-line no-console
    console.error('Chart.js not loaded');
    return null;
  }

  // Destroy existing chart
  if (assetsChartInstance) {
    assetsChartInstance.destroy();
  }

  if (!assetData || assetData.length === 0) {
    // No repeated assets
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('No repeated assets', canvas.width / 2, canvas.height / 2);
    return null;
  }

  const data = {
    labels: assetData.map((item) => `${item.asset} (${item.count})`),
    datasets: [{
      data: assetData.map((item) => item.count),
      backgroundColor: CONFIG.ASSET_CHART_COLORS.slice(0, assetData.length),
      borderWidth: 2,
      borderColor: '#fff',
    }],
  };

  const config = {
    type: 'pie',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 10,
            font: { size: 11 },
            boxWidth: 12,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = assetData[context.dataIndex].asset;
              const value = context.parsed;
              const total = assetData.reduce((sum, item) => sum + item.count, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} requests (${percentage}%)`;
            },
          },
        },
      },
    },
  };

  assetsChartInstance = new window.Chart(canvas, config);
  return assetsChartInstance;
}

/**
 * Render date bar chart (year or month view)
 */
let dateChartInstance = null;
let allDateData = null;

/**
 * Render date bar chart with year or month view
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} dateData - Date counts ({yearCounts, monthCounts})
 * @param {string} viewMode - 'year' or 'month'
 * @returns {Chart|null} Chart instance or null if Chart.js not loaded
 */
function renderDateChart(canvas, dateData, viewMode = 'year') {
  if (!window.Chart) {
    // eslint-disable-next-line no-console
    console.error('Chart.js not loaded');
    return null;
  }

  // Store data for toggling
  allDateData = dateData;

  // Destroy existing chart
  if (dateChartInstance) {
    dateChartInstance.destroy();
  }

  let labels;
  let data;
  let title;

  if (viewMode === 'year') {
    // Year view
    const years = Object.keys(dateData.yearCounts).sort();
    labels = years;
    data = years.map((year) => dateData.yearCounts[year]);
    title = 'Requests by Year';
  } else {
    // Month view - use current year or most recent year with data
    const years = Object.keys(dateData.monthCounts).sort().reverse();
    const targetYear = years[0] || new Date().getFullYear();

    labels = CONFIG.MONTH_ORDER;
    data = CONFIG.MONTH_ORDER.map((month) => dateData.monthCounts[targetYear]?.[month] || 0);
    title = `Requests by Month (${targetYear})`;
  }

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Requests',
        data,
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: title,
          font: { size: 14, weight: 'bold' },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };

  dateChartInstance = new window.Chart(canvas, config);
  return dateChartInstance;
}

/**
 * Toggle date chart view between year and month
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {string} newView - 'year' or 'month'
 */
function toggleDateView(canvas, newView) {
  if (allDateData) {
    renderDateChart(canvas, allDateData, newView);
  }
}

/**
 * Load all rights requests from KV store via admin endpoint
 * Fetches ALL requests across all users (requires admin access)
 * @returns {Promise<Array>} Array of all rights requests
 * @throws {Error} If fetch fails or user not authenticated
 */
async function loadAllRightsRequests() {
  try {
    debug('Loading all rights requests from KV store...');

    const response = await fetch('/api/rightsrequests/all', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to load rights requests: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to load rights requests');
    }

    // Convert object to array with KV key information
    allRequests = Object.entries(result.data || {}).map(([key, request]) => ({
      ...request,
      kvKey: key,
    }));

    debug(`Loaded ${allRequests.length} rights requests from ${result.totalKeys || 0} total KV keys`);

    // Debug: log first request to see structure
    if (allRequests.length > 0) {
      debug('Sample request structure:', allRequests[0]);
    }

    return allRequests;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading rights requests:', error);
    throw error;
  }
}

/**
 * Export current data to CSV file
 * Uses filtered data if filters are active
 */
function exportToCSV() {
  // Use filtered data if filters are active
  const dataSource = isFilterActive() ? filteredRequests : allRequests;

  if (dataSource.length === 0) {
    showToast('No data to export', 'info');
    return;
  }

  // Define CSV headers matching the table columns
  const headers = [
    'PATH',
    'CREATED',
    'LAST MODIFIED',
    'TITLE',
    'RIGHTSREQUESTSTATUS',
    'RIGHTSMANAGER',
    'RIGHTSREQUESTAPPROVEDORREJECTEDDATE',
    'NAME',
    'EMAILADDRESS',
    'MARKETSCOVEREDFADELID',
    'MEDIARIGHTSFADELID',
    'AGENCYORTCCCASSOCIATE',
    'MARKETSCOVERED',
    'MEDIARIGHTS',
    'ASSETPATHS',
  ];

  // Convert data to CSV rows
  const rows = dataSource.map((request) => {
    const details = request.rightsRequestDetails || {};
    const reviewDetails = request.rightsRequestReviewDetails || {};
    const agency = details.associateAgency || {};
    const intendedUsage = details.intendedUsage || {};
    const general = details.general || {};

    // Extract markets and media
    const markets = intendedUsage.marketsCovered || [];
    const marketNames = markets.map((m) => m.name).join('; ');
    const marketIds = markets.map((m) => m.id).join('; ');

    const media = intendedUsage.mediaRights || [];
    const mediaNames = media.map((m) => m.name).join('; ');
    const mediaIds = media.map((m) => m.id).join('; ');

    // Extract asset paths - handle multiple formats
    let assetPaths = '';
    if (general.assetPaths && general.assetPaths.length > 0) {
      // Legacy format: array of path strings
      assetPaths = general.assetPaths.join('; ');
    } else if (general.assets && general.assets.length > 0) {
      // New format: array of asset objects
      assetPaths = general.assets
        .map((a) => a.name || a.assetPath || a.assetId || '')
        .filter(Boolean)
        .join('; ');
    }

    // Use raw KV key if available for PATH column
    const pathValue = request.rawKvKey || request.kvKey || '';

    // Only show approval date if status is DONE
    const approvalDateValue = reviewDetails.rightsRequestStatus === RIGHTS_REQUEST_STATUSES.DONE
      ? (request.lastModified || '')
      : '';

    return [
      pathValue,
      request.created || '',
      request.lastModified || '',
      details.name || '',
      reviewDetails.rightsRequestStatus || '',
      reviewDetails.rightsReviewer || '',
      approvalDateValue,
      agency.name || '',
      agency.emailAddress || '',
      marketIds,
      mediaIds,
      agency.agencyOrTcccAssociate || '',
      marketNames,
      mediaNames,
      assetPaths,
    ];
  });

  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `rights-requests-report-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Create summary section with stats and charts
 * Contains 6 cards: Total, Status, Date, Reviewer, Review Time, Repeated Assets
 * @returns {HTMLElement} Summary section container
 */
function createSummarySection() {
  const summary = document.createElement('div');
  summary.className = 'report-summary';

  const summaryCards = document.createElement('div');
  summaryCards.className = 'summary-cards';

  // Card 1: Total Requests
  const totalCard = document.createElement('div');
  totalCard.className = 'summary-card total-card';
  totalCard.innerHTML = `
    <h3 class="summary-card-title">Total Requests</h3>
    <div class="summary-total-count">${allRequests.length}</div>
  `;

  // Card 2: Requests by Status (Pie Chart)
  const statusCard = document.createElement('div');
  statusCard.className = 'summary-card status-card';
  statusCard.innerHTML = `
    <h3 class="summary-card-title">Requests by Status</h3>
    <div class="chart-container">
      <canvas id="status-chart"></canvas>
    </div>
  `;

  // Card 3: Requests by Date (Bar Chart with Toggle)
  const dateCard = document.createElement('div');
  dateCard.className = 'summary-card date-card';
  dateCard.innerHTML = `
    <h3 class="summary-card-title">Requests by Date</h3>
    <div class="chart-toggle-buttons">
      <button class="chart-toggle-btn active" data-view="year">Year</button>
      <button class="chart-toggle-btn" data-view="month">Month</button>
    </div>
    <div class="chart-container">
      <canvas id="date-chart"></canvas>
    </div>
  `;

  // Card 4: Requests by Reviewer (Bar Chart)
  const reviewerCard = document.createElement('div');
  reviewerCard.className = 'summary-card reviewer-card';
  reviewerCard.innerHTML = `
    <h3 class="summary-card-title">Requests by Reviewer</h3>
    <div class="chart-container">
      <canvas id="reviewer-chart"></canvas>
    </div>
  `;

  // Card 5: Review Completion Time
  const avgTimeCard = document.createElement('div');
  avgTimeCard.className = 'summary-card avgtime-card';
  avgTimeCard.innerHTML = `
    <h3 class="summary-card-title">Review Completion Time</h3>
    <div class="review-time-stats">
      <div class="time-stat-row">
        <span class="time-stat-label">Min:</span>
        <span class="time-stat-value min-time-value">-</span>
        <span class="time-stat-unit">days</span>
      </div>
      <div class="time-stat-row">
        <span class="time-stat-label">Avg:</span>
        <span class="time-stat-value avg-time-value">-</span>
        <span class="time-stat-unit">days</span>
      </div>
      <div class="time-stat-row">
        <span class="time-stat-label">Max:</span>
        <span class="time-stat-value max-time-value">-</span>
        <span class="time-stat-unit">days</span>
      </div>
    </div>
  `;

  // Card 6: Repeated Assets (Pie Chart)
  const assetsCard = document.createElement('div');
  assetsCard.className = 'summary-card assets-card';
  assetsCard.innerHTML = `
    <h3 class="summary-card-title">Repeated Assets Requested</h3>
    <div class="chart-container">
      <canvas id="assets-chart"></canvas>
    </div>
  `;

  summaryCards.appendChild(totalCard);
  summaryCards.appendChild(statusCard);
  summaryCards.appendChild(dateCard);
  summaryCards.appendChild(reviewerCard);
  summaryCards.appendChild(avgTimeCard);
  summaryCards.appendChild(assetsCard);
  summary.appendChild(summaryCards);

  return summary;
}

/**
 * Initialize all charts after summary section is added to DOM
 * Renders status, date, reviewer, and repeated assets charts
 * Updates review time statistics
 */
function initializeCharts() {
  // Use filtered data when filters are active
  const dataSource = isFilterActive() ? filteredRequests : allRequests;

  debug(`Rendering charts with ${dataSource.length} requests (filter active: ${isFilterActive()})`);

  const statusData = calculateStatusCounts(dataSource);
  const dateData = calculateDateCounts(dataSource);
  const reviewerData = calculateRequestsByReviewer(dataSource);
  const timeStats = calculateReviewTimeStats(dataSource);
  const assetsData = calculateRepeatedAssets(dataSource);

  // Render charts
  const statusCanvas = document.getElementById('status-chart');
  const dateCanvas = document.getElementById('date-chart');
  const reviewerCanvas = document.getElementById('reviewer-chart');
  const assetsCanvas = document.getElementById('assets-chart');

  if (statusCanvas) {
    if (statusData.length > 0) {
      renderStatusChart(statusCanvas, statusData);
    } else {
      // Destroy chart if no data
      if (statusChartInstance) {
        statusChartInstance.destroy();
        statusChartInstance = null;
      }
      const ctx = statusCanvas.getContext('2d');
      ctx.clearRect(0, 0, statusCanvas.width, statusCanvas.height);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#999';
      ctx.textAlign = 'center';
      ctx.fillText('No data for selected filters', statusCanvas.width / 2, statusCanvas.height / 2);
    }
  }

  if (dateCanvas) {
    renderDateChart(dateCanvas, dateData, 'year');

    // Add toggle button listeners
    const toggleButtons = document.querySelectorAll('.chart-toggle-btn');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        // Update active state
        toggleButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle chart
        const { view } = btn.dataset;
        toggleDateView(dateCanvas, view);
      });
    });
  }

  // Render reviewer chart
  if (reviewerCanvas) {
    renderReviewerChart(reviewerCanvas, reviewerData);
  }

  // Update review time statistics display
  const minTimeValue = document.querySelector('.min-time-value');
  const avgTimeValue = document.querySelector('.avg-time-value');
  const maxTimeValue = document.querySelector('.max-time-value');

  if (minTimeValue && avgTimeValue && maxTimeValue) {
    if (timeStats) {
      minTimeValue.textContent = timeStats.min;
      avgTimeValue.textContent = timeStats.avg;
      maxTimeValue.textContent = timeStats.max;
    } else {
      minTimeValue.textContent = '-';
      avgTimeValue.textContent = '-';
      maxTimeValue.textContent = '-';
    }
  }

  // Render repeated assets chart
  if (assetsCanvas) {
    renderRepeatedAssetsChart(assetsCanvas, assetsData);
  }
}

/**
 * Create table header with all column names
 * @returns {HTMLElement} Table header element
 */
function createTableHeader() {
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const columns = [
    'PATH',
    'CREATED',
    'LAST MODIFIED',
    'TITLE',
    'RIGHTSREQUESTSTATUS',
    'RIGHTSMANAGER',
    'RIGHTSREQUESTAPPROVEDORREJECTEDDATE',
    'NAME',
    'EMAILADDRESS',
    'MARKETSCOVEREDFADELID',
    'MEDIARIGHTSFADELID',
    'AGENCYORTCCCASSOCIATE',
    'MARKETSCOVERED',
    'MEDIARIGHTS',
    'ASSETPATHS',
  ];

  columns.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  return thead;
}

/**
 * Create a table row for a single request
 * Extracts and formats all required columns from request data
 * @param {Object} request - Rights request object
 * @returns {HTMLElement} Table row element
 */
function createTableRow(request) {
  const row = document.createElement('tr');

  const details = request.rightsRequestDetails || {};
  const reviewDetails = request.rightsRequestReviewDetails || {};
  const agency = details.associateAgency || {};
  const intendedUsage = details.intendedUsage || {};
  const general = details.general || {};

  // Helper to create cell
  const createCell = (content, title = null) => {
    const cell = document.createElement('td');
    cell.textContent = content;
    if (title) cell.title = title;
    return cell;
  };

  // PATH - use raw KV key if available, otherwise fall back to kvKey
  const pathValue = request.rawKvKey || request.kvKey || '';
  row.appendChild(createCell(pathValue, pathValue));

  // CREATED
  row.appendChild(createCell(formatDate(request.created)));

  // LAST MODIFIED
  row.appendChild(createCell(formatDate(request.lastModified)));

  // TITLE
  row.appendChild(createCell(details.name || '-'));

  // RIGHTSREQUESTSTATUS - create styled badge
  const statusCell = document.createElement('td');
  const statusValue = reviewDetails.rightsRequestStatus || CONFIG.DEFAULT_STATUS;
  const statusBadge = document.createElement('div');
  statusBadge.className = `status-badge status-${statusValue.toLowerCase().replace(/\s+/g, '-')}`;
  statusBadge.textContent = statusValue;
  statusCell.appendChild(statusBadge);
  row.appendChild(statusCell);

  // RIGHTSMANAGER
  row.appendChild(createCell(reviewDetails.rightsReviewer || '-'));

  // RIGHTSREQUESTAPPROVEDORREJECTEDDATE
  // Only show date if status is DONE (completed)
  const approvalDate = reviewDetails.rightsRequestStatus === RIGHTS_REQUEST_STATUSES.DONE
    ? formatDate(request.lastModified)
    : '-';
  row.appendChild(createCell(approvalDate));

  // NAME
  row.appendChild(createCell(agency.name || '-'));

  // EMAILADDRESS
  row.appendChild(createCell(agency.emailAddress || '-'));

  // MARKETSCOVEREDFADELID
  const markets = intendedUsage.marketsCovered || [];
  const marketIds = markets.map((m) => m.id).join(', ');
  row.appendChild(createCell(marketIds || '-'));

  // MEDIARIGHTSFADELID
  const media = intendedUsage.mediaRights || [];
  const mediaIds = media.map((m) => m.id).join(', ');
  row.appendChild(createCell(mediaIds || '-'));

  // AGENCYORTCCCASSOCIATE
  row.appendChild(createCell(agency.agencyOrTcccAssociate || '-'));

  // MARKETSCOVERED
  const marketNames = markets.map((m) => m.name).join(', ');
  row.appendChild(createCell(marketNames || '-'));

  // MEDIARIGHTS
  const mediaNames = media.map((m) => m.name).join(', ');
  row.appendChild(createCell(mediaNames || '-'));

  // ASSETPATHS - handle multiple formats
  let assetPaths = '';
  if (general.assetPaths && general.assetPaths.length > 0) {
    // Legacy format: array of path strings
    assetPaths = general.assetPaths.join(', ');
  } else if (general.assets && general.assets.length > 0) {
    // New format: array of asset objects with name/assetId
    // Try to get the most descriptive identifier from each asset
    assetPaths = general.assets.map((a) => a.name || a.assetPath || a.assetId || '').filter(Boolean).join(', ');
  }

  row.appendChild(createCell(assetPaths || '-'));

  return row;
}

/**
 * Create the data table with all requests
 * Uses filtered data if filters are active
 * @returns {HTMLElement} Table container element
 */
function createTable() {
  const tableContainer = document.createElement('div');
  tableContainer.className = 'report-table-container';

  const table = document.createElement('table');
  table.className = 'report-table';

  // Add header
  const thead = createTableHeader();
  table.appendChild(thead);

  // Add body
  const tbody = document.createElement('tbody');

  // Use filtered requests if filters are active
  const dataSource = isFilterActive() ? filteredRequests : allRequests;

  debug(`Creating table with ${dataSource.length} rows (filter active: ${isFilterActive()}, total: ${allRequests.length})`);

  if (dataSource.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = CONFIG.TABLE_COLUMNS_COUNT;
    emptyCell.className = 'empty-state';
    emptyCell.textContent = isFilterActive()
      ? 'No rights requests match the selected filters'
      : 'No rights requests found';
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
  } else {
    dataSource.forEach((request) => {
      const row = createTableRow(request);
      tbody.appendChild(row);
    });
  }

  table.appendChild(tbody);
  tableContainer.appendChild(table);
  return tableContainer;
}

/**
 * Main decorate function - initializes the rights requests report
 * Loads data, creates UI elements, and initializes charts
 * @param {HTMLElement} block - The block element to decorate
 */
export default async function decorate(block) {
  block.innerHTML = '';

  // Create main container
  const container = document.createElement('div');
  container.className = 'report-container';

  // Create header
  const header = document.createElement('div');
  header.className = 'report-header';

  const title = document.createElement('h1');
  title.className = 'report-title';
  title.textContent = 'Rights Requests Report';

  const controls = document.createElement('div');
  controls.className = 'report-controls';

  const exportButton = document.createElement('button');
  exportButton.className = 'export-button';
  exportButton.textContent = 'Download CSV';
  exportButton.addEventListener('click', exportToCSV);

  controls.appendChild(exportButton);
  header.appendChild(title);
  header.appendChild(controls);
  container.appendChild(header);

  // Show loading state
  const loading = document.createElement('div');
  loading.className = 'loading-state';
  loading.textContent = 'Loading rights requests...';
  container.appendChild(loading);

  block.appendChild(container);

  // Load data and Chart.js in parallel
  try {
    await Promise.all([loadAllRightsRequests(), loadChartJs()]);
    loading.remove();

    // Initialize filtered requests (start with all data)
    filteredRequests = [...allRequests];

    // Add filters section
    const filters = createFiltersSection();
    container.appendChild(filters);

    // Add summary section with charts
    const summary = createSummarySection();
    container.appendChild(summary);

    // Initialize charts (after DOM is ready)
    setTimeout(() => {
      initializeCharts();
    }, CONFIG.CHART_INIT_DELAY_LONG);

    // Add count
    const countText = document.createElement('div');
    countText.className = 'report-count';
    countText.innerHTML = `Showing <strong>${allRequests.length}</strong> total requests`;
    container.appendChild(countText);

    // Create and add table
    const table = createTable();
    container.appendChild(table);
  } catch (error) {
    loading.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.textContent = `Failed to load rights requests: ${error.message}`;
    container.appendChild(errorDiv);
  }
}
