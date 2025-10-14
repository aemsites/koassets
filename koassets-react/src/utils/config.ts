// Utility to get configuration values at runtime
// This checks window.APP_CONFIG first (runtime), then falls back to build-time env vars

import type { ExternalParams } from '../types';

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