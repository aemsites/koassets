/**
 * Rights Requests API endpoints
 * Provides access to rights request data for authenticated users
 * All data is stored in Cloudflare KV stores
 */

import { json, error } from 'itty-router';
import { sendMessage, sendMessageToMultiple } from '../util/notifications-helpers.js';
import { fetchHelixSheet } from '../util/helixutil.js';

// Rights Reviewers - users who receive notifications for new requests
// NOTE: This hardcoded list is used for notification distribution only.
// Actual reviewer permissions are managed in /config/access/permissions sheet.
// Users with 'rights-reviewer' permissions can review requests.
// Users with 'rights-manager' permissions can assign requests to reviewers.
const RIGHTS_REVIEWERS = [
  'jfait@adobe.com',
  'pkoch@adobe.com',
  'inedoviesov@adobe.com'
  // Add more reviewers here
];

// Rights Request Status Constants
const RIGHTS_REQUEST_STATUSES = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  RM_CANCELED: 'RM Canceled',
  QUOTE_PENDING: 'Quote Pending',
  RELEASE_PENDING: 'Release Pending',
  DONE: 'Done',
  USER_CANCELED: 'User Canceled',
};

// Valid statuses for reviewers to set
const REVIEWER_STATUSES = [
  RIGHTS_REQUEST_STATUSES.IN_PROGRESS,
  RIGHTS_REQUEST_STATUSES.USER_CANCELED,
  RIGHTS_REQUEST_STATUSES.RM_CANCELED,
  RIGHTS_REQUEST_STATUSES.QUOTE_PENDING,
  RIGHTS_REQUEST_STATUSES.RELEASE_PENDING,
  RIGHTS_REQUEST_STATUSES.DONE,
];

// Valid statuses for submitters to set
const SUBMITTER_STATUSES = [
  RIGHTS_REQUEST_STATUSES.USER_CANCELED,
];

// Permission Constants
const PERMISSIONS = {
  RIGHTS_REVIEWER: 'rights-reviewer',  // Base: can review and self-assign
  RIGHTS_MANAGER: 'rights-manager',    // Supervisory: can assign to reviewers
  REPORTS_ADMIN: 'reports-admin',
};

/**
 * Main Rights Requests API handler - routes requests to appropriate endpoint
 */
export async function rightsRequestsApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin report route (all requests)
  if (request.method === 'GET' && path.endsWith('/rightsrequests/all')) {
    return listAllRightsRequests(request, env);
  }

  // Request routes (submitter perspective)
  if (request.method === 'GET' && path.endsWith('/rightsrequests')) {
    return listRightsRequests(request, env);
  }
  if (request.method === 'POST' && path.endsWith('/rightsrequests')) {
    return createRightsRequest(request, env);
  }
  if (request.method === 'POST' && path.endsWith('/rightsrequests/status')) {
    return updateSubmitterRequestStatus(request, env);
  }

  // Review routes (reviewer perspective)
  if (request.method === 'GET' && path.endsWith('/rightsrequests/reviews/reviewers')) {
    return listAvailableReviewers(request, env);
  }
  if (request.method === 'GET' && path.endsWith('/rightsrequests/reviews')) {
    return listReviewsForReviewer(request, env);
  }
  if (request.method === 'POST' && path.endsWith('/rightsrequests/reviews/assign-to')) {
    return assignReviewToReviewer(request, env);
  }
  if (request.method === 'POST' && path.endsWith('/rightsrequests/reviews/assign')) {
    return assignReview(request, env);
  }
  if (request.method === 'POST' && path.endsWith('/rightsrequests/reviews/status')) {
    return updateReviewStatus(request, env);
  }

  return error(405, { success: false, error: 'Method not allowed' });
}

/**
 * Convert date to GMT string format matching sample data
 * @param {Date|string|number} date - Date to convert
 * @returns {string} - Formatted date string or empty string
 */
function formatDateToGMT(date) {
  if (!date) return '';

  try {
    let dateObj;

    // Handle different input types
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else if (typeof date === 'object') {
      // If it's already an object, return empty string
      return '';
    } else {
      return '';
    }

    // Check if date is valid
    if (Number.isNaN(dateObj.getTime())) {
      return '';
    }

    // Convert to UTC string (e.g., "Mon Jan 05 2026 00:00:00 GMT+0000")
    return dateObj.toUTCString().replace('GMT', 'GMT+0000');
  } catch (error) {
    return '';
  }
}

