import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    SearchResult,
    SearchResults
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { populateAssetFromHit } from '../utils/assetTransformers';
import { fetchOptimizedDeliveryBlob, removeBlobFromCache } from '../utils/blobCache';
import { getBucket, getExternalParams } from '../utils/config';
import { AppConfigProvider } from './AppConfigProvider';

// Components
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

        setSearchResults(null);
        try {
            const contentData = content as Record<string, unknown>;
            const results = contentData.results as SearchResults['results'];

            if (results && results[0]?.hits) {
                const hits = results[0].hits as SearchResult['hits'];
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
            numericFilters: selectedNumericFilters,
            filters: presetFilters,
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

    }, [dynamicMediaClient, processDMImages, selectedCollection, selectedFacetFilters, selectedNumericFilters, excFacets, presetFilters]);

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
        dynamicMediaClient && window.history.replaceState({}, '', `${window.location.pathname}`);
    }, [selectedQueryType, dynamicMediaClient]);

    // Auto-search with empty query on app load
    useEffect(() => {
        if (dynamicMediaClient && accessToken && excFacets !== undefined) {
            search();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicMediaClient, accessToken, excFacets, selectedFacetFilters, selectedNumericFilters]);

    useEffect(() => {
        if (accessToken && !settingsLoadedRef.current) {
            setExcFacets(externalParams.excFacets || DEFAULT_FACETS);
            setPresetFilters(externalParams.presetFilters || []);
            settingsLoadedRef.current = true;
            // const excClient = new ExcClient({ accessToken });
            // // Get facets from EXC
            // excClient.getExcFacets({}).then(facets => {
            //     setExcFacets(facets);
            // }).catch(error => {
            //     console.error('Error fetching facets:', error);
            // });
        }
    }, [accessToken, externalParams.excFacets, externalParams.presetFilters]);



    // Function to fetch and cache static renditions for a specific asset
    const fetchAssetRenditions = useCallback(async (asset: Asset): Promise<void> => {
        if (!dynamicMediaClient || !asset.assetId) return;

        // Check cache first - use functional state update to get current state
        let shouldFetchRenditions = false;
        setAssetRenditionsCache(prevCache => {
            // If already cached, don't fetch
            if (prevCache[asset.assetId!]) {
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

        // Fetch image presets once for all assets (only if not already fetched/fetching)
        if (!imagePresets.items && !fetchingImagePresetsRef.current) {
            fetchingImagePresetsRef.current = true;
            try {
                const presets = await dynamicMediaClient.getImagePresets();
                setImagePresets(presets);
                asset.imagePresets = presets;
                console.log('Successfully fetched image presets');
            } catch (error) {
                console.error('Failed to fetch image presets:', error);
                setImagePresets({});
            } finally {
                fetchingImagePresetsRef.current = false;
            }
        } else {
            asset.imagePresets = imagePresets;
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
                            cache: false,
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

            // Cache the image in parallel
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
                    console.log(`Cached bulk image for cart: ${image.assetId}`);
                } catch (error) {
                    console.warn(`Failed to cache bulk image for cart ${image.assetId}:`, error);
                }
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
                    setCartItems={setCartItems}
                    isCartOpen={isCartOpen}
                    setIsCartOpen={setIsCartOpen}
                    handleRemoveFromCart={handleRemoveFromCart}
                    handleApproveAssets={handleApproveAssets}
                    handleDownloadAssets={handleDownloadAssets}
                    handleAuthenticated={handleAuthenticated}
                    handleSignOut={handleSignOut}
                />
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
