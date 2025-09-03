// Utility to get configuration values at runtime
// This checks window.APP_CONFIG first (runtime), then falls back to build-time env vars

import type { FadelApiConfig } from '../clients/fadel-api-client';
import type { ExternalParams } from '../types';

declare global {
    interface Window {
        APP_CONFIG?: {
            ADOBE_CLIENT_ID?: string;
            BUCKET?: string;
            RIGHTS_AUTH_API_URL?: string;
            RIGHTS_AUTH_API_TOKEN?: string;
            FADEL_ASSET_DETAILS_API_URL?: string;
            FADEL_AGREEMENT_DETAIL_API_URL?: string;
            TCCC_FADEL_CUSTOMER_NAME?: string;
            TCCC_FADEL_CONNECTOR_VERSION?: string;
            TCCC_FADEL_DOMAIN_NAME?: string;
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
        RIGHTS_AUTH_API_URL: runtimeConfig.RIGHTS_AUTH_API_URL || import.meta.env.VITE_RIGHTS_AUTH_API_URL || '',
        RIGHTS_AUTH_API_TOKEN: runtimeConfig.RIGHTS_AUTH_API_TOKEN || import.meta.env.VITE_RIGHTS_AUTH_API_TOKEN || '',
        FADEL_ASSET_DETAILS_API_URL: runtimeConfig.FADEL_ASSET_DETAILS_API_URL || import.meta.env.VITE_FADEL_ASSET_DETAILS_API_URL || '',
        FADEL_AGREEMENT_DETAIL_API_URL: runtimeConfig.FADEL_AGREEMENT_DETAIL_API_URL || import.meta.env.VITE_FADEL_AGREEMENT_DETAIL_API_URL || '',
        TCCC_FADEL_CUSTOMER_NAME: runtimeConfig.TCCC_FADEL_CUSTOMER_NAME || import.meta.env.VITE_TCCC_FADEL_CUSTOMER_NAME || '',
        TCCC_FADEL_CONNECTOR_VERSION: runtimeConfig.TCCC_FADEL_CONNECTOR_VERSION || import.meta.env.VITE_TCCC_FADEL_CONNECTOR_VERSION || '',
        TCCC_FADEL_DOMAIN_NAME: runtimeConfig.TCCC_FADEL_DOMAIN_NAME || import.meta.env.VITE_TCCC_FADEL_DOMAIN_NAME || '',
    };
};

// Convenience functions for specific config values
export const getAdobeClientId = (): string => getConfig().ADOBE_CLIENT_ID;
export const getBucket = (): string => getConfig().BUCKET;

// Fadel API convenience functions
export const getFadelConfig = (): FadelApiConfig => {
    const config = getConfig();
    return {
        baseUrl: config.FADEL_ASSET_DETAILS_API_URL.replace('/assets/externalassets', ''), // Extract base URL
        authUrl: config.RIGHTS_AUTH_API_URL,
        authToken: config.RIGHTS_AUTH_API_TOKEN,
        customerName: config.TCCC_FADEL_CUSTOMER_NAME,
        version: config.TCCC_FADEL_CONNECTOR_VERSION,
        domain: config.TCCC_FADEL_DOMAIN_NAME,
    };
};

export const getRightsAuthApiUrl = (): string => getConfig().RIGHTS_AUTH_API_URL;
export const getRightsAuthApiToken = (): string => getConfig().RIGHTS_AUTH_API_TOKEN;
export const getFadelAssetDetailsApiUrl = (): string => getConfig().FADEL_ASSET_DETAILS_API_URL;
export const getFadelAgreementDetailApiUrl = (): string => getConfig().FADEL_AGREEMENT_DETAIL_API_URL;
export const getTcccFadelCustomerName = (): string => getConfig().TCCC_FADEL_CUSTOMER_NAME;
export const getTcccFadelConnectorVersion = (): string => getConfig().TCCC_FADEL_CONNECTOR_VERSION;
export const getTcccFadelDomainName = (): string => getConfig().TCCC_FADEL_DOMAIN_NAME;

// Utility to get external parameters from KOAssetsConfig
export const getExternalParams = (): ExternalParams => {
    try {
        return window.KOAssetsConfig?.externalParams || {};
    } catch {
        return {};
    }
}; 