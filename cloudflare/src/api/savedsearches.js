/**
 * Saved Searches API endpoints
 * Provides CRUD operations for the SAVED_SEARCHES KV namespace
 */

import { json, error } from 'itty-router';

/**
 * Main Saved Searches API handler - routes requests to appropriate endpoint
 */
export async function savedSearchesApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.endsWith('/list')) return listKeys(request, env);
  if (path.endsWith('/get')) return getValue(request, env);
  if (path.endsWith('/set')) return setValue(request, env);
  if (path.endsWith('/delete')) return deleteKey(request, env);

  return error(404, { success: false, error: 'Saved searches endpoint not found' });
}

/**
 * List all keys in the KV store
 * GET /api/savedsearches/list?prefix=xxx&limit=100
 */
export async function listKeys(request, env) {
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const { keys } = await env.SAVED_SEARCHES.list({
      prefix,
      limit,
    });

    return json({
      success: true,
      keys: keys.map((key) => ({
        name: key.name,
        expiration: key.expiration,
        metadata: key.metadata,
      })),
      prefix,
      count: keys.length,
    });
  } catch (err) {
    console.error('Error listing keys:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Get a value from KV store
 * GET /api/savedsearches/get?key=xxx
 */
export async function getValue(request, env) {
  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!key) {
      return error(400, { success: false, error: 'Key is required' });
    }

    const value = await env.SAVED_SEARCHES.get(key, { type: 'text' });

    if (value === null) {
      return error(404, { success: false, error: 'Key not found' });
    }

    // Try to parse as JSON
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    return json({
      success: true,
      key,
      value: parsedValue,
      rawValue: value,
    });
  } catch (err) {
    console.error('Error getting value:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Set a value in KV store
 * POST /api/savedsearches/set
 * Body: { key: string, value: any, metadata?: any, expirationTtl?: number }
 */
export async function setValue(request, env) {
  try {
    const body = await request.json();
    const {
      key, value, metadata, expirationTtl,
    } = body;

    if (!key) {
      return error(400, { success: false, error: 'Key is required' });
    }

    if (value === undefined) {
      return error(400, { success: false, error: 'Value is required' });
    }

    // Convert value to string if it's an object
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    const options = {};
    if (metadata) {
      options.metadata = metadata;
    }
    if (expirationTtl) {
      options.expirationTtl = expirationTtl;
    }

    await env.SAVED_SEARCHES.put(key, stringValue, options);

    return json({
      success: true,
      key,
      message: 'Value set successfully',
    });
  } catch (err) {
    console.error('Error setting value:', err);
    return error(500, { success: false, error: err.message });
  }
}

/**
 * Delete a key from KV store
 * POST /api/savedsearches/delete
 * Body: { key: string }
 */
export async function deleteKey(request, env) {
  try {
    const body = await request.json();
    const { key } = body;
    if (!key) {
      return error(400, { success: false, error: 'Key is required' });
    }

    await env.SAVED_SEARCHES.delete(key);

    return json({
      success: true,
      key,
      message: 'Key deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting key:', err);
    return error(500, { success: false, error: err.message });
  }
}
