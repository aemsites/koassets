import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { DateValue } from 'react-aria-components';
import '../MainApp.css';

import { DynamicMediaClient } from '../clients/dynamicmedia-client';
import { DEFAULT_FACETS, type ExcFacets } from '../constants/facets';

import type {
    Asset,
    CartAssetItem,
    CartTemplateItem,
    Collection,
    CurrentView,
    ExternalParams,
    FacetCheckedState,
    LoadingState,
    Rendition,
    RightsData,
    SearchResult,
    SearchResults
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { populateAssetFromHit, saveCartItems } from '../utils/assetTransformers';
import { getExternalParams, saveSearchFiltersToSession, loadSearchFiltersFromSession, clearSearchFiltersFromSession } from '../utils/config';
import { AppConfigProvider } from './AppConfigProvider';

// Components
import { CalendarDate } from '@internationalized/date';
import { createPortal } from 'react-dom';
import { AuthorizationStatus, CheckRightsRequest, FadelClient } from '../clients/fadel-client';
import { calendarDateToEpoch, epochToCalendarDate } from '../utils/formatters';
import CartPanel from './CartDownloads/CartPanel';
import DownloadPanel from './CartDownloads/DownloadPanel';
// Lazy load non-critical components for better performance
const Facets = lazy(() => import('./Facets'));
const ImageGallery = lazy(() => import('./ImageGallery'));
import { isImage } from '../constants/filetypes';

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
            // For tags type, use maxHierarchyLevels if specified, otherwise default to 10
            const maxLevels = facet.maxHierarchyLevels ?? 9;
            for (let n = 0; n <= maxLevels; n++) {
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

const EMPTY_FACET_FILTERS: string[][] = [];

function MainApp(): React.JSX.Element {
    // External parameters from plain JavaScript
    const [externalParams] = useState<ExternalParams>(() => {
        const params = getExternalParams();
        // console.log('External parameters received:', JSON.stringify(params));
        return params;
    });

    // Authentication state - cookie authenticated
    const [authenticated, _setAuthenticated] = useState<boolean>(() => {
        return isCookieAuth();
    });

    const [dynamicMediaClient, setDynamicMediaClient] = useState<DynamicMediaClient | null>(null);

    const [query, setQuery] = useState<string>('');
    const [dmImages, setDmImages] = useState<Asset[]>([]);

    const [searchResults, setSearchResults] = useState<SearchResults['results'] | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState<LoadingState>({ [LOADING.dmImages]: false, [LOADING.collections]: false });
    const [currentView, setCurrentView] = useState<CurrentView>(CURRENT_VIEW.images);
    const [selectedQueryType, setSelectedQueryType] = useState<string>(QUERY_TYPES.ALL);
    const [facetCheckedState, setFacetCheckedState] = useState<FacetCheckedState>({});
    const [selectedNumericFilters, setSelectedNumericFilters] = useState<string[]>([]);
    const [searchDisabled, setSearchDisabled] = useState<boolean>(false);
    const [isRightsSearch, setIsRightsSearch] = useState<boolean>(false);
    const [rightsStartDate, setRightsStartDate] = useState<DateValue | null>(null);
    const [rightsEndDate, setRightsEndDate] = useState<DateValue | null>(null);
    const [selectedMarkets, setSelectedMarkets] = useState<Set<RightsData>>(new Set());
    const [selectedMediaChannels, setSelectedMediaChannels] = useState<Set<RightsData>>(new Set());
    const [clearAllFacetsFunction, setClearAllFacetsFunction] = useState<(() => void) | null>(null);
    const searchDisabledRef = useRef<boolean>(false);
    const isRightsSearchRef = useRef<boolean>(false);

    // Derive selectedFacetFilters (used for search API) from facetCheckedState
    const selectedFacetFilters = useMemo(() => {
        const newSelectedFacetFilters: string[][] = [];
        Object.keys(facetCheckedState).forEach(key => {
            const facetFilter: string[] = [];
            Object.entries(facetCheckedState[key]).forEach(([facet, isChecked]) => {
                if (isChecked) {
                    facetFilter.push(`${key}:${facet}`);
                }
            });
            if (facetFilter.length > 0) {
                newSelectedFacetFilters.push(facetFilter);
            }
        });
        
        // Return the same reference for empty arrays
        return newSelectedFacetFilters.length === 0 ? EMPTY_FACET_FILTERS : newSelectedFacetFilters;
    }, [facetCheckedState]);

    const handleSetSearchDisabled = useCallback((disabled: boolean) => {
        searchDisabledRef.current = disabled; // Update ref immediately
        setSearchDisabled(disabled);
    }, []);

    const handleSetIsRightsSearch = useCallback((isRights: boolean) => {
        isRightsSearchRef.current = isRights; // Update ref immediately
        setIsRightsSearch(isRights);
    }, []);

    // Handler for facet checkbox change - lifted from Facets component
    const handleFacetCheckbox = useCallback((key: string, facet: string) => {
        setFacetCheckedState(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [facet]: !prev[key]?.[facet]
            }
        }));
    }, []);

    // Callback to receive handleClearAllChecks function from Facets
    const handleReceiveClearAllFacets = useCallback((clearFunction: () => void) => {
        setClearAllFacetsFunction(() => clearFunction);
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
    const [cartAssetItems, setCartAssetItems] = useState<CartAssetItem[]>(() => {
        try {
            const stored = localStorage.getItem('cartAssetItems');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    const [cartTemplateItems, setCartTemplateItems] = useState<CartTemplateItem[]>([]);
    const [isCartPanelOpen, setIsCartPanelOpen] = useState<boolean>(false);

    // Download panel state
    const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState<boolean>(false);

    // Mobile filter panel state
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

    // Deep link asset details modal state
    const [deepLinkAsset, setDeepLinkAsset] = useState<Asset | null>(null);

    // Save search filters to session storage whenever they change
    useEffect(() => {
        // Only save if at least one filter has a value
        const hasFacets = Object.keys(facetCheckedState).some(key => 
            Object.values(facetCheckedState[key]).some(v => v)
        );
        const hasNumericFilters = selectedNumericFilters.length > 0;
        const hasRightsDates = rightsStartDate !== null || rightsEndDate !== null;
        const hasMarkets = selectedMarkets.size > 0;
        const hasMediaChannels = selectedMediaChannels.size > 0;

        if (!hasFacets && !hasNumericFilters && !hasRightsDates && !hasMarkets && !hasMediaChannels) {
            return; // Skip save if all filters are empty
        }

        saveSearchFiltersToSession(
            facetCheckedState,
            selectedNumericFilters,
            rightsStartDate,
            rightsEndDate,
            selectedMarkets,
            selectedMediaChannels
        );
    }, [facetCheckedState, selectedNumericFilters, rightsStartDate, rightsEndDate, selectedMarkets, selectedMediaChannels]);

    // Expose cart and download panel functions to window for EDS header integration
    useEffect(() => {
        window.openCart = () => setIsCartPanelOpen(true);
        window.closeCart = () => setIsCartPanelOpen(false);
        window.toggleCart = () => setIsCartPanelOpen(prev => !prev);
        window.openDownloadPanel = () => setIsDownloadPanelOpen(true);
        window.closeDownloadPanel = () => setIsDownloadPanelOpen(false);
        window.toggleDownloadPanel = () => setIsDownloadPanelOpen(prev => !prev);
        
        // Expose details view functions
        window.openDetailsView = (asset?: Asset) => {
            if (asset && asset.assetId) {
                setDeepLinkAsset(asset);
            }
        };
        window.closeDetailsView = () => {
            setDeepLinkAsset(null);
        };

        return () => {
            delete window.openCart;
            delete window.closeCart;
            delete window.toggleCart;
            delete window.openDownloadPanel;
            delete window.closeDownloadPanel;
            delete window.toggleDownloadPanel;
            delete window.openDetailsView;
            delete window.closeDetailsView;
        };
    }, []);

    useEffect(() => {
        const queryElement = document.querySelector("input.query-input") as HTMLInputElement;
        if (queryElement) {
            queryElement.value = query;
        }
     }, [query]);

    // Sort state
    const [selectedSortType, setSelectedSortType] = useState<string>('Date Created');
    const [selectedSortDirection, setSelectedSortDirection] = useState<string>('Ascending');

    const settingsLoadedRef = useRef<boolean>(false);

    // Save cart items to localStorage when they change
    useEffect(() => {
        saveCartItems(cartAssetItems);
    }, [cartAssetItems]);

    useEffect(() => {
        // Only create client when authenticated
        if (authenticated) {
            if (isCookieAuth()) {
                console.debug('🔑 Authenticated via Cookie.');
            } else {
                console.debug('🔑 Authenticated via other mechanism.');
            }
            setDynamicMediaClient(new DynamicMediaClient());
        } else {
            console.debug('🔑 Not authenticated (not IMS, nor cookie)');
            setDynamicMediaClient(null);
        }
    }, [authenticated]);

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
                    if (isRightsSearchRef.current && rightsStartDate && rightsEndDate && selectedMediaChannels.size > 0 && selectedMarkets.size > 0) {
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
        const facetArray = excFacets ? transformExcFacetsToHierarchyArray(excFacets) : [];
        dynamicMediaClient.searchAssets(query.trim(), {
            collectionId: selectedCollection?.collectionId,
            facets: facetArray,
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
        const rightsFiltersParam = params.get('rightsFilters');

        if (urlQuery !== null) setQuery(urlQuery);

        // Read search type from URL parameter first
        if (queryType !== null && (Object.values(QUERY_TYPES) as string[]).includes(queryType)) {
            setSelectedQueryType(queryType);
        } else {
            // If no URL parameter, try to infer from URL path
            const currentPath = window.location.pathname;
            if (currentPath.includes('/search/all')) {
                setSelectedQueryType(QUERY_TYPES.ALL);
            } else if (currentPath.includes('/search/assets')) {
                setSelectedQueryType(QUERY_TYPES.ASSETS);
            } else if (currentPath.includes('/search/products')) {
                setSelectedQueryType(QUERY_TYPES.PRODUCTS);
            }
        }

        // Apply saved search parameters if present
        if (fulltext || facetFiltersParam || numericFiltersParam || rightsFiltersParam) {
            loadingFromUrlRef.current = true; // Prevent auto-search during URL loading
            try {
                if (fulltext) setQuery(fulltext);
                if (facetFiltersParam) {
                    const facetFilters = JSON.parse(decodeURIComponent(facetFiltersParam));
                    setFacetCheckedState(facetFilters);
                }
                if (numericFiltersParam) {
                    const numericFilters = JSON.parse(decodeURIComponent(numericFiltersParam));
                    setSelectedNumericFilters(numericFilters);
                }
                if (rightsFiltersParam) {
                    const rightsFilters = JSON.parse(decodeURIComponent(rightsFiltersParam));
                    setRightsStartDate(rightsFilters.rightsStartDate ? epochToCalendarDate(rightsFilters.rightsStartDate / 1000) : null);
                    setRightsEndDate(rightsFilters.rightsEndDate ? epochToCalendarDate(rightsFilters.rightsEndDate / 1000) : null);
                    setSelectedMarkets(new Set(rightsFilters.markets));
                    setSelectedMediaChannels(new Set(rightsFilters.mediaChannels));
                }
                // Trigger search after a brief delay to ensure all state is updated
                setTimeout(() => {
                    setCurrentPage(0);
                    performSearchImages(fulltext || '', 0);
                    loadingFromUrlRef.current = false; // Re-enable auto-search after URL loading is complete
                }, 100);
            } catch (error) {
                console.warn('Error parsing URL search parameters:', error);
                loadingFromUrlRef.current = false; // Re-enable auto-search on error
            }
        }
    }, [dynamicMediaClient, performSearchImages]);

    useEffect(() => {
        if (!dynamicMediaClient) return;
        const url = new URL(window.location.href);
        // Only strip app-specific params; preserve others like id
        ['query', 'selectedQueryType', 'fulltext', 'facetFilters', 'numericFilters', 'rightsFilters']
            .forEach((key) => url.searchParams.delete(key));
        const next = url.pathname + (url.search ? `?${url.searchParams.toString()}` : '');
        window.history.replaceState({}, '', next);
    }, [selectedQueryType, dynamicMediaClient]);

    // Track if we're loading from URL parameters to prevent auto-search interference
    const loadingFromUrlRef = useRef<boolean>(false);

    // Load search filters from session storage on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const curPath = params.get('curPath');
        const nextPath = params.get('nextPath');
        
        // Remove navigation params from URL
        params.delete('curPath');
        params.delete('nextPath');
        const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
        
        // Only restore session filters if NOT navigating between different search paths
        // When navigating between paths (e.g., /search/all to /search/assets), start fresh
        if (curPath && nextPath && curPath === nextPath) {
            const sessionFilters = loadSearchFiltersFromSession();
            if (sessionFilters) {
                if (sessionFilters.facetCheckedState && Object.keys(sessionFilters.facetCheckedState).length > 0) {
                    setFacetCheckedState(sessionFilters.facetCheckedState);
                }
                if (sessionFilters.selectedNumericFilters && sessionFilters.selectedNumericFilters.length > 0) {
                    setSelectedNumericFilters(sessionFilters.selectedNumericFilters);
                }
                if (sessionFilters.rightsStartDate) {
                    setRightsStartDate(sessionFilters.rightsStartDate);
                }
                if (sessionFilters.rightsEndDate) {
                    setRightsEndDate(sessionFilters.rightsEndDate);
                }
                if (sessionFilters.selectedMarkets && sessionFilters.selectedMarkets.size > 0) {
                    setSelectedMarkets(sessionFilters.selectedMarkets);
                }
                if (sessionFilters.selectedMediaChannels && sessionFilters.selectedMediaChannels.size > 0) {
                    setSelectedMediaChannels(sessionFilters.selectedMediaChannels);
                }
            }
        } else {
            clearSearchFiltersFromSession();
        }
    }, []); // Run only once on mount

    // Auto-search with empty query on app load
    useEffect(() => {
        if (!loadingFromUrlRef.current && !searchDisabled && authenticated && dynamicMediaClient && excFacets !== undefined && document.querySelector('.koassets-search-wrapper')) {
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

        // Only attach image presets to asset of format image
        if (isImage(asset.format as string)) {
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
        if (!cartAssetItems.some(item => item.assetId === image.assetId)) {
            setCartAssetItems(prev => [...prev, image]);
        }
    };

    const handleRemoveFromCart = (image: Asset): void => {
        setCartAssetItems(prev => prev.filter(item => item.assetId !== image.assetId));
    };

    const handleBulkAddToCart = async (selectedCardIds: Set<string>, images: Asset[]): Promise<void> => {
        // Process all selected images in parallel
        const processCartImages = async (imageId: string): Promise<Asset | null> => {
            const image = images.find(img => img.assetId === imageId);
            if (!image || cartAssetItems.some(item => item.assetId === image.assetId)) {
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
            setCartAssetItems(prev => [...prev, ...newItems]);
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
                <Suspense fallback={<></>}>
                    <ImageGallery
                        images={dmImages}
                        loading={loading[LOADING.dmImages]}
                        onAddToCart={handleAddToCart}
                        onRemoveFromCart={handleRemoveFromCart}
                        cartAssetItems={cartAssetItems}
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
                        onFacetCheckbox={handleFacetCheckbox}
                        onClearAllFacets={clearAllFacetsFunction || undefined}
                        deepLinkAsset={deepLinkAsset}
                        onCloseDeepLinkModal={() => {
                            setDeepLinkAsset(null);
                        }}
                        query={query}
                        facetCheckedState={facetCheckedState}
                        selectedNumericFilters={selectedNumericFilters}
                        rightsStartDate={rightsStartDate}
                        rightsEndDate={rightsEndDate}
                        selectedMarkets={selectedMarkets}
                        selectedMediaChannels={selectedMediaChannels}
                    />
                </Suspense>
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

                {/* Cart Container - moved from HeaderBar, now uses Portal */}
                {createPortal(
                    <CartPanel
                        isCartPanelOpen={isCartPanelOpen}
                        onCloseCartPanel={() => setIsCartPanelOpen(false)}
                        cartAssetItems={cartAssetItems}
                        setCartAssetItems={setCartAssetItems}
                        cartTemplateItems={cartTemplateItems}
                        setCartTemplateItems={setCartTemplateItems}
                        onRemoveItem={handleRemoveFromCart}
                    />,
                    document.body
                )}

                {/* Download Panel - similar to Cart Panel */}
                {createPortal(
                    <DownloadPanel
                        isDownloadPanelOpen={isDownloadPanelOpen}
                        onCloseDownloadPanel={() => setIsDownloadPanelOpen(false)}
                    />,
                    document.body
                )}

                <div className="main-content">
                    <div className="images-container">
                        <div className="images-content-wrapper">
                            <div className="images-content-row">
                                <div className="images-main">
                                    {breadcrumbs}
                                    {enhancedGallery}
                                </div>
                                <div className={`facet-filter-panel ${isMobileFilterOpen ? 'mobile-open' : ''}`}>
                                    <Suspense fallback={<></>}>
                                        <Facets
                                            searchResults={searchResults}
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
                                            facetCheckedState={facetCheckedState}
                                            setFacetCheckedState={setFacetCheckedState}
                                            onFacetCheckbox={handleFacetCheckbox}
                                            onClearAllFacets={handleReceiveClearAllFacets}
                                        />
                                    </Suspense>
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