/**
 * Transform React format payload to JCR structure
 * Maps RequestRightsExtensionStepData + RequestDownloadStepData to JCR format
 */
function transformReactToJCR(payload, userEmail) {
  const requestId = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  const now = new Date().toUTCString();

  // Map React usageRightsRequired object {music: true, talent: false}
  // to array ['Music', 'Photographer']
  const usageRightsArray = [];
  if (payload.usageRightsRequired) {
    const mapping = {
      music: 'Music',
      talent: 'Talent',
      photographer: 'Photographer',
      voiceover: 'Voiceover',
      stockFootage: 'Stock Footage',
    };
    Object.entries(payload.usageRightsRequired).forEach(([key, value]) => {
      if (value) usageRightsArray.push(mapping[key]);
    });
  }

  return {
    rightsRequestID: requestId,
    rightsRequestSubmittedUserID: userEmail,
    created: now,
    createdBy: 'tccc-dam-user-service',
    lastModified: now,
    lastModifiedBy: userEmail,
    rightsRequestDetails: {
      name: payload.agencyName || '',
      general: {
        assets: payload.restrictedAssets?.map((asset) => ({
          name: asset.name || '',
          assetId: asset.assetId || '',
        })) || [],
      },
      intendedUsage: {
        rightsStartDate: formatDateToGMT(payload.airDate),
        rightsEndDate: formatDateToGMT(payload.pullDate),
        marketsCovered: payload.selectedMarkets?.map((m) => ({ name: m.name, id: String(m.id) })) || [],
        mediaRights: payload.selectedMediaChannels?.map((m) => ({ name: m.name, id: String(m.id) })) || [],
      },
      associateAgency: {
        agencyOrTcccAssociate: payload.agencyType || 'Associate',
        name: payload.agencyName || '',
        contactName: payload.contactName || '',
        emailAddress: payload.contactEmail || userEmail,
        phoneNumber: payload.contactPhone || '',
      },
      materialsNeeded: {
        dateRequiredBy: formatDateToGMT(payload.materialsRequiredDate),
        formatsRequiredBy: payload.formatsRequired || '',
        usageRightsRequired: usageRightsArray,
        associateOrAgencyUsers: [],
        plannedAdaptations: payload.adaptationIntention || '',
      },
      budgetForUsage: {
        budgetForMarket: payload.budgetForMarket || '',
        exceptionsOrNotes: payload.exceptionOrNotes || '',
      },
    },
    rightsRequestReviewDetails: {
      rightsRequestStatus: RIGHTS_REQUEST_STATUSES.NOT_STARTED,
      rightsReviewer: '',
      errorMessage: '',
    },
    rightsCheckResults: {},
  };
}

/**
 * Create a new rights request
 * POST /api/rightsrequests
 */
export async function createRightsRequest(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const payload = await request.json();
    const jcrData = transformReactToJCR(payload, userEmail);

    // Store in primary KV with key: user:{userId}:rights-request:{requestId}
    const kvKey = `user:${userEmail}:rights-request:${jcrData.rightsRequestID}`;
    await env.RIGHTS_REQUESTS.put(kvKey, JSON.stringify(jcrData));

    // Create unassigned review entry in secondary KV
    const reviewKey = `user:unassigned:rights-request-review:${jcrData.rightsRequestID}`;
    const reviewData = {
      requestId: kvKey,
      rightsReviewer: '',
      assignedDate: '',
      submittedBy: userEmail,
    };
    await env.RIGHTS_REQUEST_REVIEWS.put(reviewKey, JSON.stringify(reviewData));

    // Send notification messages to all reviewers
    const requestDetailsUrl = `${new URL(request.url).origin}/my-rights-review-details?requestId=${jcrData.rightsRequestID}`;
    const myReviewsUrl = `${new URL(request.url).origin}/my-rights-reviews`;

    await sendMessageToMultiple(env, RIGHTS_REVIEWERS, {
      subject: 'New Rights Review Request',
      message: `A new rights request has been submitted that requires review.\n\nRequest ID: ${jcrData.rightsRequestID}\nSubmitted by: ${userEmail}\n\nView request details: ${requestDetailsUrl}\n\nYou can assign this to yourself from your rights reviews page: ${myReviewsUrl}`,
      type: 'Notification',
      from: 'Rights Management System',
      priority: 'normal',
      expiresInXDays: 7,
    });

    return json({
      success: true,
      data: jcrData,
      message: 'Rights request created successfully',
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to create rights request',
      message: err.message,
    });
  }
}

