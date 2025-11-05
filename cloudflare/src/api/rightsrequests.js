/**
 * Rights Requests API endpoints
 * Provides access to rights request data for authenticated users
 * All data is stored in Cloudflare KV stores
 */

import { json, error } from 'itty-router';

/**
 * Main Rights Requests API handler - routes requests to appropriate endpoint
 */
export async function rightsRequestsApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

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
  if (request.method === 'GET' && path.endsWith('/rightsrequests/reviews')) {
    return listReviewsForReviewer(request, env);
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
      rightsRequestStatus: 'Not Started',
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
 * List reviews for the authenticated reviewer
 * GET /api/rightsrequests/reviews
 */
export async function listReviewsForReviewer(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
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
 * Assign a rights request review to the authenticated reviewer
 * POST /api/rightsrequests/reviews/assign
 * Body: { requestId: "1234567890" }
 */
export async function assignReview(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
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
    requestDataObj.rightsRequestReviewDetails.rightsRequestStatus = 'In Progress';
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
 * Update review status for a rights request
 * POST /api/rightsrequests/reviews/status
 * Body: { requestId, status }
 */
export async function updateReviewStatus(request, env) {
  try {
    const userEmail = request.user?.email?.toLowerCase();
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const { requestId, status } = await request.json();
    if (!requestId || !status) {
      return error(400, { success: false, error: 'Request ID and status are required' });
    }

    // Valid statuses for reviewers
    const validStatuses = [
      'In Progress',
      'RM Canceled',
      'Quote Pending',
      'Release Pending',
      'Done',
    ];

    if (!validStatuses.includes(status)) {
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

    // Update status
    requestDataObj.rightsRequestReviewDetails.rightsRequestStatus = status;
    requestDataObj.lastModified = new Date().toUTCString();
    requestDataObj.lastModifiedBy = userEmail;

    // Save updated primary request
    await env.RIGHTS_REQUESTS.put(review.requestId, JSON.stringify(requestDataObj));

    return json({
      success: true,
      data: requestDataObj,
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

    // Valid statuses for submitters
    const validStatuses = ['User Canceled'];

    if (!validStatuses.includes(status)) {
      return error(400, { success: false, error: 'Invalid status for submitter' });
    }

    // Get the primary request data
    const primaryRequestKey = `user:${userEmail}:rights-request:${requestId}`;
    const primaryRequestData = await env.RIGHTS_REQUESTS.get(primaryRequestKey);

    if (!primaryRequestData) {
      return error(404, { success: false, error: 'Request not found or not owned by you' });
    }

    const requestDataObj = JSON.parse(primaryRequestData);

    // Update status
    requestDataObj.rightsRequestReviewDetails.rightsRequestStatus = status;
    requestDataObj.lastModified = new Date().toUTCString();
    requestDataObj.lastModifiedBy = userEmail;

    // Save updated primary request
    await env.RIGHTS_REQUESTS.put(primaryRequestKey, JSON.stringify(requestDataObj));

    // If there's a review entry (assigned or unassigned), update it too
    const currentStatus = requestDataObj.rightsRequestReviewDetails.rightsRequestStatus;
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

