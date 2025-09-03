import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AlgoliaSearchQuery, AlgoliaSearchRequest, Asset, Rendition } from '../types';
import { mimeTypeToExtension } from '../utils/mimeTypeConverter';

export const ORIGINAL_RENDITION = 'original';

export interface AssetRenditionPair {
    asset: Asset;
    renditions: Rendition[];
}

export interface ArchiveData {
    id: string;
    format: string;
    submittedBy: string;
    submittedDate: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
    files: string[];
}

export interface ArchiveStatus {
    operation: string;
    status: number;
    description: string;
    data: ArchiveData;
}

interface DynamicMediaClientConfig {
    bucket: string;
    accessToken: string;
    baseURL?: string;
    apiKey?: string;
}

export interface SearchAssetsOptions {
    collectionId?: string | null;
    facets?: string[];
    facetFilters?: string[][];
    numericFilters?: string[];
    filters?: string[];
    hitsPerPage?: number;
    page?: number;
}

export interface SearchCollectionsOptions {
    hitsPerPage?: number;
    page?: number;
}

interface CollectionMetadata {
    title: string;
    description: string;
}

interface RepositoryMetadata {
    'repo-repositoryId': string;
    'repo-createDate': string;
    'repo-createdDate': string;
    'repo-createdBy': string;
    'repo-modifyDate': string;
    'repo-modifiedBy': string;
}

interface CollectionHit {
    collectionId: string;
    collectionMetadata: CollectionMetadata;
    repositoryMetadata: RepositoryMetadata;
    objectID: string;
    _highlightResult: {
        collectionId: {
            value: string;
            matchLevel: string;
            matchedWords: string[];
        };
        collectionMetadata: {
            title: {
                value: string;
                matchLevel: string;
                fullyHighlighted: boolean;
                matchedWords: string[];
            };
            description: {
                value: string;
                matchLevel: string;
                matchedWords: string[];
            };
        };
        repositoryMetadata: {
            [key: string]: {
                value: string;
                matchLevel: string;
                matchedWords: string[];
            };
        };
    };
}

interface CollectionSearchResults {
    results: Array<{
        page: number;
        nbHits: number;
        nbPages: number;
        hitsPerPage: number;
        processingTimeMS: number;
        facets: null;
        facets_stats: null;
        exhaustiveFacetsCount: null;
        query: string;
        params: string;
        hits: CollectionHit[];
        index: null;
        processed: null;
        queryID: null;
        explain: null;
        userData: null;
        appliedRules: null;
        exhaustiveNbHits: boolean;
        appliedRelevancyStrictness: null;
        nbSortedHits: null;
        renderingContent: Record<string, unknown>;
        offset: null;
        length: null;
        parsedQuery: null;
        abTestVariantID: null;
        indexUsed: null;
        serverUsed: null;
        automaticRadius: null;
        aroundLatLng: null;
        queryAfterRemoval: null;
    }>;
}

const apiKey: { [key: string]: string; } = {
    PROD: 'aem-assets-content-hub-1',
    STAGE: 'polaris-asset-search-api-key',
};

export class DynamicMediaClient {
    private readonly client: AxiosInstance;
    private readonly bucket: string;
    private readonly accessToken: string;