/**
 * List available reviewers (users with rights-reviewer permission)
 * GET /api/rightsrequests/reviews/reviewers
 * Requires: PERMISSIONS.RIGHTS_MANAGER
 * Returns list of users who can be assigned as reviewers
 */
export async function listAvailableReviewers(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check if user has rights manager permission
    if (!hasRightsManagerPermission(request.user)) {
      return error(403, {
        success: false,
        error: 'Rights manager permission required',
        message: 'You do not have permission to view available reviewers',
      });
    }

    // Fetch permissions sheet to get users with rights-reviewer permission
    const permissions = await fetchHelixSheet(env, '/config/access/permissions', {
      sheet: { key: 'email', arrays: ['permissions'] },
    });

    if (!permissions) {
      return error(500, {
        success: false,
        error: 'Failed to load permissions configuration',
      });
    }

    // Find all users with rights-reviewer or legacy rights-manager permission
    const reviewers = [];
    Object.entries(permissions).forEach(([email, userData]) => {
      const userPermissions = userData.permissions || [];
      if (
        userPermissions.includes(PERMISSIONS.RIGHTS_REVIEWER) ||
        userPermissions.includes(PERMISSIONS.RIGHTS_MANAGER)
      ) {
        reviewers.push({
          email,
          permissions: userPermissions,
        });
      }
    });

    // Also include hardcoded RIGHTS_REVIEWERS for backwards compatibility
    // (these receive notifications but might not be in permissions sheet yet)
    RIGHTS_REVIEWERS.forEach((email) => {
      if (!reviewers.find((r) => r.email === email)) {
        reviewers.push({
          email,
          permissions: [PERMISSIONS.RIGHTS_REVIEWER],
          note: 'From notification list',
        });
      }
    });

    return json({
      success: true,
      data: reviewers,
      count: reviewers.length,
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to retrieve available reviewers',
      message: err.message,
    });
  }
}

/**
 * List reviews for the authenticated reviewer
 * GET /api/rightsrequests/reviews
 * Requires: rights-reviewer permission (or legacy rights-manager)
 */
export async function listReviewsForReviewer(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check if user has rights reviewer permission
    if (!hasRightsReviewerPermission(request.user)) {
      return error(403, {
        success: false,
        error: 'Rights reviewer permission required',
        message: 'You do not have permission to view rights reviews',
      });
    }

    // Get unassigned reviews
    const unassignedPrefix = 'user:unassigned:rights-request-review:';
    const unassignedList = await env.RIGHTS_REQUEST_REVIEWS.list({ prefix: unassignedPrefix });
    const unassignedReviews = await Promise.all(
      unassignedList.keys.map(async (key) => {
        const data = await env.RIGHTS_REQUEST_REVIEWS.get(key.name);
        return data ? JSON.parse(data) : null;
      }),
    );

    // Get reviews assigned to this user
    const assignedPrefix = `user:${userEmail}:rights-request-review:`;
    const assignedList = await env.RIGHTS_REQUEST_REVIEWS.list({ prefix: assignedPrefix });
    const assignedReviews = await Promise.all(
      assignedList.keys.map(async (key) => {
        const data = await env.RIGHTS_REQUEST_REVIEWS.get(key.name);
        return data ? JSON.parse(data) : null;
      }),
    );

    // Fetch full request data for each review
    const allReviews = [...unassignedReviews, ...assignedReviews].filter((r) => r !== null);
    const reviewsWithData = await Promise.all(
      allReviews.map(async (review) => {
        const requestData = await env.RIGHTS_REQUESTS.get(review.requestId);
        return requestData ? { ...JSON.parse(requestData), reviewInfo: review } : null;
      }),
    );

    // Convert to object with request IDs as keys
    const reviewsById = {};
    reviewsWithData.filter((r) => r !== null).forEach((req) => {
      const key = `rights-request-${req.rightsRequestID}`;
      reviewsById[key] = req;
    });

    return json({
      success: true,
      data: reviewsById,
      count: Object.keys(reviewsById).length,
      unassignedCount: unassignedReviews.length,
      assignedCount: assignedReviews.length,
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to retrieve reviews',
      message: err.message,
    });
  }
}

