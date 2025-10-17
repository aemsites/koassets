// Utility to get configuration values at runtime
// This checks window.APP_CONFIG first (runtime), then falls back to build-time env vars

import type { ExternalParams } from '../types';
import { calendarDateToEpoch, epochToCalendarDate } from './formatters';
import type { RightsData } from '../types';
import type { DateValue } from 'react-aria-components';
import type { CalendarDate } from '@internationalized/date';

export const getConfig = () => {
    // Runtime config from window.APP_CONFIG (loaded from config.js)
    const runtimeConfig = window.APP_CONFIG || {};

    return {
        BUCKET: runtimeConfig.BUCKET || import.meta.env.VITE_BUCKET || '',
    };
};

// Convenience functions for specific config values
export const getBucket = (): string => getConfig().BUCKET;


// Utility to get external parameters from KOAssetsConfig
export const getExternalParams = (): ExternalParams => {
    try {
        return window.KOAssetsConfig?.externalParams || {};
    } catch {
        return {};
    }
};

// Session storage key for search filters
const SEARCH_FILTERS_KEY = 'koassets_search_filters';

// Serializable version of search filters state (for storage)
export interface SearchFiltersState {
    facetCheckedState: Record<string, Record<string, boolean>>;
    selectedNumericFilters: string[];
    rightsStartDate: number | null; // epoch timestamp
    rightsEndDate: number | null; // epoch timestamp
    selectedMarkets: RightsData[];
    selectedMediaChannels: RightsData[];
}

// Deserialized version of search filters state (loaded from storage)
export interface LoadedSearchFiltersState {
    facetCheckedState: Record<string, Record<string, boolean>>;
    selectedNumericFilters: string[];
    rightsStartDate: DateValue | null;
    rightsEndDate: DateValue | null;
    selectedMarkets: Set<RightsData>;
    selectedMediaChannels: Set<RightsData>;
}

/**
 * Saves search filters state to session storage as a single JSON object
 */
export const saveSearchFiltersToSession = (
    facetCheckedState: Record<string, Record<string, boolean>>,
    selectedNumericFilters: string[],
    rightsStartDate: DateValue | null,
    rightsEndDate: DateValue | null,
    selectedMarkets: Set<RightsData>,
    selectedMediaChannels: Set<RightsData>
): void => {
    try {
        const filtersState: SearchFiltersState = {
            facetCheckedState,
            selectedNumericFilters,
            rightsStartDate: rightsStartDate ? calendarDateToEpoch(rightsStartDate as unknown as CalendarDate) : null,
            rightsEndDate: rightsEndDate ? calendarDateToEpoch(rightsEndDate as unknown as CalendarDate) : null,
            selectedMarkets: Array.from(selectedMarkets),
            selectedMediaChannels: Array.from(selectedMediaChannels),
        };
        sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(filtersState));
    } catch (error) {
        console.error('Failed to save search filters to session storage:', error);
    }
};

/**
 * Loads search filters state from session storage
 */
export const loadSearchFiltersFromSession = (): LoadedSearchFiltersState | null => {
    try {
        const stored = sessionStorage.getItem(SEARCH_FILTERS_KEY);
        if (!stored) return null;

        const parsed: SearchFiltersState = JSON.parse(stored);
        return {
            facetCheckedState: parsed.facetCheckedState,
            selectedNumericFilters: parsed.selectedNumericFilters,
            rightsStartDate: parsed.rightsStartDate ? (epochToCalendarDate(parsed.rightsStartDate) as unknown as DateValue) : null,
            rightsEndDate: parsed.rightsEndDate ? (epochToCalendarDate(parsed.rightsEndDate) as unknown as DateValue) : null,
            selectedMarkets: new Set(parsed.selectedMarkets),
            selectedMediaChannels: new Set(parsed.selectedMediaChannels),
        };
    } catch (error) {
        console.error('Failed to load search filters from session storage:', error);
        return null;
    }
};

/**
 * Clears search filters from session storage
 */
export const clearSearchFiltersFromSession = (): void => {
    try {
        sessionStorage.removeItem(SEARCH_FILTERS_KEY);
    } catch (error) {
        console.error('Failed to clear search filters from session storage:', error);
    }
}; 