// Utility to get configuration values at runtime
// This checks window.APP_CONFIG first (runtime), then falls back to build-time env vars

import type { ExternalParams } from '../types';

declare global {
    interface Window {
        APP_CONFIG?: {
            ADOBE_CLIENT_ID?: string;
            BUCKET?: string;
            FADEL_BASE_URL?: string;
            FADEL_USERNAME?: string;
            FADEL_PASSWORD?: string;
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
        FADEL_BASE_URL: runtimeConfig.FADEL_BASE_URL || '',
        FADEL_USERNAME: runtimeConfig.FADEL_USERNAME || '',
        FADEL_PASSWORD: runtimeConfig.FADEL_PASSWORD || '',
    };
};

// Convenience functions for specific config values
export const getAdobeClientId = (): string => getConfig().ADOBE_CLIENT_ID;
export const getBucket = (): string => getConfig().BUCKET;
export const getFadelBaseUrl = (): string => getConfig().FADEL_BASE_URL;
export const getFadelUsername = (): string => getConfig().FADEL_USERNAME;
export const getFadelPassword = (): string => getConfig().FADEL_PASSWORD;


// Utility to get external parameters from KOAssetsConfig
export const getExternalParams = (): ExternalParams => {
    try {
        return window.KOAssetsConfig?.externalParams || {};
    } catch {
        return {};
    }
}; 