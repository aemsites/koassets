/**
 * Constants for rights request and asset clearance functionality
 */

/**
 * Asset clearance status types
 */
export const CLEARANCE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  NOT_AVAILABLE: 'NOT AVAILABLE',
  AVAILABLE_WITH_EXCEPTIONS: 'AVAILABLE WITH EXCEPTIONS',
  AVAILABLE_EXCEPT: 'AVAILABLE_EXCEPT', // Alias for API compatibility
  PARTIALLY_CLEARED: 'PARTIALLY CLEARED',
};

/**
 * Rights request status types
 */
export const REQUEST_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  QUOTE_PENDING: 'Quote Pending',
  RELEASE_PENDING: 'Release Pending',
  DONE: 'Done',
  COMPLETED: 'Completed',
  USER_CANCELED: 'User Canceled',
  RM_CANCELED: 'RM Canceled',
};

/**
 * Asset preview image settings
 */
export const ASSET_PREVIEW = {
  DEFAULT_WIDTH: 350,
  DEFAULT_FORMAT: 'jpg',
  DEFAULT_FILENAME: 'thumbnail',
};

/**
 * Rights request ID prefix
 */
export const REQUEST_ID_PREFIX = 'rights-request-';
