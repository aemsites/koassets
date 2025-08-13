import type { DynamicMediaClient } from '../dynamicmedia-client';
import type { Asset } from '../types';

export const BLOB_CACHE_PREFIX = 'blob_cache_';
export const BLOB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface CachedBlobData {
    base64: string;
    timestamp: number;
    mimeType: string;
}

/**
 * Fetch optimized delivery blob with common error handling and blob URL creation
 */
export async function fetchOptimizedDeliveryBlob(
    dynamicMediaClient: DynamicMediaClient | null,
    asset: Asset,
    width: number,
    options: {
        cache?: boolean;
        cacheKey?: string;
        fallbackUrl?: string;
    } = {}
): Promise<string | null> {
    if (!dynamicMediaClient || !asset) {
        return options.fallbackUrl || null;
    }

    try {
        // Extract common asset properties
        const assetId = asset.assetId || '';
        const repoName = asset.name || 'N/A';

        // Check cache first if caching is enabled
        if (options.cache && options.cacheKey) {
            const cachedBlob = getBlobFromCache(options.cacheKey);
            if (cachedBlob) {
                return URL.createObjectURL(cachedBlob);
            }
        }

        // Fetch optimized delivery blob
        const blob = await dynamicMediaClient.getOptimizedDeliveryBlob(assetId, repoName, width);

        // Cache if requested
        if (options.cache && options.cacheKey) {
            await storeBlobInCache(options.cacheKey, blob);
        }

        // Create and return blob URL
        return URL.createObjectURL(blob);

    } catch (error) {
        console.error(`Error getting optimized delivery blob for asset ${asset.assetId}:`, error);
        // Return fallback URL if provided
        return options.fallbackUrl || null;
    }
}

export const storeBlobInCache = async (key: string, blob: Blob): Promise<void> => {
    try {
        const base64 = await blobToBase64(blob);
        const cacheData: CachedBlobData = {
            base64,
            timestamp: Date.now(),
            mimeType: blob.type
        };
        localStorage.setItem(BLOB_CACHE_PREFIX + key, JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Failed to cache blob:', error);
    }
};

export const getBlobFromCache = (key: string): Blob | null => {
    try {
        const cached = localStorage.getItem(BLOB_CACHE_PREFIX + key);
        if (!cached) return null;

        const cacheData: CachedBlobData = JSON.parse(cached);

        // Check if expired (24 hours)
        if (Date.now() - cacheData.timestamp > BLOB_CACHE_TTL) {
            localStorage.removeItem(BLOB_CACHE_PREFIX + key);
            return null;
        }

        return base64ToBlob(cacheData.base64, cacheData.mimeType);
    } catch (error) {
        console.warn('Failed to retrieve cached blob:', error);
        return null;
    }
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]; // Remove data:... prefix
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}; 