/**
 * Assign a rights request review to the authenticated reviewer (self-assignment)
 * POST /api/rightsrequests/reviews/assign
 * Body: { requestId: "1234567890" }
 * Requires: rights-reviewer permission (or legacy rights-manager)
 */
export async function assignReview(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check if user has rights reviewer permission
    if (!hasRightsReviewerPermission(request.user)) {
      return error(403, {
        success: false,
        error: 'Rights reviewer permission required',
        message: 'You do not have permission to assign rights reviews',
      });
    }

    const { requestId } = await request.json();
    if (!requestId) {
      return error(400, { success: false, error: 'Request ID is required' });
    }

    // Get the unassigned review entry
    const unassignedKey = `user:unassigned:rights-request-review:${requestId}`;
    const unassignedData = await env.RIGHTS_REQUEST_REVIEWS.get(unassignedKey);

    if (!unassignedData) {
      return error(404, { success: false, error: 'Unassigned review not found' });
    }

    const reviewData = JSON.parse(unassignedData);

    // Update the primary request with reviewer info
    const primaryRequestData = await env.RIGHTS_REQUESTS.get(reviewData.requestId);
    if (!primaryRequestData) {
      return error(404, { success: false, error: 'Request not found in primary store' });
    }

    const requestDataObj = JSON.parse(primaryRequestData);
    requestDataObj.rightsRequestReviewDetails.rightsReviewer = userEmail;
    requestDataObj.rightsRequestReviewDetails.rightsRequestStatus = RIGHTS_REQUEST_STATUSES.IN_PROGRESS;
    requestDataObj.lastModified = new Date().toUTCString();
    requestDataObj.lastModifiedBy = userEmail;

    // Save updated primary request
    await env.RIGHTS_REQUESTS.put(reviewData.requestId, JSON.stringify(requestDataObj));

    // Delete unassigned entry
    await env.RIGHTS_REQUEST_REVIEWS.delete(unassignedKey);

    // Create assigned entry
    const assignedKey = `user:${userEmail}:rights-request-review:${requestId}`;
    const assignedReviewData = {
      ...reviewData,
      rightsReviewer: userEmail,
      assignedDate: new Date().toISOString(),
    };
    await env.RIGHTS_REQUEST_REVIEWS.put(assignedKey, JSON.stringify(assignedReviewData));

    return json({
      success: true,
      data: requestDataObj,
      message: 'Review assigned successfully',
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to assign review',
      message: err.message,
    });
  }
}

/**
 * Assign a rights request review to a specific reviewer (senior reviewer only)
 * POST /api/rightsrequests/reviews/assign-to
 * Body: { requestId: "1234567890", assigneeEmail: "reviewer@example.com" }
 * Requires: PERMISSIONS.RIGHTS_MANAGER
 */
