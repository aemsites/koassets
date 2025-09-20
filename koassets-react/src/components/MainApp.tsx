import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DateValue } from 'react-aria-components';
import '../MainApp.css';

import { DynamicMediaClient } from '../clients/dynamicmedia-client';
import { DEFAULT_FACETS, type ExcFacets } from '../constants/facets';
import type {
    Asset,
    CartItem,
    Collection,
    CurrentView,
    ExternalParams,
    LoadingState,
    Rendition,
    RightsData,
    SearchResult,
    SearchResults
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { populateAssetFromHit } from '../utils/assetTransformers';
import { fetchOptimizedDeliveryBlob, removeBlobFromCache } from '../utils/blobCache';
import { getBucket, getExternalParams } from '../utils/config';
import { AppConfigProvider } from './AppConfigProvider';

// Extend window interface for cart functions and user authentication
declare global {
    interface Window {
        openCart?: () => void;
        closeCart?: () => void;
        toggleCart?: () => void;
        user?: unknown; // Global user object for authentication
    }
}

// Components
import { CalendarDate } from '@internationalized/date';
import { createPortal } from 'react-dom';
import { AuthorizationStatus, CheckRightsRequest, FadelClient } from '../clients/fadel-client';
import { calendarDateToEpoch } from '../utils/formatters';
import CartPanel from './CartPanel';
import Facets from './Facets';
import HeaderBar from './HeaderBar';
import ImageGallery from './ImageGallery';
import SearchBar from './SearchBar';

const HITS_PER_PAGE = 24;

/**
 * Transforms excFacets object into a string array for search facets
 * @param excFacets - The facets object from EXC
 * @returns Array of facet keys for search
 */
function transformExcFacetsToHierarchyArray(excFacets: ExcFacets): string[] {
    const facetKeys: string[] = [];

    Object.entries(excFacets).forEach(([key, facet]) => {
        if (facet.type !== 'tags') {
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

// temporary check for cookie auth - can be removed once we drop IMS
// note: real check for is authenticated (with cookie) is if window.user is defined
//       but has race condition between scripts.js and react index.js loading order
function isCookieAuth(): boolean {
    return window.location.origin.endsWith('adobeaem.workers.dev')
        || window.location.origin === 'http://localhost:8787';
}

function MainApp(): React.JSX.Element {
    // External parameters from plain JavaScript
    const [externalParams] = useState<ExternalParams>(() => {
        const params = getExternalParams();
        // console.log('External parameters received:', JSON.stringify(params));
        return params;
    });

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

    // Authentication state - either IMS or cookie authenticated
    const [authenticated, setAuthenticated] = useState<boolean>(() => {
        const hasAccessToken = Boolean(localStorage.getItem('accessToken'));
        return hasAccessToken || isCookieAuth();
    });

    const [dynamicMediaClient, setDynamicMediaClient] = useState<DynamicMediaClient | null>(null);

    const [query, setQuery] = useState<string>('');
    const [dmImages, setDmImages] = useState<Asset[]>([]);

    const [searchResults, setSearchResults] = useState<SearchResults['results'] | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState<LoadingState>({ [LOADING.dmImages]: false, [LOADING.collections]: false });
    const [currentView, setCurrentView] = useState<CurrentView>(CURRENT_VIEW.images);
    const [selectedQueryType, setSelectedQueryType] = useState<string>(QUERY_TYPES.ASSETS);
    const [selectedFacetFilters, setSelectedFacetFilters] = useState<string[][]>([]);
    const [selectedNumericFilters, setSelectedNumericFilters] = useState<string[]>([]);
    const [searchDisabled, setSearchDisabled] = useState<boolean>(false);
    const [isRightsSearch, setIsRightsSearch] = useState<boolean>(false);
    const [rightsStartDate, setRightsStartDate] = useState<DateValue | null>(null);
    const [rightsEndDate, setRightsEndDate] = useState<DateValue | null>(null);
    const [selectedMarkets, setSelectedMarkets] = useState<Set<RightsData>>(new Set());
    const [selectedMediaChannels, setSelectedMediaChannels] = useState<Set<RightsData>>(new Set());
    const searchDisabledRef = useRef<boolean>(false);
    const isRightsSearchRef = useRef<boolean>(false);

    const handleSetSearchDisabled = useCallback((disabled: boolean) => {
        searchDisabledRef.current = disabled; // Update ref immediately
        setSearchDisabled(disabled);
    }, []);

    const handleSetIsRightsSearch = useCallback((isRights: boolean) => {
        isRightsSearchRef.current = isRights; // Update ref immediately
        setIsRightsSearch(isRights);
    }, []);

    const [presetFilters, setPresetFilters] = useState<string[]>(() =>
        externalParams.presetFilters || []
    );
    const [excFacets, setExcFacets] = useState<ExcFacets | undefined>(undefined);

    const [imagePresets, setImagePresets] = useState<{
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    }>({});
    const [assetRenditionsCache, setAssetRenditionsCache] = useState<{
        [assetId: string]: {
            assetId?: string;
            items?: Rendition[];
            'repo:name'?: string;
        }
    }>({});

    // Track which assets are currently being fetched to prevent duplicates
    const fetchingAssetsRef = useRef<Set<string>>(new Set());

    // Track if image presets are being fetched to prevent duplicates
    const fetchingImagePresetsRef = useRef<boolean>(false);

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

    // Expose cart functions to window for EDS header integration
    useEffect(() => {
        window.openCart = () => setIsCartOpen(true);
        window.closeCart = () => setIsCartOpen(false);
        window.toggleCart = () => setIsCartOpen(prev => !prev);

        return () => {
            delete window.openCart;
            delete window.closeCart;
            delete window.toggleCart;
        };
    }, []);

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
        const hasAccessToken = Boolean(accessToken);
        setAuthenticated(hasAccessToken || isCookieAuth());
    }, [accessToken]);

    useEffect(() => {
        // Only create client when authenticated (either mechanism) and bucket is available
        if (authenticated && bucket) {
            if (accessToken && isCookieAuth()) {
                console.debug('🔑 Authenticated via IMS and Cookie. Using IMS route (during transition period)');
            } else if (accessToken) {
                console.debug('🔑 Authenticated via IMS only.');
            } else if (isCookieAuth()) {
                console.debug('🔑 Authenticated via Cookie only.');
            } else {
                console.debug('🔑 Not authenticated (not IMS, nor Cookie)');
            }
            setDynamicMediaClient(new DynamicMediaClient({
                bucket: bucket,
                accessToken: accessToken || undefined, // Pass undefined if empty string
            }));
        } else {
            console.debug('🔑 Not authenticated (not IMS, nor cookie)');
            setDynamicMediaClient(null);
        }
    }, [authenticated, accessToken, bucket]);

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

        setSearchResults(null);
        try {
            const contentData = content as Record<string, unknown>;
            const results = contentData.results as SearchResults['results'];

            if (results && results[0]?.hits) {
                const hits = results[0].hits as SearchResult['hits'];
                if (hits.length > 0) {
                    // No longer download blobs upfront - just prepare metadata for lazy loading
                    // Each hit is transformed to match the Asset interface
                    let processedImages: Asset[] = hits.map(populateAssetFromHit);

                    // When performing a rights search, we need to check the rights of the assets
                    if (isRightsSearchRef.current) {
                        const checkRightsRequest: CheckRightsRequest = {
                            inDate: calendarDateToEpoch(rightsStartDate as CalendarDate),
                            outDate: calendarDateToEpoch(rightsEndDate as CalendarDate),
                            selectedExternalAssets: processedImages.filter(image => image.readyToUse?.toLowerCase() !== 'yes').map(image => image.assetId).filter((id): id is string => Boolean(id)).map(id => id.replace('urn:aaid:aem:', '')),
                            selectedRights: {
                                "20": Array.from(selectedMediaChannels).map(channel => channel.id),
                                "30": Array.from(selectedMarkets).map(market => market.id)
                            }
                        };
                        const fadelClient = FadelClient.getInstance();
                        const checkRightsResponse = await fadelClient.checkRights(checkRightsRequest);
                        // Assets that are not in the response are considered authorized
                        // Use immutable update pattern instead of direct mutation
                        processedImages = processedImages.map(image => {
                            const matchingItem = checkRightsResponse.restOfAssets.find(item => `urn:aaid:aem:${item.asset.assetExtId}` === image.assetId);
                            const authorized = matchingItem ? (matchingItem.notAvailable ? AuthorizationStatus.NOT_AVAILABLE
                                : (matchingItem.availableExcept ? AuthorizationStatus.AVAILABLE_EXCEPT : AuthorizationStatus.AVAILABLE))
                                : AuthorizationStatus.AVAILABLE;
                            return { ...image, authorized };
                        });
                    }

                    // Update state after processing (with or without rights check)
                    if (isLoadingMore) {
                        // Append to existing images
                        setDmImages(prev => [...prev, ...processedImages]);
                    } else {
                        // Replace existing images
                        setDmImages(processedImages);
                    }
                }
                // Store the complete results object with nbHits and update pagination info
                setSearchResults(results as SearchResults['results']);
                setTotalPages((results[0] as { nbPages?: number }).nbPages || 0);
            } else {
                setTotalPages(0);
            }
        } catch (error) {
            console.error('Error processing dynamic media images:', error);
        }
        setLoading(prev => ({ ...prev, [LOADING.dmImages]: false }));
        setIsLoadingMore(false);
    }, [rightsStartDate, rightsEndDate, selectedMarkets, selectedMediaChannels]);



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
            numericFilters: selectedNumericFilters,
            filters: presetFilters,
            hitsPerPage: externalParams.hitsPerPage || HITS_PER_PAGE,
            page: page
        }).then((content) => processDMImages(content, isLoadingMore)).catch((error) => {
            // Prevent infinite execution when Network error occurs
            if (error?.message === 'Network error') {
                console.warn('Network error encountered, stopping execution to prevent infinite loop');
                setLoading(prev => ({ ...prev, [LOADING.dmImages]: false }));
                setIsLoadingMore(false);
                // Don't clear images or trigger further state changes that might cause re-execution
                return;
            }

            console.error('Error searching assets:', error);
            setLoading(prev => ({ ...prev, [LOADING.dmImages]: false }));
            setIsLoadingMore(false);
            if (!isLoadingMore) {
                setDmImages([]);
            }
        });

    }, [dynamicMediaClient, processDMImages, selectedCollection, selectedFacetFilters, selectedNumericFilters, excFacets, presetFilters, externalParams.hitsPerPage]);

    // Handler for loading more results (pagination)
    const handleLoadMoreResults = useCallback((): void => {
        if (currentPage + 1 < totalPages && !isLoadingMore) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            performSearchImages(query, nextPage);
        }
    }, [currentPage, totalPages, isLoadingMore, performSearchImages, query]);

    // Handler for searching
    const search = useCallback((searchQuery?: string): void => {
        if (searchDisabledRef.current) {
            return;
        }
        setCurrentPage(0);
        // Search for assets or assets in a collection
        const queryToUse = searchQuery !== undefined ? searchQuery : query;
        performSearchImages(queryToUse, 0);
    }, [performSearchImages, query]);





    // Read query and selectedQueryType from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlQuery = params.get('query');
        const queryType = params.get('selectedQueryType');

        // Check for saved search parameters
        const fulltext = params.get('fulltext');
        const facetFiltersParam = params.get('facetFilters');
        const numericFiltersParam = params.get('numericFilters');

        if (urlQuery !== null) setQuery(urlQuery);
        if (queryType !== null && (queryType === QUERY_TYPES.ASSETS || queryType === QUERY_TYPES.COLLECTIONS)) {
            setSelectedQueryType(queryType);
        }

        // Apply saved search parameters if present
        if (fulltext || facetFiltersParam || numericFiltersParam) {
            try {
                if (fulltext) setQuery(fulltext);
                if (facetFiltersParam) {
                    const facetFilters = JSON.parse(decodeURIComponent(facetFiltersParam));
                    setSelectedFacetFilters(facetFilters);
                }
                if (numericFiltersParam) {
                    const numericFilters = JSON.parse(decodeURIComponent(numericFiltersParam));
                    setSelectedNumericFilters(numericFilters);
                }
                // Trigger search after a brief delay to ensure all state is updated
                setTimeout(() => {
                    setCurrentPage(0);
                    performSearchImages(fulltext || '', 0);
                }, 100);
            } catch (error) {
                console.warn('Error parsing URL search parameters:', error);
            }
        }
    }, [dynamicMediaClient, setSelectedFacetFilters, setSelectedNumericFilters, performSearchImages]);

    useEffect(() => {
        if (!dynamicMediaClient) return;
        const url = new URL(window.location.href);
        // Only strip app-specific params; preserve others like id
        ['query', 'selectedQueryType', 'fulltext', 'facetFilters', 'numericFilters']
            .forEach((key) => url.searchParams.delete(key));
        const next = url.pathname + (url.search ? `?${url.searchParams.toString()}` : '');
        window.history.replaceState({}, '', next);
    }, [selectedQueryType, dynamicMediaClient]);

    // Auto-search with empty query on app load
    useEffect(() => {
        if (!searchDisabled && authenticated && dynamicMediaClient && excFacets !== undefined) {
            search();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicMediaClient, authenticated, excFacets, selectedFacetFilters, selectedNumericFilters, searchDisabled, selectedMarkets, selectedMediaChannels, rightsStartDate, rightsEndDate]);

    useEffect(() => {
        if (authenticated && !settingsLoadedRef.current) {
            setExcFacets(externalParams.excFacets || DEFAULT_FACETS);
            setPresetFilters(externalParams.presetFilters || []);
            settingsLoadedRef.current = true;
        }
    }, [authenticated, externalParams.excFacets, externalParams.presetFilters]);

    // Rights data fetching moved to individual Markets and MediaChannels components



    // Function to fetch and cache static renditions for a specific asset
    const fetchAssetRenditions = useCallback(async (asset: Asset): Promise<void> => {
        if (!dynamicMediaClient || !asset.assetId) return;

        // Check cache first - use functional state update to get current state
        let shouldFetchRenditions = false;
        setAssetRenditionsCache(prevCache => {
            // If already cached, don't fetch
            if (prevCache[asset.assetId!]) {
                asset.renditions = prevCache[asset.assetId!];
                return prevCache; // No state change
            }

            // If currently being fetched, don't fetch again
            if (fetchingAssetsRef.current.has(asset.assetId!)) {
                return prevCache; // No state change
            }

            // Mark as fetching and proceed
            fetchingAssetsRef.current.add(asset.assetId!);
            shouldFetchRenditions = true;
            return prevCache; // No state change yet
        });

        // Only attach image presets to asset if it's not a video
        if (asset.formatType?.toLowerCase() !== 'video') {
            // Fetch image presets once for all assets (only if not already fetched/fetching)
            if (!imagePresets.items && !fetchingImagePresetsRef.current) {
                fetchingImagePresetsRef.current = true;
                try {
                    const presets = await dynamicMediaClient.getImagePresets();
                    setImagePresets(presets);
                    asset.imagePresets = presets;
                    console.log('Successfully fetched image presets');
                } catch (error) {
                    ToastQueue.negative('Failed to get all renditions info', { timeout: 2000 });
                    console.error('Failed to fetch image presets:', error);
                    setImagePresets({ items: [] }); // Set empty items array to prevent infinite loop
                } finally {
                    fetchingImagePresetsRef.current = false;
                }
            } else {
                asset.imagePresets = imagePresets;
            }
        }

        if (!shouldFetchRenditions) return;

        try {
            const renditions = await dynamicMediaClient.getAssetRenditions(asset);
            asset.renditions = renditions;
            setAssetRenditionsCache(prev => ({
                ...prev,
                [asset.assetId!]: renditions
            }));
            fetchingAssetsRef.current.delete(asset.assetId!);
        } catch (error) {
            console.error('Failed to fetch asset static renditions:', error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicMediaClient, imagePresets.items]);

    // Add useEffect to trigger search when selectedCollection changes
    useEffect(() => {
        if (selectedCollection && authenticated && dynamicMediaClient && excFacets !== undefined) {
            performSearchImages('', 0);
        }
    }, [selectedCollection, authenticated, dynamicMediaClient, excFacets, performSearchImages]);

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
                            cache: false,
                            cacheKey: cacheKey,
                            fallbackUrl: image.url
                        }
                    );
                } catch (error) {
                    console.warn(`Failed to cache image for cart ${image.assetId}:`, error);
                }
            }

            setCartItems(prev => [...prev, image]);
        }
    };

    const handleRemoveFromCart = (image: Asset): void => {
        setCartItems(prev => prev.filter(item => item.assetId !== image.assetId));

        // Clean up cached blobs for this asset
        if (image.assetId) {
            removeBlobFromCache(image.assetId);
        }
    };

    const handleBulkAddToCart = async (selectedCardIds: Set<string>, images: Asset[]): Promise<void> => {
        // Process all selected images in parallel
        const processCartImages = async (imageId: string): Promise<Asset | null> => {
            const image = images.find(img => img.assetId === imageId);
            if (!image || cartItems.some(item => item.assetId === image.assetId)) {
                return null;
            }

            return image;
        };

        // Process all images in parallel using Promise.allSettled for better error handling
        const results = await Promise.allSettled(
            Array.from(selectedCardIds).map(processCartImages)
        );

        // Filter successful results and extract the assets
        const newItems: Asset[] = results
            .filter((result): result is PromiseFulfilledResult<Asset | null> =>
                result.status === 'fulfilled' && result.value !== null)
            .map(result => result.value!);

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

    const handleIMSAccessToken = (token: string): void => {
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
        <div className="breadcrumbs">
            <span
                className="breadcrumb-link"
                onClick={() => {
                    setSelectedCollection(null);
                    setCurrentView(CURRENT_VIEW.collections);
                }}
            >
                Collections
            </span>
            <span className="breadcrumb-separator"> &gt; </span>
            <span>{selectedCollection.collectionMetadata?.title || 'Collection'}</span>
        </div>
    );

    // Gallery logic
    const enhancedGallery = (
        <>
            {currentView === CURRENT_VIEW.images ? (
                <ImageGallery
                    images={dmImages}
                    loading={loading[LOADING.dmImages]}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                    cartItems={cartItems}
                    searchResult={searchResults?.[0] || null}
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
                    imagePresets={imagePresets}
                    assetRenditionsCache={assetRenditionsCache}
                    fetchAssetRenditions={fetchAssetRenditions}
                    isRightsSearch={isRightsSearch}
                />
            ) : (
                <></>
            )}
        </>
    );

    return (
        <AppConfigProvider
            externalParams={externalParams}
            dynamicMediaClient={dynamicMediaClient}
            fetchAssetRenditions={fetchAssetRenditions}
            imagePresets={imagePresets}
        >
            <div className="container">
                <HeaderBar
                    cartItems={cartItems}
                    handleAuthenticated={handleIMSAccessToken}
                    handleSignOut={handleSignOut}
                />

                {/* Cart Container - moved from HeaderBar, now uses Portal */}
                {createPortal(
                    <CartPanel
                        isOpen={isCartOpen}
                        onClose={() => setIsCartOpen(false)}
                        cartItems={cartItems}
                        setCartItems={setCartItems}
                        onRemoveItem={handleRemoveFromCart}
                        onApproveAssets={handleApproveAssets}
                        onDownloadAssets={handleDownloadAssets}
                    />,
                    document.body
                )}

                {/* TODO: Update this once finalized */}
                {window.location.pathname.includes('/tools/assets-browser/index.html') && (
                    <SearchBar
                        query={query}
                        setQuery={setQuery}
                        sendQuery={search}
                        selectedQueryType={selectedQueryType}
                        setSelectedQueryType={handleSetSelectedQueryType}
                        inputRef={searchBarRef}
                    />)}
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
                                        searchResults={searchResults}
                                        selectedFacetFilters={selectedFacetFilters}
                                        setSelectedFacetFilters={setSelectedFacetFilters}
                                        search={search}
                                        excFacets={excFacets}
                                        selectedNumericFilters={selectedNumericFilters}
                                        setSelectedNumericFilters={setSelectedNumericFilters}
                                        query={query}
                                        setQuery={setQuery}
                                        searchDisabled={searchDisabled}
                                        setSearchDisabled={handleSetSearchDisabled}
                                        setIsRightsSearch={handleSetIsRightsSearch}
                                        rightsStartDate={rightsStartDate}
                                        setRightsStartDate={setRightsStartDate}
                                        rightsEndDate={rightsEndDate}
                                        setRightsEndDate={setRightsEndDate}
                                        selectedMarkets={selectedMarkets}
                                        setSelectedMarkets={setSelectedMarkets}
                                        selectedMediaChannels={selectedMediaChannels}
                                        setSelectedMediaChannels={setSelectedMediaChannels}
                                    />
                                </div>
                            </div>
                            {/* <Footer /> */}
                        </div>
                    </div>
                </div>
            </div>
        </AppConfigProvider>
    );
}

export default MainApp;
