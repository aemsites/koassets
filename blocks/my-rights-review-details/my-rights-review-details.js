import { formatDate } from '../../scripts/rights-management/date-formatter.js';
import { ASSET_PREVIEW, REQUEST_ID_PREFIX } from '../../scripts/rights-management/rights-constants.js';

/**
 * Fetch request data by ID
 */
async function fetchRequestById(requestId) {
  try {
    // eslint-disable-next-line no-console
    console.trace(`Fetching request: ${requestId}`);

    // Try reviewer perspective first (includes reviewInfo)
    const reviewResponse = await fetch('/api/rightsrequests/reviews', {
      credentials: 'include',
    });

    if (reviewResponse.ok) {
      const reviewResult = await reviewResponse.json();
      const key = `${REQUEST_ID_PREFIX}${requestId}`;
      if (reviewResult.data && reviewResult.data[key]) {
        return reviewResult.data[key];
      }
    }

    // Fallback to submitter perspective
    const submitterResponse = await fetch('/api/rightsrequests', {
      credentials: 'include',
    });

    if (submitterResponse.ok) {
      const submitterResult = await submitterResponse.json();
      const key = `${REQUEST_ID_PREFIX}${requestId}`;
      if (submitterResult.data && submitterResult.data[key]) {
        return submitterResult.data[key];
      }
    }

    throw new Error('Request not found');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching request:', error);
    throw error;
  }
}

/**
 * Generate preview URL from asset ID and filename
 * @param {string} assetId - Asset ID
 * @param {string} fileName - File name (default: 'thumbnail')
 * @param {string} format - Image format (default: 'jpg')
 * @param {number} width - Image width (default: 350)
 * @returns {string} - Asset preview URL
 */
function buildAssetImageUrl(
  assetId,
  fileName = ASSET_PREVIEW.DEFAULT_FILENAME,
  format = ASSET_PREVIEW.DEFAULT_FORMAT,
  width = ASSET_PREVIEW.DEFAULT_WIDTH,
) {
  if (!assetId) return '';
  const cleanFileName = fileName.replace(/\.[^/.]+$/, '');
  const encodedFileName = encodeURIComponent(cleanFileName);
  return `/api/adobe/assets/${assetId}/as/${encodedFileName}.${format}?width=${width}`;
}

/**
 * Create detail field (label/value pair)
 */
function createDetailField(label, value) {
  const field = document.createElement('div');
  field.className = 'detail-field';

  const labelEl = document.createElement('div');
  labelEl.className = 'detail-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = 'detail-value';
  valueEl.textContent = value || 'N/A';

  field.appendChild(labelEl);
  field.appendChild(valueEl);

  return field;
}

/**
 * Create header section
 */
function createHeader(request) {
  const header = document.createElement('div');
  header.className = 'detail-header';

  const titleGroup = document.createElement('div');
  titleGroup.className = 'title-group';

  const title = document.createElement('h1');
  title.textContent = request.rightsRequestDetails?.name || 'Unnamed Request';

  const status = document.createElement('span');
  status.className = `status-badge status-${request.rightsRequestReviewDetails?.rightsRequestStatus?.toLowerCase().replace(/\s+/g, '-')}`;
  status.textContent = request.rightsRequestReviewDetails?.rightsRequestStatus || 'Not Started';

  titleGroup.appendChild(title);
  titleGroup.appendChild(status);

  const metadata = document.createElement('div');
  metadata.className = 'metadata';
  metadata.innerHTML = `
    <span><strong>Request ID:</strong> ${request.rightsRequestID}</span>
    <span><strong>Created:</strong> ${formatDate(request.created)}</span>
    <span><strong>Last Modified:</strong> ${formatDate(request.lastModified)}</span>
  `;

  header.appendChild(titleGroup);
  header.appendChild(metadata);

  return header;
}

/**
 * Create submitter info section
 */
function createSubmitterSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Submitter Information';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'fields-grid';

  const agency = request.rightsRequestDetails?.associateAgency || {};

  fieldsGrid.appendChild(createDetailField('Type', agency.agencyOrTcccAssociate));
  fieldsGrid.appendChild(createDetailField('Agency/Associate Name', agency.name));
  fieldsGrid.appendChild(createDetailField('Contact Name', agency.contactName));
  fieldsGrid.appendChild(createDetailField('Email', agency.emailAddress));
  fieldsGrid.appendChild(createDetailField('Phone', agency.phoneNumber));
  fieldsGrid.appendChild(createDetailField('Submitted By', request.rightsRequestSubmittedUserID));

  section.appendChild(sectionTitle);
  section.appendChild(fieldsGrid);

  return section;
}

/**
 * Create assets gallery section
 */
function createAssetsSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Assets';

  const assets = request.rightsRequestDetails?.general?.assets || [];

  if (assets.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'No assets in this request.';
    section.appendChild(sectionTitle);
    section.appendChild(empty);
    return section;
  }

  const gallery = document.createElement('div');
  gallery.className = 'assets-gallery';

  assets.forEach((asset) => {
    const assetCard = document.createElement('div');
    assetCard.className = 'asset-card';

    const img = document.createElement('img');
    img.src = buildAssetImageUrl(asset.assetId, asset.name);
    img.alt = asset.name;

    const assetName = document.createElement('div');
    assetName.className = 'asset-name';
    assetName.textContent = asset.name;

    assetCard.appendChild(img);
    assetCard.appendChild(assetName);

    // Make asset clickable to open asset details page
    assetCard.style.cursor = 'pointer';
    assetCard.addEventListener('click', () => {
      window.open(`/asset-details?assetid=${encodeURIComponent(asset.assetId)}`, '_blank');
    });

    gallery.appendChild(assetCard);
  });

  section.appendChild(sectionTitle);
  section.appendChild(gallery);

  return section;
}

