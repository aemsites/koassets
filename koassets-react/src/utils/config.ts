// Utility to get configuration values at runtime
// This checks window.APP_CONFIG first (runtime), then falls back to build-time env vars

import type { ExternalParams } from '../types';

declare global {
    interface Window {
        APP_CONFIG?: {
            ADOBE_CLIENT_ID?: string;
            BUCKET?: string;
        };
        KOAssetsConfig?: {
            externalParams?: ExternalParams;
        };
    }
}

export const getConfig = () => {
    // Runtime config from window.APP_CONFIG (loaded from config.js)
    const runtimeConfig = window.APP_CONFIG || {};

    return {
        ADOBE_CLIENT_ID: runtimeConfig.ADOBE_CLIENT_ID || import.meta.env.VITE_ADOBE_CLIENT_ID || '',
        BUCKET: runtimeConfig.BUCKET || import.meta.env.VITE_BUCKET || '',
    };
};

// Convenience functions for specific config values
export const getAdobeClientId = (): string => getConfig().ADOBE_CLIENT_ID;
export const getBucket = (): string => getConfig().BUCKET;

// Utility to get external parameters from KOAssetsConfig
export const getExternalParams = (): ExternalParams => {
    try {
        return window.KOAssetsConfig?.externalParams || {};
    } catch {
        return {};
    }
}; 