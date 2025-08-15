import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../MainApp.css';
import { DynamicMediaClient } from '../dynamicmedia-client';
import { ExcClient } from '../exc-client';
import type {
    Asset,
    CartItem,
    Collection,
    CurrentView,
    LoadingState,
    SearchResult
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { getBucket } from '../utils/config';
import { formatDate, formatFileSize } from '../utils/formatters';

// Components
import CollectionGallery from './CollectionGallery';
import Facets from './Facets';
import Footer from './Footer';
import HeaderBar from './HeaderBar';
import ImageGallery from './ImageGallery';
import SearchBar from './SearchBar';

const searchAssetsTitle = 'Search Assets - where you can discover the company\'s latest and greatest content!';
const searchCollectionsTitle = 'My Collections';
const HITS_PER_PAGE = 24;

/**
 * Transforms excFacets object into a string array for search facets
 * @param excFacets - The facets object from EXC
 * @returns Array of facet keys for search
 */
function transformExcFacetsToHierarchyArray(excFacets: Record<string, unknown>): string[] {
    const facetKeys: string[] = [];

    Object.entries(excFacets).forEach(([key, value]) => {
        const facetValue = value as { type?: string };

        if (facetValue?.type !== 'tags') {
            // For non-tags types, append the entry key
            facetKeys.push(key);
        } else {
            // For tags type, append 10 hierarchy level keys
            for (let n = 0; n <= 9; n++) {
                facetKeys.push(`${key}.TCCC.#hierarchy.lvl${n}`);
            }
            facetKeys.push(`${key}.TCCC.#values`);
        }
    });

    return facetKeys;
}

// Safe extraction helpers for populateAssetFromHit
function safeStringField(hit: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const value = (hit as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value.toString();
    if (value && typeof value === 'object') return 'ERROR';
    return fallback;
}

function safeStringFromCandidates(hit: Record<string, unknown>, keys: string[], fallback: string = 'N/A'): string {
    let sawObject = false;
    for (const key of keys) {
        // Normalize extraction using safeStringField
        const candidate = safeStringField(hit, key, fallback);
        if (candidate === 'ERROR') {
            sawObject = true;
            continue;
        }
        if (candidate !== '') {
            return candidate;
        }
    }
    return sawObject ? 'ERROR' : fallback;
}

function safeNumberField(hit: Record<string, unknown>, key: string, fallback: number = 0): number {
    const value = (hit as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : fallback;
}

function safeDateField(hit: Record<string, unknown>, key: string): string {
    const value = (hit as Record<string, unknown>)[key];
    if (typeof value === 'number') {
        return formatDate(value);
    }
    if (typeof value === 'string') {
        // Numeric string (epoch in seconds or ms)
        if (/^\d+$/.test(value)) {
            return formatDate(parseInt(value, 10));
        }
        // ISO-like string -> parse to ms
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) {
            return formatDate(ms);
        }
    }
    return 'N/A';
}

// Normalize fields that may be arrays: if the primary key contains an array,
// join string entries with commas; otherwise, fall back to candidate keys using safeStringFromCandidates.
function extractJoinedIfArrayElseSafe(
    hit: Record<string, unknown>,
    primaryKey: string,
    candidateKeys?: string[],
    fallback: string = 'N/A'
): string {
    const raw = (hit as Record<string, unknown>)[primaryKey] as unknown;
    if (Array.isArray(raw)) {
        return (raw as unknown[])
            .filter((v) => typeof v === 'string' && v)
            .map((v) => (v as string).split('/'))
            .map((parts) => parts[parts.length - 1].trim())
            .join(', ');
    }
    const keys = candidateKeys && candidateKeys.length > 0 ? candidateKeys : [primaryKey];
    return safeStringFromCandidates(hit, keys, fallback);
}

// Extract "last token" values from objects of the form { TCCC: { #values: [...] } }
function extractFromTcccValues(hit: Record<string, unknown>, key: string): string {
    const raw = (hit as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const tcccObj = (raw as Record<string, unknown>)['TCCC'] as Record<string, unknown> | undefined;
        const values = tcccObj && (tcccObj['#values'] as unknown);
        if (Array.isArray(values)) {
            const processed = (values as string[]).map((v) => {
                const parts = v.split(' / ');
                return parts[parts.length - 1].trim();
            });
            return processed.join(', ');
        }
        return 'ERROR';
    }
    return 'N/A';
}

// Extract last tokens from xcm keywords object: uses _tagIDs strings, splitting by '/' or ':' and joining with commas
function extractFromTcccTagIDs(hit: Record<string, unknown>, key: string): string {
    const raw = (hit as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const tagIds = (raw as Record<string, unknown>)['_tagIDs'] as unknown;
        if (Array.isArray(tagIds)) {
            const tokens = (tagIds as unknown[])
                .filter((v) => typeof v === 'string' && v)
                .map((v) => {
                    const s = v as string;
                    const idx = Math.max(s.lastIndexOf('/'), s.lastIndexOf(':'));
                    return (idx >= 0 ? s.slice(idx + 1) : s).trim();
                });
            return tokens.join(', ');
        }
        return 'N/A';
    }
    return 'N/A';
}

/**
 * Transforms a search hit record into an Asset object
 * @param hit - The raw hit data from search results
 * @returns Asset object with populated properties
 */
function populateAssetFromHit(hit: Record<string, unknown>): Asset {
    const repoName = safeStringFromCandidates(hit, ['tccc-fileName', 'repo-name']);
    const category = extractFromTcccValues(hit, 'tccc-assetCategoryAndType') || 'N/A';
    const marketCovered = extractFromTcccValues(hit, 'tccc-marketCovered') || 'N/A';
    const language = extractJoinedIfArrayElseSafe(hit, 'tccc-language');
    const longRangePlan = extractJoinedIfArrayElseSafe(hit, 'tccc-longRangePlan');
    const longRangePlanTactic = extractJoinedIfArrayElseSafe(hit, 'tccc-longRangePlanTactic');
    const campaignReach = extractJoinedIfArrayElseSafe(hit, 'tccc-campaignReach');
    const ageDemographic = extractJoinedIfArrayElseSafe(hit, 'tccc-ageDemographic');
    const brand = extractFromTcccValues(hit, 'tccc-brand') || 'N/A';
    const subBrand = extractJoinedIfArrayElseSafe(hit, 'tccc-subBrand');
    const beverageType = extractJoinedIfArrayElseSafe(hit, 'tccc-beverageType');
    const packageOrContainerType = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerType');
    const packageOrContainerMaterial = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerMaterial');
    const packageOrContainerSize = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerSize');
    const secondaryPackaging = extractJoinedIfArrayElseSafe(hit, 'tccc-secondaryPackaging');

    // Intended Use fields
    const intendedBottlerCountry = extractJoinedIfArrayElseSafe(hit, 'tccc-intendedBottlerCountry');
    const intendedCustomers = extractJoinedIfArrayElseSafe(hit, 'tccc-intendedCustomers');
    const intendedChannel = extractFromTcccValues(hit, 'tccc-intendedChannel');

    // Scheduled (de)activation
    const onTime = safeDateField(hit, 'tccc-onTime'); //TODO: missing metadata
    const offTime = safeDateField(hit, 'tccc-offTime'); //TODO: missing metadata

    // Technical info
    const imageHeight = safeStringField(hit, 'tiff-ImageHeight'); //TODO: missing metadata
    const imageWidth = safeStringField(hit, 'tiff-ImageWidth');
    const duration = safeStringField(hit, 'tccc-videoDuration');
    const broadcastFormat = safeStringField(hit, 'tccc-videoBitRate');
    const titling = safeStringField(hit, 'tccc-titling');
    const ratio = safeStringField(hit, 'tccc-ratio');
    const orientation = safeStringField(hit, 'tiff-Orientation');

    // System Info Legacy
    const legacyAssetId1 = safeStringField(hit, 'tccc-legacyId1'); //TODO: missing metadata
    const legacyAssetId2 = safeStringField(hit, 'tccc-legacyId2');
    const legacyFileName = safeStringField(hit, 'tccc-legacyFileName');
    const sourceUploadDate = safeDateField(hit, 'tccc-sourceUploadDate'); //TODO: missing metadata
    const sourceUploader = safeStringField(hit, 'tccc-sourceUploader');
    const jobId = safeStringField(hit, 'tccc-jobID'); //TODO: missing metadata
    const projectId = safeStringField(hit, 'tccc-projectID');
    const legacySourceSystem = safeStringField(hit, 'tccc-legacySourceSystem');
    const intendedBusinessUnitOrMarket = extractFromTcccTagIDs(hit, 'tccc-intendedBusinessUnitOrMarket');

    // Production
    const leadOperatingUnit = extractJoinedIfArrayElseSafe(hit, 'tccc-leadOU');
    const tcccContact = safeStringField(hit, 'tccc-contact'); //TODO: missing metadata
    const tcccLeadAssociateLegacy = safeStringField(hit, 'tccc-leadAssociate');
    const fadelJobId = safeStringField(hit, 'tccc-fadelJobId'); //TODO: missing metadata

    // Legacy Fields (additional)
    const originalCreateDate = safeDateField(hit, 'repo-createDate');
    const dateUploaded = safeDateField(hit, 'tccc-dateUploaded'); //TODO: missing metadata
    const underEmbargo = safeStringField(hit, 'tccc-underEmbargo');
    const associatedWBrand = safeStringField(hit, 'tccc-associatedWBrand');
    const packageDepicted = safeStringField(hit, 'tccc-packageDepicted');
    const fundingBuOrMarket = extractJoinedIfArrayElseSafe(hit, 'tccc-fundingBU');
    const trackName = safeStringField(hit, 'tccc-trackName');
    const brandsWAssetGuideline = safeStringField(hit, 'tccc-brandsWAssetGuideline');
    const brandsWAssetHero = extractJoinedIfArrayElseSafe(hit, 'tccc-brandsWAssetHero');
    const campaignsWKeyAssets = extractJoinedIfArrayElseSafe(hit, 'tccc-campaignsWKeyAssets');
    const featuredAsset = safeStringField(hit, 'tccc-featuredAsset');
    const keyAsset = safeStringField(hit, 'tccc-keyAsset');
    const layout = safeStringField(hit, 'tccc-layout'); //TODO: missing metadata
    const contractAssetJobs = extractJoinedIfArrayElseSafe(hit, 'tccc-contractAssetJobs');

    return {
        agencyName: safeStringField(hit, 'tccc-agencyName'),
        ageDemographic: ageDemographic,
        alt: safeStringFromCandidates(hit, ['dc-title', 'repo-name']),
        assetAssociatedWithBrand: associatedWBrand,
        assetId: safeStringField(hit, 'assetId'),
        assetStatus: safeStringField(hit, 'tccc-assetStatus'),
        beverageType: beverageType,
        brand: brand,
        brandsWAssetGuideline: brandsWAssetGuideline,
        brandsWAssetHero: brandsWAssetHero,
        broadcastFormat: broadcastFormat,
        businessAffairsManager: safeStringField(hit, 'tccc-businessAffairsManager'),
        campaignActivationRemark: extractJoinedIfArrayElseSafe(hit, 'tccc-campaignActivationRemark'),
        campaignName: safeStringField(hit, 'tccc-campaignName'),
        campaignReach: campaignReach,
        campaignSubActivationRemark: extractJoinedIfArrayElseSafe(hit, 'tccc-campaignSubActivationRemark', ['tccc-campaignSubActivationRemark']),
        campaignsWKeyAssets: campaignsWKeyAssets,
        category: category,
        contractAssetJobs: contractAssetJobs,
        createBy: safeStringField(hit, 'repo-createdBy'),
        createDate: safeDateField(hit, 'repo-createDate'),
        dateUploaded: dateUploaded,
        description: safeStringFromCandidates(hit, ['tccc-description', 'dc-description']),
        derivedAssets: safeStringField(hit, 'tccc-derivedAssets'), //TODO: missing metadata
        duration: duration,
        experienceId: safeStringField(hit, 'tccc-campaignExperienceID'),
        expired: safeStringField(hit, 'is_pur-expirationDate'), //TODO: missing metadata
        expirationDate: safeDateField(hit, 'pur-expirationDate'),
        fadelId: safeStringField(hit, 'tccc-fadelAssetId'),
        fadelJobId: fadelJobId,
        featuredAsset: featuredAsset,
        format: safeStringField(hit, 'dc-format-label'),
        formatedSize: formatFileSize(safeNumberField(hit, 'size')),
        fundingBuOrMarket: fundingBuOrMarket,
        imageHeight: imageHeight,
        imageWidth: imageWidth,
        intendedBottlerCountry: intendedBottlerCountry,
        intendedBusinessUnitOrMarket: intendedBusinessUnitOrMarket,
        intendedChannel: intendedChannel,
        intendedCustomers: intendedCustomers,
        japaneseDescription: safeStringFromCandidates(hit, ['tccc-description.ja'], 'N/A'),
        japaneseKeywords: extractJoinedIfArrayElseSafe(hit, 'tccc-keywords_ja'),
        japaneseTitle: safeStringFromCandidates(hit, ['dc-title_ja'], 'N/A'),
        jobId: jobId,
        keyAsset: keyAsset,
        keywords: extractJoinedIfArrayElseSafe(hit, 'tccc-keywords'),
        language: language,
        lastModified: safeDateField(hit, 'tccc-lastModified'),
        layout: layout,
        leadOperatingUnit: leadOperatingUnit,
        legacyAssetId1: legacyAssetId1,
        legacyAssetId2: legacyAssetId2,
        legacyFileName: legacyFileName,
        legacySourceSystem: legacySourceSystem,
        longRangePlan: longRangePlan,
        longRangePlanTactic: longRangePlanTactic,
        marketCovered: marketCovered,
        masterOrAdaptation: safeStringField(hit, 'tccc-masterOrAdaptation'),
        media: extractJoinedIfArrayElseSafe(hit, 'tccc-mediaCovered'),
        migrationId: safeStringField(hit, 'tccc-migrationID'),
        modifyBy: safeStringField(hit, 'tccc-lastModifiedBy'),
        modifyDate: safeDateField(hit, 'repo-modifyDate'),
        name: repoName,
        offTime: offTime,
        onTime: onTime,
        orientation: orientation,
        originalCreateDate: originalCreateDate,
        otherAssets: safeStringField(hit, 'tccc-otherAssets'), //TODO: missing metadata
        packageDepicted: packageDepicted,
        packageOrContainerMaterial: packageOrContainerMaterial,
        packageOrContainerSize: packageOrContainerSize,
        packageOrContainerType: packageOrContainerType,
        projectId: projectId,
        publishBy: safeStringField(hit, 'tccc-publishBy'), //TODO: missing metadata
        publishDate: safeDateField(hit, 'tccc-publishDate'), //TODO: missing metadata
        publishStatus: safeStringField(hit, 'tccc-publishStatus'), //TODO: missing metadata
        ratio: ratio,
        resolution: safeStringField(hit, 'tccc-resolution'), //TODO: missing metadata
        rightsEndDate: safeDateField(hit, 'tccc-rightsEndDate'),
        rightsFree: safeStringField(hit, 'tccc-rightsFree'), //TODO: missing metadata
        rightsNotes: safeStringField(hit, 'tccc-rightsNotes'), //TODO: missing metadata
        rightsProfileTitle: safeStringField(hit, 'tccc-rightsProfileTitle'),
        rightsStartDate: safeDateField(hit, 'tccc-rightsStartDate'),
        rightsStatus: safeStringField(hit, 'tccc-rightsStatus'),
        riskTypeManagement: safeStringField(hit, 'tccc-riskTypeMgmt'),
        secondaryPackaging: secondaryPackaging,
        sourceAsset: safeStringField(hit, 'tccc-sourceAsset'), //TODO: missing metadata
        sourceId: safeStringField(hit, 'tccc-sourceId'), //TODO: missing metadata
        sourceUploadDate: sourceUploadDate,
        sourceUploader: sourceUploader,
        subBrand: subBrand,
        tags: safeStringFromCandidates(hit, ['tccc-tags', 'tags']), //TODO: missing metadata
        tcccContact: tcccContact,
        tcccLeadAssociateLegacy: tcccLeadAssociateLegacy,
        titling: titling,
        title: safeStringField(hit, 'dc-title'),
        trackName: trackName,
        underEmbargo: underEmbargo,
        url: '', // Loaded lazily
        usage: safeStringField(hit, 'tccc-usage'), //TODO: missing metadata
        workfrontId: safeStringField(hit, 'tccc-workfrontID'),
        xcmKeywords: extractFromTcccTagIDs(hit, 'xcm-keywords'),
        ...hit
    } satisfies Asset;
}

function MainApp(): React.JSX.Element {
    // Local state
    const [accessToken, setAccessToken] = useState<string>(() => {
        try {
            return localStorage.getItem('accessToken') || '';
        } catch {
            return '';
        }
    });
    const [bucket] = useState<string>(() => {
        try {
            return getBucket();
        } catch {
            return '';
        }
    });
    const [dynamicMediaClient, setDynamicMediaClient] = useState<DynamicMediaClient | null>(null);
    const [query, setQuery] = useState<string>('');
    const [dmImages, setDmImages] = useState<Asset[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState<LoadingState>({ [LOADING.dmImages]: false, [LOADING.collections]: false });
    const [currentView, setCurrentView] = useState<CurrentView>(CURRENT_VIEW.images);
    const [selectedQueryType, setSelectedQueryType] = useState<string>(QUERY_TYPES.ASSETS);
    const [selectedFacetFilters, setSelectedFacetFilters] = useState<string[][]>([]);
    const [excFacets, setExcFacets] = useState<Record<string, unknown> | undefined>(undefined);

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    // Cart state
    const [cartItems, setCartItems] = useState<CartItem[]>(() => {
        try {
            const stored = localStorage.getItem('cartItems');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });
    const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
    // Mobile filter panel state
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

    // Sort state
    const [selectedSortType, setSelectedSortType] = useState<string>('Date Created');
    const [selectedSortDirection, setSelectedSortDirection] = useState<string>('Ascending');

    const searchBarRef = useRef<HTMLInputElement>(null);
    const settingsLoadedRef = useRef<boolean>(false);

    const handleSetSelectedQueryType = useCallback((newQueryType: string): void => {
        setSelectedQueryType(prevType => {
            if (prevType !== newQueryType) {
                setQuery('');
            }
            return newQueryType;
        });
        // Focus the query input after changing type
        setTimeout(() => {
            if (searchBarRef.current) {
                searchBarRef.current.focus();
            }
        }, 0);
    }, []);

    // Save cart items to localStorage when they change
    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, [cartItems]);

    useEffect(() => {
        setDynamicMediaClient(new DynamicMediaClient({
            bucket: bucket,
            accessToken: accessToken,
        }));
    }, [accessToken, bucket]);

    // Keep accessToken in sync with localStorage
    useEffect(() => {
        try {
            localStorage.setItem('accessToken', accessToken || '');
        } catch (error) {
            // Silently fail if localStorage is not available
            console.warn('Failed to save access token to localStorage:', error);
        }
    }, [accessToken]);

    // Process and display Adobe Dynamic Media images
    const processDMImages = useCallback(async (content: unknown, isLoadingMore: boolean = false): Promise<void> => {
        // For demo, just parse and set images if possible
        if (!isLoadingMore) {
            setDmImages([]);
        }

        setSearchResult(null);
        try {
            const contentData = content as Record<string, unknown>;
            const results = contentData.results as Array<Record<string, unknown>>;

            if (results && results[0]?.hits) {
                const hits = results[0].hits as Array<Record<string, unknown>>;
                if (hits.length > 0) {
                    // No longer download blobs upfront - just prepare metadata for lazy loading
                    // Each hit is transformed to match the Asset interface
                    const processedImages: Asset[] = hits.map(populateAssetFromHit);

                    if (isLoadingMore) {
                        // Append to existing images
                        setDmImages(prev => [...prev, ...processedImages]);
                    } else {
                        // Replace existing images
                        setDmImages(processedImages);
                    }
                }
                // Store the complete results object with nbHits and update pagination info
                setSearchResult(results[0] as SearchResult);
                setTotalPages((results[0] as { nbPages?: number }).nbPages || 0);
            } else {
                setTotalPages(0);
            }
        } catch (error) {
            console.error('Error processing dynamic media images:', error);
        }
        setLoading(prev => ({ ...prev, [LOADING.dmImages]: false }));
        setIsLoadingMore(false);
    }, []);

    // Process and display collections
    const processCollections = useCallback(async (content: { results?: Array<{ hits?: Array<{ objectID: string; collectionMetadata?: unknown; thumbnail?: string }> }> }): Promise<void> => {
        setCollections([]);
        try {
            if (content.results && content.results[0]?.hits) {
                const processedCollections: Collection[] = content.results[0].hits.map((hit) => ({
                    collectionId: hit.objectID as string,
                    collectionMetadata: (hit.collectionMetadata as Collection['collectionMetadata']) || { title: '', description: '' },
                    thumbnail: hit.thumbnail as string,
                }));
                setCollections(processedCollections);
            } else {
                console.log('No collections in response');
            }
        } catch (error) {
            console.error('Error processing collections:', error);
        }
        setLoading(prev => ({ ...prev, [LOADING.collections]: false }));
    }, []);

    // Search assets (images, videos, etc.)
    const performSearchImages = useCallback((query: string, page: number = 0): void => {
        if (!dynamicMediaClient) return;

        const isLoadingMore = page > 0;
        if (isLoadingMore) {
            setIsLoadingMore(true);
        } else {
            setLoading(prev => ({ ...prev, [LOADING.dmImages]: true }));
            setCurrentPage(0);
        }
        setCurrentView(CURRENT_VIEW.images);

        dynamicMediaClient.searchAssets(query.trim(), {
            collectionId: selectedCollection?.collectionId,
            facets: excFacets ? transformExcFacetsToHierarchyArray(excFacets) : [],
            facetFilters: selectedFacetFilters,
            hitsPerPage: HITS_PER_PAGE,
            page: page
        }).then((content) => processDMImages(content, isLoadingMore)).catch((error) => {
            console.error('Error searching assets:', error);
            setLoading(prev => ({ ...prev, [LOADING.dmImages]: false }));
            setIsLoadingMore(false);
            if (!isLoadingMore) {
                setDmImages([]);
            }
        });

    }, [dynamicMediaClient, processDMImages, selectedCollection, selectedFacetFilters, excFacets]);

    // Search collections
    const performSearchCollections = useCallback((query: string): void => {
        if (!dynamicMediaClient) return;
        setLoading(prev => ({ ...prev, [LOADING.collections]: true }));
        setCurrentView(CURRENT_VIEW.collections);

        dynamicMediaClient.searchCollections(query.trim(), {
            hitsPerPage: HITS_PER_PAGE
        }).then(processCollections);

        setQuery('');
    }, [dynamicMediaClient, processCollections]);

    // Select a collection and load all assets in the collection (no query & no facet filters)
    const handleSelectCollection = useCallback((collection: Collection): void => {
        setSelectedCollection(collection);
        setSelectedFacetFilters([]);
        setCurrentPage(0);
        setQuery('');
        handleSetSelectedQueryType(QUERY_TYPES.ASSETS);
        // performSearchImages will be triggered by useEffect when selectedCollection changes
    }, [handleSetSelectedQueryType]);

    // Handler for loading more results (pagination)
    const handleLoadMoreResults = useCallback((): void => {
        if (currentPage + 1 < totalPages && !isLoadingMore) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            performSearchImages(query, nextPage);
        }
    }, [currentPage, totalPages, isLoadingMore, performSearchImages, query]);

    // Handler for searching
    const search = useCallback((): void => {
        setCurrentPage(0);
        if (selectedQueryType === QUERY_TYPES.COLLECTIONS) {
            // Search for collections
            performSearchCollections(query);
        } else {
            // Search for assets or assets in a collection
            performSearchImages(query, 0);
        }
    }, [selectedQueryType, performSearchCollections, performSearchImages, query]);

    // Read query and selectedQueryType from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlQuery = params.get('query');
        const queryType = params.get('selectedQueryType');
        if (urlQuery !== null) setQuery(urlQuery);
        if (queryType !== null && (queryType === QUERY_TYPES.ASSETS || queryType === QUERY_TYPES.COLLECTIONS)) {
            setSelectedQueryType(queryType);
        }
    }, [dynamicMediaClient]);

    useEffect(() => {
        dynamicMediaClient && window.history.replaceState({}, '', `${window.location.pathname}`);
    }, [selectedQueryType, dynamicMediaClient]);

    // Auto-search with empty query on app load
    useEffect(() => {
        if (dynamicMediaClient && accessToken && excFacets !== undefined) {
            search();
        }
    }, [dynamicMediaClient, accessToken, excFacets]);

    useEffect(() => {
        if (accessToken && !settingsLoadedRef.current) {
            settingsLoadedRef.current = true;
            const excClient = new ExcClient({ accessToken });
            // Get facets from EXC
            excClient.getExcFacets({}).then(facets => {
                setExcFacets(facets);
                console.log('EXC Facets loaded:', facets);
            }).catch(error => {
                console.error('Error fetching facets:', error);
            });
        }
    }, [accessToken]);

    // Add useEffect to trigger search when selectedCollection changes
    useEffect(() => {
        if (selectedCollection && dynamicMediaClient && excFacets !== undefined) {
            performSearchImages('', 0);
        }
    }, [selectedCollection, dynamicMediaClient, excFacets, performSearchImages]);

    // Cart functions
    const handleAddToCart = async (image: Asset): Promise<void> => {
        if (!cartItems.some(item => item.assetId === image.assetId)) {
            // Cache the image when adding to cart
            if (dynamicMediaClient && image.assetId) {
                try {
                    const cacheKey = `${image.assetId}-350`;
                    await fetchOptimizedDeliveryBlob(
                        dynamicMediaClient,
                        image,
                        350,
                        {
                            cache: true,
                            cacheKey: cacheKey,
                            fallbackUrl: image.url
                        }
                    );
                    console.log(`Cached image for cart: ${image.assetId}`);
                } catch (error) {
                    console.warn(`Failed to cache image for cart ${image.assetId}:`, error);
                }
            }

            setCartItems(prev => [...prev, image]);
        }
    };

    const handleRemoveFromCart = (image: Asset): void => {
        setCartItems(prev => prev.filter(item => item.assetId !== image.assetId));
    };

    const handleBulkAddToCart = async (selectedCardIds: Set<string>, images: Asset[]): Promise<void> => {
        const newItems: Asset[] = [];

        for (const imageId of selectedCardIds) {
            const image = images.find(img => img.assetId === imageId);
            if (image && !cartItems.some(item => item.assetId === image.assetId)) {
                // Cache each image when adding to cart
                if (dynamicMediaClient && image.assetId) {
                    try {
                        const cacheKey = `${image.assetId}-350`;
                        await fetchOptimizedDeliveryBlob(
                            dynamicMediaClient,
                            image,
                            350,
                            {
                                cache: true,
                                cacheKey: cacheKey,
                                fallbackUrl: image.url
                            }
                        );
                        console.log(`Cached bulk image for cart: ${image.assetId}`);
                    } catch (error) {
                        console.warn(`Failed to cache bulk image for cart ${image.assetId}:`, error);
                    }
                }

                newItems.push(image);
            }
        }

        if (newItems.length > 0) {
            setCartItems(prev => [...prev, ...newItems]);
        }
    };

    // Sort handlers
    const handleSortByTopResults = (): void => {
        console.log('Sort by Top Results');
        // TODO: Implement actual sorting logic
    };

    const handleSortByDateCreated = (): void => {
        console.log('Sort by Date Created');
        // TODO: Implement actual sorting logic
    };

    const handleSortByLastModified = (): void => {
        console.log('Sort by Last Modified');
        // TODO: Implement actual sorting logic
    };

    const handleSortBySize = (): void => {
        console.log('Sort by Size');
        // TODO: Implement actual sorting logic
    };

    // Sort direction handlers
    const handleSortDirectionAscending = (): void => {
        console.log('Sort direction: Ascending');
        // TODO: Implement actual sorting logic
    };

    const handleSortDirectionDescending = (): void => {
        console.log('Sort direction: Descending');
        // TODO: Implement actual sorting logic
    };

    const handleApproveAssets = (): void => {
        if (cartItems.length === 0) {
            return;
        }
    };

    const handleDownloadAssets = (): void => {
        if (cartItems.length === 0) {
            return;
        }
        setIsCartOpen(false);
    };

    const handleAuthenticated = (token: string): void => {
        setAccessToken(token);
    };

    const handleSignOut = (): void => {
        console.log('🚪 User signed out, clearing access token');
        setAccessToken('');
        try {
            // Clear all localStorage
            const localStorageLength = localStorage.length;
            console.log(`- Clearing ${localStorageLength} localStorage items`);
            localStorage.clear();

            // Clear all sessionStorage  
            const sessionStorageLength = sessionStorage.length;
            console.log(`- Clearing ${sessionStorageLength} sessionStorage items`);
            sessionStorage.clear();

            console.log('✅ All browser storage cleared successfully');
        } catch (error) {
            console.error('❌ Error clearing browser storage:', error);
        }
    };

    // Toggle mobile filter panel
    const handleToggleMobileFilter = (): void => {
        setIsMobileFilterOpen(!isMobileFilterOpen);
    };

    // Add breadcrumbs for navigation when inside a collection
    const breadcrumbs = selectedCollection && (
        <div className="breadcrumbs" style={{ padding: '10px', backgroundColor: '#f5f5f5', marginBottom: '10px' }}>
            <span
                className="breadcrumb-link"
                onClick={() => {
                    setSelectedCollection(null);
                    setCurrentView(CURRENT_VIEW.collections);
                }}
                style={{ cursor: 'pointer', color: '#f81c04' }}
            >
                Collections
            </span>
            <span style={{ margin: '0 5px' }}> &gt; </span>
            <span>{selectedCollection.collectionMetadata?.title || 'Collection'}</span>
        </div>
    );

    // Gallery logic
    const enhancedGallery = (
        <>
            {currentView === CURRENT_VIEW.collections ? (
                <CollectionGallery
                    title={searchCollectionsTitle}
                    collections={collections}
                    loading={loading[LOADING.collections]}
                    onSelectCollection={handleSelectCollection}
                />
            ) : currentView === CURRENT_VIEW.images ? (
                <ImageGallery
                    title={selectedCollection ? `${selectedCollection.collectionMetadata?.title} Collection` : searchAssetsTitle}
                    images={dmImages}
                    loading={loading[LOADING.dmImages]}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                    cartItems={cartItems}
                    dynamicMediaClient={dynamicMediaClient}
                    searchResult={searchResult}
                    onToggleMobileFilter={handleToggleMobileFilter}
                    isMobileFilterOpen={isMobileFilterOpen}
                    onBulkAddToCart={handleBulkAddToCart}
                    onSortByTopResults={handleSortByTopResults}
                    onSortByDateCreated={handleSortByDateCreated}
                    onSortByLastModified={handleSortByLastModified}
                    onSortBySize={handleSortBySize}
                    onSortDirectionAscending={handleSortDirectionAscending}
                    onSortDirectionDescending={handleSortDirectionDescending}
                    selectedSortType={selectedSortType}
                    selectedSortDirection={selectedSortDirection}
                    onSortTypeChange={setSelectedSortType}
                    onSortDirectionChange={setSelectedSortDirection}
                    onLoadMoreResults={handleLoadMoreResults}
                    hasMorePages={currentPage + 1 < totalPages}
                    isLoadingMore={isLoadingMore}
                />
            ) : (
                <></>
            )}
        </>
    );

    return (
        <div className="container">
            <HeaderBar
                cartItems={cartItems}
                setCartItems={setCartItems}
                isCartOpen={isCartOpen}
                setIsCartOpen={setIsCartOpen}
                handleRemoveFromCart={handleRemoveFromCart}
                handleApproveAssets={handleApproveAssets}
                handleDownloadAssets={handleDownloadAssets}
                handleAuthenticated={handleAuthenticated}
                handleSignOut={handleSignOut}
                dynamicMediaClient={dynamicMediaClient}
            />
            <SearchBar
                query={query}
                setQuery={setQuery}
                sendQuery={search}
                selectedQueryType={selectedQueryType}
                setSelectedQueryType={handleSetSelectedQueryType}
                inputRef={searchBarRef}
            />
            <div className="main-content">
                <div className="images-container">
                    <div className="images-content-wrapper">
                        <div className="images-content-row">
                            <div className="images-main">
                                {breadcrumbs}
                                {enhancedGallery}
                            </div>
                            <div className={`facet-filter-panel ${isMobileFilterOpen ? 'mobile-open' : ''}`}>
                                <Facets
                                    searchResult={searchResult}
                                    selectedFacetFilters={selectedFacetFilters}
                                    setSelectedFacetFilters={setSelectedFacetFilters}
                                    search={search}
                                    excFacets={excFacets}
                                />
                            </div>
                        </div>
                        <Footer />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MainApp; 