/**
 * Create intended usage section
 */
function createIntendedUsageSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Intended Usage';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'fields-grid';

  const usage = request.rightsRequestDetails?.intendedUsage || {};

  fieldsGrid.appendChild(createDetailField('Rights Start Date', formatDate(usage.rightsStartDate)));
  fieldsGrid.appendChild(createDetailField('Rights End Date', formatDate(usage.rightsEndDate)));

  const markets = usage.marketsCovered?.map((m) => m.name).join(', ') || 'N/A';
  const marketField = createDetailField('Markets Covered', markets);
  marketField.classList.add('full-width');
  fieldsGrid.appendChild(marketField);

  const media = usage.mediaRights?.map((m) => m.name).join(', ') || 'N/A';
  const mediaField = createDetailField('Media Rights', media);
  mediaField.classList.add('full-width');
  fieldsGrid.appendChild(mediaField);

  section.appendChild(sectionTitle);
  section.appendChild(fieldsGrid);

  return section;
}

/**
 * Create materials needed section
 */
function createMaterialsSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Materials Needed';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'fields-grid';

  const materials = request.rightsRequestDetails?.materialsNeeded || {};

  fieldsGrid.appendChild(createDetailField('Date Required By', formatDate(materials.dateRequiredBy)));
  fieldsGrid.appendChild(createDetailField('Formats Required', materials.formatsRequiredBy));

  const usageRights = materials.usageRightsRequired?.join(', ') || 'N/A';
  const rightsField = createDetailField('Usage Rights Required', usageRights);
  rightsField.classList.add('full-width');
  fieldsGrid.appendChild(rightsField);

  const adaptations = createDetailField('Planned Adaptations', materials.plannedAdaptations);
  adaptations.classList.add('full-width');
  fieldsGrid.appendChild(adaptations);

  section.appendChild(sectionTitle);
  section.appendChild(fieldsGrid);

  return section;
}

/**
 * Create budget section
 */
function createBudgetSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Budget Information';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'fields-grid';

  const budget = request.rightsRequestDetails?.budgetForUsage || {};

  fieldsGrid.appendChild(createDetailField('Budget for Market', budget.budgetForMarket));

  const notes = createDetailField('Exceptions/Notes', budget.exceptionsOrNotes);
  notes.classList.add('full-width');
  fieldsGrid.appendChild(notes);

  section.appendChild(sectionTitle);
  section.appendChild(fieldsGrid);

  return section;
}

/**
 * Create review status section
 */
function createReviewSection(request) {
  const section = document.createElement('div');
  section.className = 'detail-section';

  const sectionTitle = document.createElement('h2');
  sectionTitle.textContent = 'Review Status';

  const fieldsGrid = document.createElement('div');
  fieldsGrid.className = 'fields-grid';

  const review = request.rightsRequestReviewDetails || {};
  const reviewInfo = request.reviewInfo || {};

  fieldsGrid.appendChild(createDetailField('Status', review.rightsRequestStatus));
  fieldsGrid.appendChild(createDetailField('Assigned Reviewer', review.rightsReviewer || 'Unassigned'));

  if (reviewInfo.assignedDate) {
    fieldsGrid.appendChild(createDetailField('Assigned Date', formatDate(reviewInfo.assignedDate)));
  }

  if (review.errorMessage) {
    const errorField = createDetailField('Error Message', review.errorMessage);
    errorField.classList.add('full-width');
    fieldsGrid.appendChild(errorField);
  }

  section.appendChild(sectionTitle);
  section.appendChild(fieldsGrid);

  return section;
}

/**
 * Main decorate function
 */
export default async function decorate(block) {
  block.textContent = '';

  // Parse URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const requestId = urlParams.get('requestId');

  if (!requestId) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.innerHTML = '<h2>Error</h2><p>No request ID provided in URL.</p>';
    block.appendChild(errorDiv);
    return;
  }

  // Loading state
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-state';
  loadingDiv.textContent = 'Loading request details...';
  block.appendChild(loadingDiv);

  try {
    const request = await fetchRequestById(requestId);

    // Clear loading state
    block.textContent = '';

    // Create container
    const container = document.createElement('div');
    container.className = 'details-container';

    // Build all sections
    container.appendChild(createHeader(request));

    // Create two-column wrapper for submitter and reviewer
    const twoColumnWrapper = document.createElement('div');
    twoColumnWrapper.className = 'two-column-sections';
    twoColumnWrapper.appendChild(createSubmitterSection(request));
    twoColumnWrapper.appendChild(createReviewSection(request));
    container.appendChild(twoColumnWrapper);

    container.appendChild(createAssetsSection(request));
    container.appendChild(createIntendedUsageSection(request));
    container.appendChild(createMaterialsSection(request));
    container.appendChild(createBudgetSection(request));

    block.appendChild(container);
  } catch (error) {
    block.textContent = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.innerHTML = `<h2>Error</h2><p>Failed to load request: ${error.message}</p>`;
    block.appendChild(errorDiv);
  }
}