export async function assignReviewToReviewer(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check if user has rights manager permission
    if (!hasRightsManagerPermission(request.user)) {
      return error(403, {
        success: false,
        error: 'Rights manager permission required',
        message: 'You do not have permission to assign requests to other reviewers',
      });
    }

    const { requestId, assigneeEmail } = await request.json();
    if (!requestId || !assigneeEmail) {
      return error(400, {
        success: false,
        error: 'Request ID and assignee email are required',
      });
    }

    const assigneeEmailLower = assigneeEmail.toLowerCase();

    // Validate that assignee has rights reviewer permission
    const permissions = await fetchHelixSheet(env, '/config/access/permissions', {
      sheet: { key: 'email', arrays: ['permissions'] },
    });

    const assigneePerms = permissions?.[assigneeEmailLower]?.permissions || [];
    const isValidReviewer =
      assigneePerms.includes(PERMISSIONS.RIGHTS_REVIEWER) ||
      assigneePerms.includes(PERMISSIONS.RIGHTS_MANAGER) ||
      RIGHTS_REVIEWERS.includes(assigneeEmailLower);

    if (!isValidReviewer) {
      return error(400, {
        success: false,
        error: 'Invalid assignee',
        message: 'The specified user does not have rights reviewer permission',
      });
    }

    // Get the unassigned review entry
    const unassignedKey = `user:unassigned:rights-request-review:${requestId}`;
    const unassignedData = await env.RIGHTS_REQUEST_REVIEWS.get(unassignedKey);

    if (!unassignedData) {
      return error(404, {
        success: false,
        error: 'Unassigned review not found',
        message: 'This request may already be assigned',
      });
    }

    const reviewData = JSON.parse(unassignedData);

    // Update the primary request with reviewer info
    const primaryRequestData = await env.RIGHTS_REQUESTS.get(reviewData.requestId);
    if (!primaryRequestData) {
      return error(404, { success: false, error: 'Request not found in primary store' });
    }

    const requestDataObj = JSON.parse(primaryRequestData);
    requestDataObj.rightsRequestReviewDetails.rightsReviewer = assigneeEmailLower;
    requestDataObj.rightsRequestReviewDetails.rightsRequestStatus =
      RIGHTS_REQUEST_STATUSES.IN_PROGRESS;
    requestDataObj.lastModified = new Date().toUTCString();
    requestDataObj.lastModifiedBy = userEmail; // The senior reviewer who made the assignment

    // Save updated primary request
    await env.RIGHTS_REQUESTS.put(reviewData.requestId, JSON.stringify(requestDataObj));

    // Delete unassigned entry
    await env.RIGHTS_REQUEST_REVIEWS.delete(unassignedKey);

    // Create assigned entry for the assignee
    const assignedKey = `user:${assigneeEmailLower}:rights-request-review:${requestId}`;
    const assignedReviewData = {
      ...reviewData,
      rightsReviewer: assigneeEmailLower,
      assignedDate: new Date().toISOString(),
      assignedBy: userEmail, // Track who made the assignment
    };
    await env.RIGHTS_REQUEST_REVIEWS.put(assignedKey, JSON.stringify(assignedReviewData));

    // Send notification to the assigned reviewer
    const requestDetailsUrl = `${new URL(request.url).origin}/my-rights-review-details?requestId=${requestId}`;
    const myReviewsUrl = `${new URL(request.url).origin}/my-rights-reviews`;

    await sendMessage(env, assigneeEmailLower, {
      subject: 'Rights Request Assigned to You',
      message: `A rights request has been assigned to you by ${userEmail}.\n\nRequest ID: ${requestId}\nSubmitted by: ${reviewData.submittedBy}\n\nView request details: ${requestDetailsUrl}\n\nYou can see all your assigned requests from: ${myReviewsUrl}`,
      type: 'Notification',
      from: 'Rights Management System',
      priority: 'normal',
      expiresInXDays: 7,
    });

    return json({
      success: true,
      data: requestDataObj,
      message: `Review assigned to ${assigneeEmailLower} successfully`,
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to assign review',
      message: err.message,
    });
  }
}

/**
 * Helper function to update request status
 * @param {Object} env - Environment bindings
 * @param {string} requestKey - KV key for the request
 * @param {Object} requestData - Request data object
 * @param {string} status - New status
 * @param {string} userEmail - User email making the change
 * @returns {Promise<Object>} Updated request data
 */
async function updateRequestStatusHelper(env, requestKey, requestData, status, userEmail) {
  requestData.rightsRequestReviewDetails.rightsRequestStatus = status;
  requestData.lastModified = new Date().toUTCString();
  requestData.lastModifiedBy = userEmail;
  await env.RIGHTS_REQUESTS.put(requestKey, JSON.stringify(requestData));
  return requestData;
}

/**
 * Update review status for a rights request
 * POST /api/rightsrequests/reviews/status
 * Body: { requestId, status }
 * Requires: rights-reviewer permission (or legacy rights-manager)
 */
