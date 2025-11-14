/**
 * Utility module for managing toggle state persistence in local storage
 */

// Local storage keys
const STORAGE_KEYS = {
    SEARCH_EXPAND_ALL_DETAILS: 'koassets_search_expandAllDetails',
    DETAILS_COLLAPSE_ALL: 'koassets_details_collapseAll',
} as const;

/**
 * Save the search page "Show full details" toggle state
 * @param expandAllDetails - Whether full details should be expanded
 */
export function saveSearchExpandAllDetailsState(expandAllDetails: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEYS.SEARCH_EXPAND_ALL_DETAILS, JSON.stringify(expandAllDetails));
    } catch (error) {
        console.warn('Failed to save search expandAllDetails state to localStorage:', error);
    }
}

/**
 * Load the search page "Show full details" toggle state
 * @param defaultValue - Default value if nothing is stored (default: true)
 * @returns The stored state or the default value
 */
export function loadSearchExpandAllDetailsState(defaultValue = true): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SEARCH_EXPAND_ALL_DETAILS);
        if (stored !== null) {
            return JSON.parse(stored) as boolean;
        }
    } catch (error) {
        console.warn('Failed to load search expandAllDetails state from localStorage:', error);
    }
    return defaultValue;
}

/**
 * Save the details page "Collapse All" toggle state
 * @param collapseAll - Whether all sections should be collapsed
 */
export function saveDetailsCollapseAllState(collapseAll: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEYS.DETAILS_COLLAPSE_ALL, JSON.stringify(collapseAll));
    } catch (error) {
        console.warn('Failed to save details collapseAll state to localStorage:', error);
    }
}

/**
 * Load the details page "Collapse All" toggle state
 * @param defaultValue - Default value if nothing is stored (default: false)
 * @returns The stored state or the default value
 */
export function loadDetailsCollapseAllState(defaultValue = false): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.DETAILS_COLLAPSE_ALL);
        if (stored !== null) {
            return JSON.parse(stored) as boolean;
        }
    } catch (error) {
        console.warn('Failed to load details collapseAll state from localStorage:', error);
    }
    return defaultValue;
}

