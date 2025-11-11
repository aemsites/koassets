/**
 * Notifications API endpoints
 * Provides RESTful CRUD operations for the MESSAGES KV namespace
 */

import { json, error } from 'itty-router';

/**
 * Main Notifications API handler - routes requests to appropriate endpoint
 */
export async function notificationsApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Extract notification ID from path if present
  // Path format: /api/messages or /api/messages/<notificationId>
  const pathParts = path.split('/').filter(Boolean);
  const notificationId = pathParts.length > 2 ? pathParts[2] : null;

  // Route based on method and presence of notificationId
  if (method === 'GET' && !notificationId) {
    return listNotifications(request, env);
  }
  if (method === 'GET' && notificationId) {
    return getNotification(request, env, notificationId);
  }
  if (method === 'POST' && !notificationId) {
    return createNotification(request, env);
  }
  if (method === 'POST' && notificationId) {
    return updateNotification(request, env, notificationId);
  }
  if (method === 'DELETE' && notificationId) {
    return deleteNotification(request, env, notificationId);
  }

  return error(404, { success: false, error: 'Notifications endpoint not found' });
}

/**
 * Get current user email from request
 * @param {Request} request - Request object
 * @returns {string} User email
 */
function getUserEmail(request) {
  // User email should be available from authentication middleware
  return request.user?.email || '';
}

/**
 * Build KV key for a notification
 * @param {string} userEmail - User email
 * @param {string} notificationId - Notification ID
 * @returns {string} KV key
 */
function buildNotificationKey(userEmail, notificationId) {
  return `${userEmail}:${notificationId}`;
}

/**
 * List all notifications for the current user
 * GET /api/messages
 */
export async function listNotifications(request, env) {
  try {
    const userEmail = getUserEmail(request);
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    // List all keys with user email prefix
    const prefix = `${userEmail}:`;
    const { keys } = await env.MESSAGES.list({ prefix, limit: 1000 });

    // Fetch all notification values in parallel
    const notificationPromises = keys.map(async (key) => {
      const value = await env.MESSAGES.get(key.name, { type: 'text' });
      if (value) {
        try {
          return JSON.parse(value);
        } catch (e) {
          console.error(`Failed to parse notification ${key.name}:`, e);
          return null;
        }
      }
      return null;
    });

    const notifications = (await Promise.all(notificationPromises)).filter((msg) => msg !== null);

    return json({
      success: true,
      messages: notifications,
      count: notifications.length,
    });
  } catch (err) {
    console.error('Error listing notifications:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Get a specific notification by ID
 * GET /api/messages/<notificationId>
 */
export async function getNotification(request, env, notificationId) {
  try {
    const userEmail = getUserEmail(request);
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const key = buildNotificationKey(userEmail, notificationId);
    const value = await env.MESSAGES.get(key, { type: 'text' });

    if (value === null) {
      return error(404, { success: false, error: 'Notification not found' });
    }

    let notification;
    try {
      notification = JSON.parse(value);
    } catch (e) {
      return error(500, { success: false, error: 'Failed to parse notification' });
    }

    return json({
      success: true,
      message: notification,
    });
  } catch (err) {
    console.error('Error getting notification:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Create a new notification
 * POST /api/messages
 * Body: { id, subject, message, type, from, priority, expiresInXDays, status }
 */
export async function createNotification(request, env) {
  try {
    const userEmail = getUserEmail(request);
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const body = await request.json();
    const {
      id, subject, message, type, from, priority, expiresInXDays, status,
    } = body;

    // Validate required fields
    if (!id || !subject || !message) {
      return error(400, { success: false, error: 'Missing required fields: id, subject, message' });
    }

    // Build notification object
    const notificationData = {
      id,
      owner: userEmail,
      date: new Date().toISOString(),
      subject,
      message,
      type: type || 'Notification',
      from: from || 'system@coca-cola.com',
      priority: priority || 'normal',
      expiresInXDays: expiresInXDays !== undefined ? expiresInXDays : 30,
      status: status || 'unread',
    };

    const key = buildNotificationKey(userEmail, id);
    const value = JSON.stringify(notificationData);

    // Store in KV with metadata
    await env.MESSAGES.put(key, value, {
      metadata: {
        priority: notificationData.priority,
        status: notificationData.status,
        type: notificationData.type,
      },
    });

    return json({
      success: true,
      message: notificationData,
    });
  } catch (err) {
    console.error('Error creating notification:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Update an existing notification
 * POST /api/messages/<notificationId>
 * Body: { status?, subject?, message?, priority?, ... }
 */
export async function updateNotification(request, env, notificationId) {
  try {
    const userEmail = getUserEmail(request);
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const key = buildNotificationKey(userEmail, notificationId);

    // Get existing notification
    const existingValue = await env.MESSAGES.get(key, { type: 'text' });
    if (existingValue === null) {
      return error(404, { success: false, error: 'Notification not found' });
    }

    let existingNotification;
    try {
      existingNotification = JSON.parse(existingValue);
    } catch (e) {
      return error(500, { success: false, error: 'Failed to parse existing notification' });
    }

    // Get updates from request body
    const updates = await request.json();

    // Merge updates with existing notification
    const updatedNotification = {
      ...existingNotification,
      ...updates,
      // Ensure these fields cannot be changed via update
      id: existingNotification.id,
      owner: existingNotification.owner,
      date: existingNotification.date,
    };

    const value = JSON.stringify(updatedNotification);

    // Update in KV with new metadata
    await env.MESSAGES.put(key, value, {
      metadata: {
        priority: updatedNotification.priority,
        status: updatedNotification.status,
        type: updatedNotification.type,
      },
    });

    return json({
      success: true,
      message: updatedNotification,
    });
  } catch (err) {
    console.error('Error updating notification:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Delete a notification
 * DELETE /api/messages/<notificationId>
 */
export async function deleteNotification(request, env, notificationId) {
  try {
    const userEmail = getUserEmail(request);
    if (!userEmail) {
      return error(401, { success: false, error: 'User not authenticated' });
    }

    const key = buildNotificationKey(userEmail, notificationId);

    // Check if notification exists before deleting
    const existing = await env.MESSAGES.get(key);
    if (existing === null) {
      return error(404, { success: false, error: 'Notification not found' });
    }

    await env.MESSAGES.delete(key);

    return json({
      success: true,
      message: 'Notification deleted successfully',
      notificationId,
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    return error(500, { success: false, error: err.message });
  }
}


