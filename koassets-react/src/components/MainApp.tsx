import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../MainApp.css';
import { DynamicMediaClient } from '../dynamicmedia-client';
import type {
    Asset,
    CartItem,
    Collection,
    CurrentView,
    LoadingState,
    Rendition,
    SearchResult,
    SearchResults
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { populateAssetFromHit } from '../utils/assetTransformers';
import { fetchOptimizedDeliveryBlob, removeBlobFromCache } from '../utils/blobCache';
import { getBucket } from '../utils/config';

// Components
import Facets from './Facets';
import Footer from './Footer';
import HeaderBar from './HeaderBar';
import ImageGallery from './ImageGallery';
import SearchBar from './SearchBar';

const searchAssetsTitle = 'Search Assets - where you can discover the company\'s latest and greatest content!';
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

    const [searchResults, setSearchResults] = useState<SearchResults['results'] | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState<LoadingState>({ [LOADING.dmImages]: false, [LOADING.collections]: false });
    const [currentView, setCurrentView] = useState<CurrentView>(CURRENT_VIEW.images);
    const [selectedQueryType, setSelectedQueryType] = useState<string>(QUERY_TYPES.ASSETS);
    const [selectedFacetFilters, setSelectedFacetFilters] = useState<string[][]>([]);
    const [selectedNumericFilters, setSelectedNumericFilters] = useState<string[]>([]);
    const [excFacets, setExcFacets] = useState<Record<string, unknown> | undefined>(undefined);
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

    }, [dynamicMediaClient, processDMImages, selectedCollection, selectedFacetFilters, selectedNumericFilters, excFacets]);






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
        // Search for assets or assets in a collection
        performSearchImages(query, 0);
    }, [performSearchImages, query]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dynamicMediaClient, accessToken, excFacets, selectedFacetFilters, selectedNumericFilters]);

    useEffect(() => {
        if (accessToken && !settingsLoadedRef.current) {
            setExcFacets(JSON.parse('{"tccc-brand":{"label":"Brand","type":"tags","displayOrder":1,"rootPaths":{"TCCC : Brand":{"label":"Brand"}}},"tccc-campaignName":{"label":"Campaign","type":"string","displayOrder":2},"tccc-assetCategoryAndType":{"type":"tags","label":"Asset Category & Asset Type Execution","displayOrder":3,"rootPaths":{"TCCC : Asset Category and Asset Type Execution":{"label":"Asset Category & Asset Type Execution"}}},"tccc-masterOrAdaptation":{"label":"Master or Adaptation","type":"string","displayOrder":4},"tccc-readyToUse":{"label":"Rights Free","type":"string","displayOrder":5},"tccc-intendedBusinessUnitOrMarket":{"label":"Intended Market","type":"tags","displayOrder":6,"rootPaths":{"TCCC : Intended Market":{"label":"Intended Market"}}},"tccc-intendedChannel":{"label":"Intended Channel","type":"string","displayOrder":7,"rootPaths":{"TCCC : Intended Channel":{"label":"Intended Channel"}}},"tccc-intendedBottlerCountry":{"label":"Bottler Content by Country","type":"string","displayOrder":8},"tccc-packageContainerSize":{"label":"Package Size","type":"string","displayOrder":9},"tccc-agencyName":{"label":"Agency Name","type":"string","displayOrder":10},"repo-createDate":{"label":"Date created","type":"date","displayOrder":11},"tccc-marketCovered":{"label":"Market Rights Covered","type":"string","displayOrder":12},"tccc-mediaCovered":{"label":"Media Rights Covered","type":"string","displayOrder":13}}'));
            settingsLoadedRef.current = true;
            // const excClient = new ExcClient({ accessToken });
            // // Get facets from EXC
            // excClient.getExcFacets({}).then(facets => {
            //     setExcFacets(facets);
            // }).catch(error => {
            //     console.error('Error fetching facets:', error);
            // });
        }
    }, [accessToken]);



    // Function to fetch and cache static renditions for a specific asset
    const fetchAssetRenditions = useCallback(async (asset: Asset): Promise<void> => {
        if (!dynamicMediaClient || !asset.assetId) return;

        // Check cache first - use functional state update to get current state
        let shouldFetch = false;
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
            shouldFetch = true;
            return prevCache; // No state change yet
        });

        if (!shouldFetch) return;

        try {
            const renditions = await dynamicMediaClient.getAssetRenditions(asset);
            setAssetRenditionsCache(prev => ({
                ...prev,
                [asset.assetId!]: renditions
            }));
        } catch (error) {
            console.error('Failed to fetch asset static renditions:', error);
            // Set empty object on error to prevent retry loops
            setAssetRenditionsCache(prev => ({
                ...prev,
                [asset.assetId!]: {}
            }));
        } finally {
            // Remove from fetching set when done (success or error)
            fetchingAssetsRef.current.delete(asset.assetId!);
        }
    }, [dynamicMediaClient]);

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
                    title={selectedCollection ? `${selectedCollection.collectionMetadata?.title} Collection` : searchAssetsTitle}
                    images={dmImages}
                    loading={loading[LOADING.dmImages]}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                    cartItems={cartItems}
                    dynamicMediaClient={dynamicMediaClient}
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
                    setImagePresets={setImagePresets}
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
            {/* TODO: Update this once finalized */}
            {window.location.pathname !== '/assets-search/' && (
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