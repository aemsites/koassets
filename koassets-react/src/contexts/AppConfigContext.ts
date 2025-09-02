import { createContext } from 'react';
import type { DynamicMediaClient } from '../clients/dynamicmedia-client';
import type { Asset, ExternalParams, Rendition } from '../types';

export interface AppConfigContextType {
    externalParams: ExternalParams;
    dynamicMediaClient: DynamicMediaClient | null;
    fetchAssetRenditions?: (asset: Asset) => Promise<void>;
    imagePresets?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    // Add more config parameters here as needed
    // otherConfig?: SomeType[];
}

export const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);