export async function updateReviewStatus(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check if user has rights reviewer permission
    if (!hasRightsReviewerPermission(request.user)) {
      return error(403, {
        success: false,
        error: 'Rights reviewer permission required',
        message: 'You do not have permission to update rights review status',
      });
    }

    const { requestId, status } = await request.json();
    if (!requestId || !status) {
      return error(400, { success: false, error: 'Request ID and status are required' });
    }

    if (!REVIEWER_STATUSES.includes(status)) {
      return error(400, { success: false, error: 'Invalid status' });
    }

    // Get the review entry for this user
    const reviewKey = `user:${userEmail}:rights-request-review:${requestId}`;
    const reviewData = await env.RIGHTS_REQUEST_REVIEWS.get(reviewKey);

    if (!reviewData) {
      return error(404, { success: false, error: 'Review not found or not assigned to you' });
    }

    const review = JSON.parse(reviewData);

    // Get the primary request data
    const primaryRequestData = await env.RIGHTS_REQUESTS.get(review.requestId);
    if (!primaryRequestData) {
      return error(404, { success: false, error: 'Request not found in primary store' });
    }

    const requestDataObj = JSON.parse(primaryRequestData);

    // Update status using helper
    const updatedData = await updateRequestStatusHelper(
      env,
      review.requestId,
      requestDataObj,
      status,
      userEmail,
    );

    // Send notification to submitter about status change
    const submitterEmail = requestDataObj.rightsRequestSubmittedUserID;
    const requestDetailsUrl = `${new URL(request.url).origin}/my-rights-review-details?requestId=${requestId}`;
    const myRequestsUrl = `${new URL(request.url).origin}/my-rights-requests`;

    await sendMessage(env, submitterEmail, {
      subject: 'Rights Request Status Update',
      message: `Your rights request status has been updated.\n\nRequest ID: ${requestId}\nNew Status: ${status}\n\nView request details: ${requestDetailsUrl}\n\nYou can see all your rights requests from your requests page: ${myRequestsUrl}`,
      type: 'Notification',
      from: 'Rights Management System',
      priority: 'normal',
      expiresInXDays: 7,
    });

    return json({
      success: true,
      data: updatedData,
      message: 'Status updated successfully',
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to update status',
      message: err.message,
    });
  }
}

/**
 * Update request status by submitter
 * POST /api/rightsrequests/status
 * Body: { requestId, status }
 * Submitters can only change status to 'User Canceled'
 */
export async function updateSubmitterRequestStatus(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const { requestId, status } = await request.json();
    if (!requestId || !status) {
      return error(400, { success: false, error: 'Request ID and status are required' });
    }

    if (!SUBMITTER_STATUSES.includes(status)) {
      return error(400, { success: false, error: 'Invalid status for submitter' });
    }

    // Get the primary request data
    const primaryRequestKey = `user:${userEmail}:rights-request:${requestId}`;
    const primaryRequestData = await env.RIGHTS_REQUESTS.get(primaryRequestKey);

    if (!primaryRequestData) {
      return error(404, { success: false, error: 'Request not found or not owned by you' });
    }

    const requestDataObj = JSON.parse(primaryRequestData);

    // Update status using helper
    await updateRequestStatusHelper(env, primaryRequestKey, requestDataObj, status, userEmail);

    // If there's a review entry (assigned or unassigned), update it too
    const reviewerEmail = requestDataObj.rightsRequestReviewDetails.rightsReviewer;

    if (reviewerEmail) {
      // Update assigned review entry
      const reviewKey = `user:${reviewerEmail}:rights-request-review:${requestId}`;
      const reviewData = await env.RIGHTS_REQUEST_REVIEWS.get(reviewKey);
      if (reviewData) {
        await env.RIGHTS_REQUEST_REVIEWS.put(reviewKey, reviewData);
      }
    } else {
      // Update unassigned review entry
      const unassignedReviewKey = `user:unassigned:rights-request-review:${requestId}`;
      const unassignedReviewData = await env.RIGHTS_REQUEST_REVIEWS.get(unassignedReviewKey);
      if (unassignedReviewData) {
        await env.RIGHTS_REQUEST_REVIEWS.put(unassignedReviewKey, unassignedReviewData);
      }
    }

    return json({
      success: true,
      data: requestDataObj,
      message: 'Request cancelled successfully',
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to update status',
      message: err.message,
    });
  }
}

/**
 * List all rights requests for the authenticated user
 * GET /api/rightsrequests
 */