    constructor(config: DynamicMediaClientConfig) {
        this.bucket = config.bucket;
        this.accessToken = config.accessToken.replace(/^Bearer /, '');

        this.client = axios.create({
            baseURL: config.baseURL || `https://${this.bucket}.adobeaemcloud.com`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`,
                'x-api-key': this.bucket.includes('-cmstg') ? apiKey.STAGE : apiKey.PROD,
                'x-adobe-accept-experimental': '1'
            }
        });
    }

    // Extract index name from bucket (e.g., delivery-p92206-e211033-cmstg -> 92206-211033)
    private getIndexName(): string {
        const match = this.bucket?.match(/p(\d+)-e(\d+)/);
        if (!match) {
            throw new Error(`Invalid bucket format: ${this.bucket}`);
        }
        return match.slice(1).join('-');
    }

    /**
     * Transform search parameters into Algolia search query for assets
     */
    private transformToAlgoliaSearchAssets(
        query: string,
        options: SearchAssetsOptions = {}
    ): AlgoliaSearchQuery {
        const {
            collectionId,
            facets = [],
            facetFilters = [[]],
            numericFilters = [],
            filters = [],
            hitsPerPage = 24,
            page = 0
        } = options;

        const combinedSelectedFacetFilters = [...facetFilters, ...(collectionId ? [[`collectionIds:${collectionId.split(':')[3]}`]] : [])];
        const indexName = this.getIndexName();
        const nonExpiredAssetsFilter = this.getNonExpiredAssetsFilter();
        const filtersList = [`${nonExpiredAssetsFilter}`, ...filters]
          .filter(Boolean)                         // remove null/undefined/empty strings
          .map(f => `(${f})`)                      // wrap each condition in parentheses
          .join(" AND ")


        return {
            "requests": [
                {
                    "indexName": indexName,
                    "params": {
                        "facets": facets,
                        "facetFilters": combinedSelectedFacetFilters,
                        "numericFilters": numericFilters,
                        "filters": filtersList,
                        "highlightPostTag": "__/ais-highlight__",
                        "highlightPreTag": "__ais-highlight__",
                        "hitsPerPage": hitsPerPage,
                        "maxValuesPerFacet": 1000,
                        "page": page,
                        "query": query || "",
                        "tagFilters": ""
                    }
                },
                ...this.generateSubRequest(query, facetFilters, numericFilters)
            ]
        };
    }

    /**
     * Transform search parameters into Algolia search query for collections
     */
    private transformToAlgoliaSearchCollections(
        query: string,
        options: SearchCollectionsOptions = {}
    ): AlgoliaSearchQuery {
        const {
            hitsPerPage,
            page = 0
        } = options;

        if (!hitsPerPage) {
            throw new Error('hitsPerPage is required');
        }

        const indexName = this.getIndexName();

        return {
            "requests": [
                {
                    "indexName": `${indexName}_collections`,
                    "params": {
                        "facets": [],
                        "highlightPostTag": "__/ais-highlight__",
                        "highlightPreTag": "__ais-highlight__",
                        "hitsPerPage": hitsPerPage,
                        "page": page,
                        "query": query || "",
                        "tagFilters": "",
                        "filters": `(${this.getNonExpiredAssetsFilter()})`,
                    }
                }
            ]
        };
    }

    async getMetadata(assetId: string, ifNoneMatch?: string): Promise<Asset> {
        const config: AxiosRequestConfig = {
            url: `/adobe/assets/${assetId}/metadata`,
            method: 'GET'
        };

        if (ifNoneMatch) {
            config.headers = {
                'If-None-Match': ifNoneMatch
            };
        }

        try {
            const response = await this.client.request(config);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response?.status === 304) {
                    throw new Error('Asset metadata not modified');
                }
                throw new Error(`Failed to fetch metadata for assetId "${assetId}": ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Generate sub-requests for facet queries
     * @param facetFilters - Array of facet filter groups
     * @returns Array of sub-request objects
     */
    generateSubRequest(query: string, facetFilters: string[][], numericFilters: string[]): Array<AlgoliaSearchRequest> {
        const indexName = this.getIndexName();
        const nonExpiredAssetsFilter = this.getNonExpiredAssetsFilter();
        const requests = [];

        // Create a sub-request for each facet group
        for (let i = 0; i < facetFilters.length; i++) {
            const subFacetFilters = facetFilters[i];

            // Get all other groups (excluding current one) for facetFilters
            const otherGroups = facetFilters.filter((_, index) => index !== i);

            // Extract facet name from the first item in current group (part before ':')
            const facetName = subFacetFilters[0]?.split(':')[0] || '';

            const request = {
                indexName: indexName,
                params: {
                    analytics: false,
                    clickAnalytics: false,
                    facetFilters: otherGroups,
                    numericFilters: numericFilters || undefined,
                    facets: facetName,
                    filters: `(${nonExpiredAssetsFilter})`,
                    highlightPostTag: "__/ais-highlight__",
                    highlightPreTag: "__ais-highlight__",
                    hitsPerPage: 0,
                    maxValuesPerFacet: 1000,
                    page: 0,
                    query: query
                }
            };

            requests.push(request);

            if (numericFilters && numericFilters.length > 0) {
                const facetName = numericFilters[0]?.split(/[><=]+/)[0]?.trim() || '';
                const request = {
                    indexName: indexName,
                    params: {
                        analytics: false,
                        clickAnalytics: false,
                        facetFilters: facetFilters,
                        facets: facetName,
                        filters: `(${nonExpiredAssetsFilter})`,
                        highlightPostTag: "__/ais-highlight__",
                        highlightPreTag: "__ais-highlight__",
                        hitsPerPage: 0,
                        maxValuesPerFacet: 1000,
                        page: 0,
                        query: ""
                    }
                }
                requests.push(request);
            }
        }

        return requests;
    }

    /**
     * @returns {number} current epoch time.
     */
    private getSearchEpoch(): number {
        const currentDate = new Date();
        return Math.floor(currentDate.getTime() / 1000);
    }

    private getNonExpiredAssetsFilter(): string {
        return `is_pur-expirationDate = 0 OR pur-expirationDate > ${this.getSearchEpoch()}`;
    }

    /**
     * Search for assets using the provided query and options
     * @param query - The search query string
     * @param options - Search options (collection, facets, pagination)
     * @returns Promise with search results
     */
    async searchAssets(query: string, options: SearchAssetsOptions = {}): Promise<unknown> {
        const algoliaQuery = this.transformToAlgoliaSearchAssets(query, options);

        const config: AxiosRequestConfig = {
            url: '/adobe/assets/search',
            method: 'POST',
            data: algoliaQuery,
            headers: { 'x-ch-request': 'search' }
        };

        try {
            const response = await this.client.request(config);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to search assets: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Search for collections with a cleaner API
     * @param query - The search query string
     * @param options - Search options (pagination)
     * @returns Promise with collection search results
     */
    async searchCollections(query: string, options: SearchCollectionsOptions = {}): Promise<CollectionSearchResults> {
        const algoliaQuery = this.transformToAlgoliaSearchCollections(query, options);

        const config: AxiosRequestConfig = {
            url: '/adobe/assets/search',
            method: 'POST',
            data: algoliaQuery,
            headers: { 'x-ch-request': 'search' }
        };

        try {
            const response = await this.client.request(config);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to search collections: ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get image inline using assetId
     * @param assetId - The asset ID
     * @returns The image data as base64 string with type
     */
    async getImageBase64(assetId: string): Promise<{ type: string, data: string; }> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/${assetId}`,
                method: 'GET',
                responseType: 'blob'
            });

            const blob = response.data as Blob;
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            const base64 = btoa(binaryString);

            return {
                type: blob.type,
                data: `data:${blob.type};base64,${base64}`
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch assetId "${assetId}": ${error.message}`);
            }
            throw error;
        }
    }

    /**
     * Change file extension to supported preview format
     * @private
     */
    private changeToSupportedPreview(fileName: string): string {
        const lastDotIndex = fileName.lastIndexOf('.');

        if (lastDotIndex === -1) return fileName;

        const extension = fileName.substring(lastDotIndex + 1).toLowerCase()
            .replace(/(png)/, 'webp')
            .replace(/(mov|m3u8|mp4|mpeg|avi|asf|flv|m4v)/, 'jpg')
            .replace(/(tif)/, 'avif');
        const baseName = fileName.substring(0, lastDotIndex);

        return `${baseName}.${extension}`;
    }

    async getOptimizedDeliveryPreviewBlob(assetId: string, repoName: string, width: number = 350) {
        // Convert video extensions to avif for optimal delivery
        const processedRepoName = this.changeToSupportedPreview(repoName);

        try {
            const response = await this.client.request({
                url: `/adobe/assets/${assetId}/as/preview-${processedRepoName}`,
                method: 'GET',
                params: {
                    width: width,
                    preferwebp: true
                },
                headers: {
                    'x-ch-request': 'delivery'
                },
                responseType: 'blob'
            });

            return response.data as Blob;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch assetId "${assetId}": ${error.message}`);
            }
            throw error;
        }
    }

    async getOptimizedDeliveryPreviewUrl(assetId: string, repoName: string, width: number = 350) {
        // Convert video extensions to avif for optimal delivery
        const processedRepoName = this.changeToSupportedPreview(repoName);

        return `https://${this.bucket}.adobeaemcloud.com/adobe/assets/${assetId}/as/preview-${processedRepoName}?width=${width}&preferwebp=true`;
    }

    async getDownloadTokenResp(asset: Asset): Promise<{ token: string, expiryTime: number } | undefined> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/${asset?.assetId}/token`,
                method: 'GET'
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status !== 200) {
                return undefined;
            }
            throw error;
        }
    }

    async downloadAsset(asset: Asset, rendition: Rendition = { name: ORIGINAL_RENDITION }, isImagePreset: boolean = false) {
        const tokenResp = await this.getDownloadTokenResp(asset);

        let queryParams: Record<string, string> = {};

        // Extract filename and extension from asset name
        let finalFilename = asset?.name || '';
        if (!finalFilename) {
            // Create fallback filename with extension
            const baseFilename = `asset-${asset?.assetId}-${rendition?.name}`;
            if (asset?.format) {
                const extension = mimeTypeToExtension(asset?.format);
                finalFilename = extension ? `${baseFilename}.${extension}` : baseFilename;
            }
        }
        if (rendition && rendition.format && rendition.format !== asset?.format) {
            const lastDotIndex = finalFilename?.lastIndexOf('.');
            if (lastDotIndex && lastDotIndex > 0) {
                const nameWithoutExt = finalFilename?.substring(0, lastDotIndex);
                const newExtension = mimeTypeToExtension(rendition.format);
                if (newExtension) {
                    finalFilename = `${nameWithoutExt}.${newExtension}`;
                }
            } else {
                // No existing extension, add new one if available
                const newExtension = mimeTypeToExtension(rendition.format);
                if (newExtension) {
                    finalFilename = `${finalFilename}.${newExtension}`;
                }
            }
        }

        const nameWithoutExtension = asset?.name?.lastIndexOf('.') !== -1 ? asset?.name?.substring(0, asset?.name?.lastIndexOf('.')) : asset?.name;
        const renditionNameWithoutExtension = rendition?.name?.lastIndexOf('.') !== -1 ? rendition?.name?.substring(0, rendition?.name?.lastIndexOf('.')) : rendition?.name;
        let url: string;
        if (isImagePreset) {
            /* Sample rendition for imagePreset
            {
                "name": "viewsmall",
                "format": "jpeg,rgb",
                "dimensions": {
                    "width": 1000,
                    "height": 673
                }
            }
            */
            const extension = (rendition?.format?.split(',')[0] ? `.${rendition?.format?.split(',')[0]}` : '')
                || (asset?.name?.lastIndexOf('.') !== -1 ? `.${asset?.name?.substring(asset?.name?.lastIndexOf('.') + 1)}` : '');
            finalFilename = `${nameWithoutExtension}_${renditionNameWithoutExtension}${extension}`;
            url = `/adobe/assets/${asset?.assetId}/as/${finalFilename}`;
            queryParams = {
                preset: rendition?.name || '',
                attachment: 'true'
            };
        } else {
            /* Sample regular rendition
            {
                "name": "Watermark-Image.jpeg",
                "format": "image/jpeg",
                "size": 630474,
                "dimensions": {
                    "width": 1600,
                    "height": 3081
                }
            }
            */
            const extension = (rendition?.name?.lastIndexOf('.') !== -1 ? `.${rendition?.name?.substring(rendition?.name?.lastIndexOf('.') + 1)}` : '')
                || (asset?.name?.lastIndexOf('.') !== -1 ? `.${asset?.name?.substring(asset?.name?.lastIndexOf('.') + 1)}` : '');
            finalFilename = `${nameWithoutExtension}_${renditionNameWithoutExtension}${extension}`;
            url = `/adobe/assets/${asset?.assetId}/renditions/${rendition?.name}/as/${finalFilename}`;
        }

        if (tokenResp?.token && tokenResp?.expiryTime) {
            queryParams.token = tokenResp.token;
            queryParams.expiryTime = tokenResp.expiryTime.toString();
        }

        let blob: Blob;
        try {
            const response = await this.client.request({
                url: url,
                method: 'GET',
                params: queryParams,
                responseType: 'blob'
            });

            // Get binary data as blob
            blob = response.data as Blob;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to download assetId "${asset?.assetId}": ${error.message}`);
            }
            throw error;
        }

        // Trigger download using reusable method
        this.downloadFromBlob(blob, finalFilename);

        return blob;
    }

