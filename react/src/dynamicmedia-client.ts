import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AlgoliaSearchQuery } from './types';

interface DynamicMediaClientConfig {
    bucket: string;
    accessToken: string;
    baseURL?: string;
    apiKey?: string;
}

export interface SearchAssetsOptions {
    collectionId?: string | null;
    facets?: string[][];
    hitsPerPage?: number;
    page?: number;
}

export interface SearchCollectionsOptions {
    hitsPerPage?: number;
    page?: number;
}

interface AssetMetadata {
    assetId: string;
    title?: string;
    description?: string;
    fileType?: string;
    dimensions?: {
        width: number;
        height: number;
    };
    createdAt?: string;
    lastModified?: string;
    [key: string]: any;
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
                'Authorization': `Bearer ${this.accessToken}`
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
            hitsPerPage = 40,
            page = 0
        } = options;

        const combinedSelectedFacets = [...facets, ...(collectionId ? [[`collectionIds:${collectionId.split(':')[3]}`]] : [])];
        const indexName = this.getIndexName();

        return {
            "requests": [
                {
                    "indexName": indexName,
                    "params": {
                        "facets": [
                            "dc-format-label",
                            "dc-subject",
                            "repo-createDate",
                            "size",
                            "xcm-machineKeywords",
                            "xdm-campaignName"
                        ],
                        "facetFilters": combinedSelectedFacets,
                        "filters": "",
                        "highlightPostTag": "__/ais-highlight__",
                        "highlightPreTag": "__ais-highlight__",
                        "hitsPerPage": hitsPerPage,
                        "maxValuesPerFacet": 10,
                        "page": page,
                        "query": query || "",
                        "tagFilters": ""
                    }
                }
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
            hitsPerPage = 40,
            page = 0
        } = options;

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
                        "filters": ""
                    }
                }
            ]
        };
    }

    getSearchHeaders = () => {
        const xApiKey: string = this.bucket.includes('-cmstg') ? apiKey.STAGE : apiKey.PROD;
        return {
            'X-Api-Key': xApiKey,
            'x-adobe-accept-experimental': '1',
            'x-ch-request': 'search'
        };
    };

    async getMetadata(assetId: string, ifNoneMatch?: string): Promise<AssetMetadata> {
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
     * Search for assets with a cleaner API
     * @param query - The search query string
     * @param options - Search options (collection, facets, pagination)
     * @returns Promise with search results
     */
    async searchAssets(query: string, options: SearchAssetsOptions = {}): Promise<any> {
        const algoliaQuery = this.transformToAlgoliaSearchAssets(query, options);

        const config: AxiosRequestConfig = {
            url: '/adobe/assets/search',
            method: 'POST',
            data: algoliaQuery,
            headers: this.getSearchHeaders()
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
            headers: this.getSearchHeaders()
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
        const url = `https://${this.bucket}.adobeaemcloud.com/adobe/assets/${assetId}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch assetId "${assetId}": ${response.statusText}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            type: blob.type,
            data: `data:${blob.type};base64,${base64}`
        };
    }

    /**
     * Convert video file extensions to avif for optimal delivery
     * @private
     */
    private convertVideoExtensionToAvif(fileName: string): string {
        const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v', '3gp'];
        const lastDotIndex = fileName.lastIndexOf('.');

        if (lastDotIndex === -1) return fileName;

        const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
        const baseName = fileName.substring(0, lastDotIndex);

        if (videoExtensions.includes(extension)) {
            return `${baseName}.avif`;
        }

        return fileName;
    }

    async getOptimizedDeliveryBlob(assetId: string, repoName: string, width: number = 350) {
        // Convert video extensions to avif for optimal delivery
        const processedRepoName = this.convertVideoExtensionToAvif(repoName);

        const url = `https://${this.bucket}.adobeaemcloud.com/adobe/assets/${assetId}/as/preview-${processedRepoName}?width=${width}&preferwebp=true`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'x-ch-request': 'delivery'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch assetId "${assetId}": ${response.statusText}`);
        }

        return await response.blob();
    }

    async getOptimizedDeliveryUrl(assetId: string, repoName: string, width: number = 350) {
        // Convert video extensions to avif for optimal delivery
        const processedRepoName = this.convertVideoExtensionToAvif(repoName);

        return `https://${this.bucket}.adobeaemcloud.com/adobe/assets/${assetId}/as/preview-${processedRepoName}?width=${width}&preferwebp=true`;
    }
} 