export async function listRightsRequests(request, env) {
  try {
    // Get authenticated user email
    const userEmail = request.user?.email?.toLowerCase();

    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Get KV data (list keys with prefix, then fetch each)
    const kvPrefix = `user:${userEmail}:rights-request:`;
    const kvList = await env.RIGHTS_REQUESTS.list({ prefix: kvPrefix });
    const kvRequests = await Promise.all(
      kvList.keys.map(async (key) => {
        const data = await env.RIGHTS_REQUESTS.get(key.name);
        return data ? JSON.parse(data) : null;
      }),
    );

    // Filter out any null values and convert to object with request IDs as keys
    const requestsById = {};
    kvRequests.filter((r) => r !== null).forEach((req) => {
      const key = `rights-request-${req.rightsRequestID}`;
      requestsById[key] = req;
    });

    return json({
      success: true,
      data: requestsById,
      count: Object.keys(requestsById).length,
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to retrieve rights requests',
      message: err.message,
    });
  }
}

/**
 * Check if user has the required permission
 * @param {Object} user - User object from request
 * @param {string} requiredPermission - Permission string to check for
 * @returns {boolean} True if user has the required permission
 */
function isAuthorized(user, requiredPermission) {
  // Check if user has the required permission
  return user?.permissions?.includes(requiredPermission);
}

/**
 * Check if user has rights reviewer permission (base permission)
 * @param {Object} user - User object from request
 * @returns {boolean} True if user has rights reviewer permission
 */
function hasRightsReviewerPermission(user) {
  return user?.permissions?.includes(PERMISSIONS.RIGHTS_REVIEWER);
}

/**
 * Check if user has rights manager permission (supervisory role)
 * @param {Object} user - User object from request
 * @returns {boolean} True if user has rights manager permission
 */
function hasRightsManagerPermission(user) {
  return user?.permissions?.includes(PERMISSIONS.RIGHTS_MANAGER);
}

/**
 * List all rights requests across all users (admin report)
 * GET /api/rightsrequests/all
 * Requires: PERMISSIONS.REPORTS_ADMIN
 */
export async function listAllRightsRequests(request, env) {
  try {
    // Get authenticated user email
    const userEmail = request.user?.email?.toLowerCase();

    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // Check reports-admin permission
    if (!isAuthorized(request.user, PERMISSIONS.REPORTS_ADMIN)) {
      return error(403, {
        success: false,
        error: `${PERMISSIONS.REPORTS_ADMIN} permission required`,
        message: `You do not have the ${PERMISSIONS.REPORTS_ADMIN} permission to access this report`,
        // Temporary debug info - shows what roles and permissions the user has
        debug: {
          userEmail,
          isAdmin: request.user?.isAdmin,
          roles: request.user?.roles,
          role: request.user?.role,
          permissions: request.user?.permissions,
          allUserProperties: Object.keys(request.user || {}),
          requiredPermission: PERMISSIONS.REPORTS_ADMIN,
          note: `User needs: permissions array must include "${PERMISSIONS.REPORTS_ADMIN}"`,
        },
      });
    }

    // Get ALL keys from RIGHTS_REQUESTS KV store (no prefix to get everything)
    // This will return all requests regardless of key pattern
    const kvList = await env.RIGHTS_REQUESTS.list();

    // Fetch all requests
    const kvRequests = await Promise.all(
      kvList.keys.map(async (key) => {
        try {
          const data = await env.RIGHTS_REQUESTS.get(key.name);
          if (data) {
            const parsed = JSON.parse(data);
            // Include the KV key in the response
            return { ...parsed, kvKey: key.name };
          }
          return null;
        } catch (parseError) {
          // Log error but continue processing other keys
          // eslint-disable-next-line no-console
          console.error(`Error parsing data for key ${key.name}:`, parseError.message);
          return null;
        }
      }),
    );

    // Filter out any null values and convert to object
    // Use standardized keys (rights-request-ID) but preserve raw KV key in the data
    const requestsById = {};
    kvRequests.filter((r) => r !== null).forEach((req) => {
      // Use rights-request-ID as the key for consistency with other endpoints
      const standardKey = `rights-request-${req.rightsRequestID}`;
      requestsById[standardKey] = {
        ...req,
        // Keep both the raw KV key and standardized key for reference
        rawKvKey: req.kvKey,
      };
    });

    return json({
      success: true,
      data: requestsById,
      count: Object.keys(requestsById).length,
      totalKeys: kvList.keys.length,
    });
  } catch (err) {
    return error(500, {
      success: false,
      error: 'Failed to retrieve all rights requests',
      message: err.message,
    });
  }
}

