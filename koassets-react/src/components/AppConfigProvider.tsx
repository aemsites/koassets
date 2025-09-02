import React from 'react';
import type { DynamicMediaClient } from '../clients/dynamicmedia-client';
import { AppConfigContext } from '../contexts/AppConfigContext';
import type { Asset, ExternalParams, Rendition } from '../types';

interface AppConfigProviderProps {
    children: React.ReactNode;
    externalParams: ExternalParams;
    dynamicMediaClient: DynamicMediaClient | null;
    fetchAssetRenditions?: (asset: Asset) => Promise<void>;
    imagePresets?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    // Add more config parameters here as needed
}

export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({
    children,
    externalParams,
    dynamicMediaClient,
    fetchAssetRenditions,
    imagePresets
}) => {
    return (
        <AppConfigContext.Provider value={{
            externalParams,
            dynamicMediaClient,
            fetchAssetRenditions,
            imagePresets
            // Add more config values here as needed
        }}>
            {children}
        </AppConfigContext.Provider>
    );
};
