/**
 * Configuration for Rights Request Review statuses
 */

/**
 * All possible rights request statuses
 */
export const REQUEST_STATUSES = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  USER_CANCELED: 'User Canceled',
  RM_CANCELED: 'RM Canceled',
  QUOTE_PENDING: 'Quote Pending',
  RELEASE_PENDING: 'Release Pending',
  DONE: 'Done',
};

/**
 * Statuses that can be set by reviewers
 * Excludes "Not Started" (initial state) and "User Canceled" (submitter only)
 */
export const REVIEWER_CHANGEABLE_STATUSES = [
  REQUEST_STATUSES.IN_PROGRESS,
  REQUEST_STATUSES.RM_CANCELED,
  REQUEST_STATUSES.QUOTE_PENDING,
  REQUEST_STATUSES.RELEASE_PENDING,
  REQUEST_STATUSES.DONE,
];

/**
 * Statuses that can be set by submitters
 */
export const SUBMITTER_CHANGEABLE_STATUSES = [
  REQUEST_STATUSES.USER_CANCELED,
];

/**
 * Get available status options for a reviewer (excluding current status)
 * @param {string} currentStatus - The current status of the request
 * @returns {string[]} Array of available statuses
 */
export function getAvailableReviewerStatuses(currentStatus) {
  return REVIEWER_CHANGEABLE_STATUSES.filter((status) => status !== currentStatus);
}

/**
 * Get available status options for a submitter (excluding current status)
 * @param {string} currentStatus - The current status of the request
 * @returns {string[]} Array of available statuses
 */
export function getAvailableSubmitterStatuses(currentStatus) {
  return SUBMITTER_CHANGEABLE_STATUSES.filter((status) => status !== currentStatus);
}

/**
 * Convert status to CSS-friendly class name
 * @param {string} status - The status string
 * @returns {string} CSS class name
 */
export function getStatusClassName(status) {
  if (!status) return 'status-not-started';
  return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
}
