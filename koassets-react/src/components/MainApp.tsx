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
    SearchResults
} from '../types';
import { CURRENT_VIEW, LOADING, QUERY_TYPES } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { getBucket } from '../utils/config';

// Components
import CollectionGallery from './CollectionGallery';
import FacetFilter from './FacetFilter';
import Footer from './Footer';
import HeaderBar from './HeaderBar';
import ImageGallery from './ImageGallery';
import SearchBar from './SearchBar';

const searchAssetsTitle = 'Search Assets - where you can discover the company\'s latest and greatest content!';
const searchCollectionsTitle = 'My Collections';
const HITS_PER_PAGE = 2400;

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
    const [hits, setHits] = useState<SearchResults | null>(null);
    const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState<LoadingState>({ [LOADING.dmImages]: false, [LOADING.collections]: false });
    const [currentView, setCurrentView] = useState<CurrentView>(CURRENT_VIEW.images);
    const [selectedQueryType, setSelectedQueryType] = useState<string>(QUERY_TYPES.ASSETS);
    const [selectedFacetFilters, setSelectedFacetFilters] = useState<string[][]>([]);

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

        setHits(null);
        try {
            const contentData = content as Record<string, unknown>;
            const results = contentData.results as Array<Record<string, unknown>>;
            
            if (results && results[0]?.hits) {
                const hits = results[0].hits as Array<Record<string, unknown>>;
                if (hits.length > 0) {
                    // No longer download blobs upfront - just prepare metadata for lazy loading
                    // Each hit is transformed to match the Asset interface
                    const processedImages: Asset[] = hits.map((hit: Record<string, unknown>): Asset => {
                        const repoName = (hit['repo-name'] as string) || 'Untitled';

                        // Mapping hit data to Asset interface properties
                        return {
                            assetId: hit.assetId as string,
                            name: repoName,
                            url: '', // Empty URL - will be loaded lazily
                            alt: (hit['dc-title'] as string) || (hit['repo-name'] as string) || 'Asset',
                            size: (hit['size'] as number) || 0,
                            format: (hit?.['dc-format-label'] as string) || 'Unknown',
                            creator: hit?.['dc-creator'] as string,
                            mimeType: (hit['repo-mimetype'] as string) || 'Unknown',
                            path: (hit['repo-path'] as string) || '',
                            tags: (hit['xcm-machineKeywords'] as string[]) || [],
                            description: hit?.['tccc-description'] as string || hit?.['dc-description'] as string,
                            title: hit?.['dc-title'] as string,
                            subject: hit?.['dc-subject'] as string | string[],
                            createDate: hit?.['repo-createDate'] as string,
                            modifyDate: hit?.['repo-modifyDate'] as string,
                            expired: hit?.['is_pur-expirationDate'] as boolean,
                            category: (hit?.['tccc-assetCategoryAndType_hidden'] as string[])?.length > 0 
                                ? (hit?.['tccc-assetCategoryAndType_hidden'] as string[])[0].split('|')[0] 
                                : 'Unknown',
                            ...hit
                        } as Asset;
                    });

                    if (isLoadingMore) {
                        // Append to existing images
                        setDmImages(prev => [...prev, ...processedImages]);
                    } else {
                        // Replace existing images
                        setDmImages(processedImages);
                    }
                }
                // Store the complete results object with nbHits and update pagination info
                setHits(results[0] as SearchResults);
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
    const processCollections = useCallback(async (content: any): Promise<void> => {
        setCollections([]);
        try {
            if (content.results && content.results[0]?.hits) {
                const processedCollections: Collection[] = content.results[0].hits.map((hit: any) => ({
                    collectionId: hit.objectID,
                    collectionMetadata: hit.collectionMetadata || {},
                    thumbnail: hit.thumbnail,
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
    const performSearchImages = useCallback((query: string, selectedCollection: Collection | null = null, selectedFacetFilters: string[][] = [], page: number = 0): void => {
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

    }, [dynamicMediaClient, processDMImages]);

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
        setCurrentPage(0);
        handleSetSelectedQueryType(QUERY_TYPES.ASSETS);
        performSearchImages('', collection, [], 0);
        setQuery('');
    }, [handleSetSelectedQueryType, performSearchImages]);

    // Handler for loading more results (pagination)
    const handleLoadMoreResults = useCallback((): void => {
        if (currentPage + 1 < totalPages && !isLoadingMore) {
            const nextPage = currentPage + 1;
            setCurrentPage(nextPage);
            performSearchImages(query, selectedCollection, selectedFacetFilters, nextPage);
        }
    }, [currentPage, totalPages, isLoadingMore, selectedCollection, selectedFacetFilters, performSearchImages]);

    // Handler for searching
    const search = useCallback((): void => {
        setCurrentPage(0);
        if (selectedQueryType === QUERY_TYPES.COLLECTIONS) {
            // Search for collections
            performSearchCollections(query);
        } else {
            // Search for assets or assets in a collection
            performSearchImages(query, selectedCollection, selectedFacetFilters, 0);
        }
    }, [selectedQueryType, selectedCollection, selectedFacetFilters, performSearchCollections, performSearchImages]);

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
        if (dynamicMediaClient && accessToken) {
            search();
        }
    }, [dynamicMediaClient, accessToken]);

    useEffect(() => {
        if (accessToken && !settingsLoadedRef.current) {
            settingsLoadedRef.current = true;
            const excClient = new ExcClient({ accessToken });
            excClient.getSettings({}).then(settings => {
                console.log('Settings:', settings);
            }).catch(error => {
                console.error('Error fetching settings:', error);
            });
        }
    }, [accessToken]);

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
                    hits={hits}
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
                                <FacetFilter
                                    hits={hits?.hits || []}
                                    selectedFacetFilters={selectedFacetFilters}
                                    setSelectedFacetFilters={setSelectedFacetFilters}
                                    search={search}
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