    async getAssetRenditions(asset: Asset): Promise<{ items?: Rendition[] }> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/${asset?.assetId}/renditions`,
                method: 'GET'
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch assetId "${asset?.assetId}": ${error.message}`);
            }
            throw error;
        }
    }

    async getAssetImagePresets(asset: Asset): Promise<{ items: Rendition[] }> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/imagePresets`,
                method: 'GET'
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch assetId "${asset?.assetId}": ${error.message}`);
            }
            throw error;
        }
    }

    async getImagePresets(): Promise<{ items: Rendition[] }> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/imagePresets`,
                method: 'GET'
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Failed to fetch image presets: ${error.message}`);
            }
            throw error;
        }
    }

    async downloadAssetsArchive(assetRenditionPairs: AssetRenditionPair[]): Promise<boolean> {
        try {
            const payload = {
                items: assetRenditionPairs.map(pair => ({
                    assetId: pair.asset.assetId,
                    includeRenditions: pair.renditions.map(rendition => rendition.name)
                }))
            };

            const response = await this.client.request({
                url: `/adobe/assets/archives`,
                method: 'POST',
                data: payload
            });

            const archiveId = response.data.id;

            // Poll for status until no longer processing
            let archiveStatus: ArchiveStatus | undefined;
            const maxRetries = 60; // Maximum 5 minutes (60 * 5s intervals)
            let retryCount = 0;

            do {
                archiveStatus = await this.getAssetsArchiveStatus(archiveId);

                if (archiveStatus?.data?.status === 'FAILED') {
                    return false;
                } else if (archiveStatus?.data?.status === 'COMPLETED') {
                    // Download all file URLs in parallel
                    archiveStatus.data.files.forEach(fileUrl => {
                        this.downloadFromUrl(fileUrl);
                    });
                    return true;
                }

                // Wait 5 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                retryCount++;

            } while (retryCount < maxRetries && archiveStatus?.data?.status === 'PROCESSING');

            return false;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status !== 200) {
                return false;
            }
            throw error;
        }
    }

    async getAssetsArchiveStatus(archiveId: string): Promise<ArchiveStatus | undefined> {
        try {
            const response = await this.client.request({
                url: `/adobe/assets/archives/${archiveId}/status`,
                method: 'GET'
            });

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status !== 200) {
                return undefined;
            }
            throw error;
        }
    }

    /**
     * Common method to trigger download by creating a link and clicking it
     * @private
     */
    private triggerDownload(href: string, filename: string, cleanup?: () => void): void {
        try {
            const link = document.createElement('a');
            link.href = href;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Call cleanup function if provided
            cleanup?.();
        } catch (error) {
            console.error('Failed to trigger download:', error);
            // Ensure cleanup is called even if download fails
            cleanup?.();
        }
    }

    /**
     * Download a file from a direct URL by creating a temporary link and triggering click
     * @private
     */
    private downloadFromUrl(url: string): void {
        try {
            // Extract filename from URL or use default
            const urlParts = url.split('/');
            const filename = urlParts[urlParts.length - 1]?.split('?')[0] || 'archive.zip';

            this.triggerDownload(url, filename);
        } catch (error) {
            console.error('Failed to download file from URL:', url, error);
        }
    }

    /**
     * Download a blob as a file by creating an object URL and triggering download
     * @private
     */
    private downloadFromBlob(blob: Blob, filename: string): void {
        let downloadUrl: string | null = null;
        try {
            // Create download URL and trigger download
            downloadUrl = URL.createObjectURL(blob);

            this.triggerDownload(downloadUrl, filename, () => {
                if (downloadUrl) {
                    URL.revokeObjectURL(downloadUrl);
                }
            });
        } catch (error) {
            console.error('Failed to download blob:', error);
            // Ensure cleanup even if error occurs
            if (downloadUrl) {
                URL.revokeObjectURL(downloadUrl);
            }
        }
    }


}
