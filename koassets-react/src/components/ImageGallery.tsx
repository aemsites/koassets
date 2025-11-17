import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ToastQueue } from '@react-spectrum/toast';
import { AuthorizationStatus } from '../clients/fadel-client';
import { DEFAULT_ACCORDION_CONFIG } from '../constants/accordion';
import { useAppConfig } from '../hooks/useAppConfig';
import type { Asset, ImageGalleryProps } from '../types';
import { populateAssetFromHit } from '../utils/assetTransformers';
import { calendarDateToEpoch } from '../utils/formatters';
import buildSavedSearchUrl from '../../../scripts/saved-searches/saved-search-utils.js';
import AssetCard from './AssetCard';
import AssetDetails from './AssetDetails/';
import AssetPreview from './AssetPreview';
import './ImageGallery.css';
import SearchPanel from './SearchPanel';
import { loadSearchExpandAllDetailsState, saveSearchExpandAllDetailsState } from '../utils/toggleStateStorage';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous protocols
 */
function sanitizeHTML(html: string): string {
    if (!html) return '';

    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.textContent = html; // This escapes all HTML
    let sanitized = temp.innerHTML;

    // If the original HTML contains actual tags (not just text), use a more permissive approach
    if (html.includes('<') && html !== sanitized) {
        temp.innerHTML = html;

        // Remove script and style tags
        temp.querySelectorAll('script, style').forEach(el => el.remove());

        // Remove event handler attributes
        temp.querySelectorAll('*').forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (
                    attr.name.startsWith('on') ||
                    (attr.name === 'href' && (
                        /^(\s*)(javascript:|data:|vbscript:)/i.test(attr.value)
                    ))
                ) {
                    el.removeAttribute(attr.name);
                }
            });
        });

        sanitized = temp.innerHTML;
    }

    return sanitized;
}

// Display list of images
const ImageGallery: React.FC<ImageGalleryProps> = ({
    images,
    loading,
    onAddToCart,
    onRemoveFromCart,
    cartAssetItems = [],
    searchResult,
    onToggleMobileFilter,
    isMobileFilterOpen,
    onBulkAddToCart,
    onSortByTopResults,
    onSortByDateCreated,
    onSortByLastModified,
    onSortBySize,
    onSortDirectionAscending,
    onSortDirectionDescending,
    selectedSortType,
    selectedSortDirection,
    onSortTypeChange,
    onSortDirectionChange,
    onLoadMoreResults,
    hasMorePages = false,
    isLoadingMore = false,
    imagePresets = {},
    assetRenditionsCache = {},
    fetchAssetRenditions,
    isRightsSearch = false,
    onFacetCheckbox,
    onClearAllFacets,
    deepLinkAsset,
    onCloseDeepLinkModal,
    query = '',
    facetCheckedState = {},
    selectedNumericFilters = [],
    rightsStartDate,
    rightsEndDate,
    selectedMarkets,
    selectedMediaChannels
}: ImageGalleryProps) => {
    // Get external params and dynamic media client from context
    const { externalParams } = useAppConfig();

    console.debug('ImageGallery received deepLinkAsset:', deepLinkAsset);

    // Extract accordion parameters from external params with fallbacks
    // Sanitize HTML content to prevent XSS attacks
    const accordionTitle = sanitizeHTML(externalParams?.accordionTitle || DEFAULT_ACCORDION_CONFIG.accordionTitle);
    const accordionContent = sanitizeHTML(externalParams?.accordionContent || DEFAULT_ACCORDION_CONFIG.accordionContent);

    // Modal state management for asset preview
    const [selectedCard, setSelectedCard] = useState<Asset | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    // Modal state management for asset details (card click)
    const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
    // Checkbox selection state
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    // Show full details toggle state - load from local storage or use default (true)
    const [expandAllDetails, setExpandAllDetails] = useState<boolean>(() => loadSearchExpandAllDetailsState(true));
    // View type state (grid or list)
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
    // Title expansion state
    const [isTitleExpanded, setIsTitleExpanded] = useState<boolean>(false);
    // Select authorized state
    const [selectAuthorized, setSelectAuthorized] = useState<boolean>(false);

    const [visibleImages, setVisibleImages] = useState<Asset[]>(images);

    const displayedCount = visibleImages.length;
    const selectedCount = selectedCards.size;

    // Persist expandAllDetails state to local storage whenever it changes
    useEffect(() => {
        saveSearchExpandAllDetailsState(expandAllDetails);
    }, [expandAllDetails]);

    useEffect(() => {
        selectAuthorized ? setVisibleImages(images.filter(image => image.authorized === undefined || image.authorized === AuthorizationStatus.AVAILABLE)) : setVisibleImages(images);

        // Clear selection when filter changes to avoid showing incorrect counts
        setSelectedCards(new Set());
    }, [images, selectAuthorized]);

    // Reset select-authorized checkbox when new search results come in
    useEffect(() => {
        // Reset select-authorized checkbox (selectedCards is already cleared by the effect above)
        setSelectAuthorized(false);
    }, [images]);

    // Helper to check if current selected card is from deep link
    const isDeepLinkAsset = deepLinkAsset && selectedCard?.assetId === deepLinkAsset.assetId;

    // Handler to close asset details modal
    const closeDetailsModal = useCallback(() => {
        setSelectedCard(null);
        setShowDetailsModal(false);
        // If this was a deep link modal, notify parent
        if (deepLinkAsset && onCloseDeepLinkModal) {
            onCloseDeepLinkModal();
        }
    }, [deepLinkAsset, onCloseDeepLinkModal]);

    // Handle keyboard events for modals
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showDetailsModal) {
                    // Don't close if this is a deep link asset
                    if (!isDeepLinkAsset) {
                        closeDetailsModal();
                    }
                } else if (showPreviewModal) {
                    closeCardPreviewModal();
                }
            }
        };

        if (showPreviewModal || showDetailsModal) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset'; // Restore scrolling
        };
    }, [showPreviewModal, showDetailsModal, closeDetailsModal, isDeepLinkAsset]);

    // Create stable callback for opening details view
    const openDetailsView = useCallback(async (asset?: Asset) => {
        console.debug('openDetailsView called with asset:', JSON.stringify(asset, null, 2));
        if (asset) {
            // Check if asset has _searchHit (from search results) or is already fully populated (from metadata/deep link)
            if (asset._searchHit) {
                // Transform the asset from search hit
                const transformedAsset = populateAssetFromHit(asset._searchHit as Record<string, unknown>);
                console.debug('Setting selected card with asset ID:', transformedAsset.assetId, 'Asset object:', JSON.stringify(transformedAsset, null, 2));
                setSelectedCard(transformedAsset);
            } else {
                // Asset is already fully populated
                console.debug('Setting selected card with asset ID:', asset.assetId, 'Asset object:', JSON.stringify(asset, null, 2));
                setSelectedCard(asset);
            }
        } else {
            console.log('No asset provided to openDetailsView');
        }
        setShowDetailsModal(true);
    }, []);

    // Expose cart and download panel functions to window for EDS header integration
    useEffect(() => {
        window.openDetailsView = openDetailsView;
        window.closeDetailsView = () => closeDetailsModal();

        return () => {
            delete window.openDetailsView;
            delete window.closeDetailsView;
        };
    }, [openDetailsView, closeDetailsModal]);

    // Handle deep link asset
    useEffect(() => {
        console.debug('deepLinkAsset useEffect triggered with:', deepLinkAsset);
        if (deepLinkAsset) {
            console.debug('deepLinkAsset is truthy, calling openDetailsView');
            openDetailsView(deepLinkAsset);
        }
    }, [deepLinkAsset, openDetailsView]);

    // Handler for Add to Cart click with animation
    const handleAddToCart = (image: Asset, e?: React.MouseEvent) => {
        e?.stopPropagation();
        onAddToCart?.(image);
    };

    // Handler for preview button click to show asset preview modal
    const handleCardPreviewClick = (image: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCard(image);
        setShowPreviewModal(true);
    };

    // Handler to close asset preview modal
    const closeCardPreviewModal = () => {
        setShowPreviewModal(false);
        setSelectedCard(null);
    };

    // Handler for card click to show asset details modal
    const handleCardDetailClick = (image: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCard(image);
        setShowDetailsModal(true);
    };

    // Handle checkbox selection
    const handleCheckboxChange = (imageId: string, isChecked: boolean) => {
        setSelectedCards(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(imageId);
            } else {
                newSet.delete(imageId);
            }
            return newSet;
        });
    };

    // Handle select all
    const handleSelectAll = (isChecked: boolean) => {
        if (isChecked) {
            setSelectedCards(new Set(visibleImages.map(img => img.assetId || '')));
        } else {
            setSelectedCards(new Set());
        }
    };

    // Bulk actions handlers
    const handleBulkAddToCart = () => {
        onBulkAddToCart(selectedCards, visibleImages);
        setSelectedCards(new Set());
    };

    const handleBulkDownload = () => {
        console.log('Bulk download:', Array.from(selectedCards));
    };

    const handleBulkShare = () => {
        // Get selected assets
        const selectedAssets = visibleImages.filter(img => selectedCards.has(img.assetId || ''));

        if (selectedAssets.length === 0) {
            return;
        }

        // Dispatch the global share modal event with multiple assets
        const event = new CustomEvent('openShareModal', {
            detail: {
                assets: selectedAssets // Pass array of assets for bulk operation
            }
        });
        window.dispatchEvent(event);

        // Clear selection after action
        setSelectedCards(new Set());
    };

    const handleBulkAddToCollection = () => {
        // Get selected assets
        const selectedAssets = visibleImages.filter(img => selectedCards.has(img.assetId || ''));

        if (selectedAssets.length === 0) {
            return;
        }

        // Dispatch the global collection modal event with multiple assets
        const event = new CustomEvent('openCollectionModal', {
            detail: {
                assets: selectedAssets // Pass array of assets for bulk operation
            }
        });
        window.dispatchEvent(event);

        // Clear selection after action
        setSelectedCards(new Set());
    };

    // Handle share search - copy current search URL to clipboard
    const handleShareSearch = () => {
        // Build rights filters object if applicable
        const rightsFilters: Record<string, unknown> = {};
        if (isRightsSearch) {
            if (rightsStartDate) {
                rightsFilters.startDate = calendarDateToEpoch(rightsStartDate);
            }
            if (rightsEndDate) {
                rightsFilters.endDate = calendarDateToEpoch(rightsEndDate);
            }
            if (selectedMarkets && selectedMarkets.size > 0) {
                rightsFilters.markets = Array.from(selectedMarkets);
            }
            if (selectedMediaChannels && selectedMediaChannels.size > 0) {
                rightsFilters.mediaChannels = Array.from(selectedMediaChannels);
            }
        }

        // Get current search type path from URL
        const currentPath = window.location.pathname;
        let searchType = '/search/all';
        if (currentPath.includes('/search/assets')) {
            searchType = '/search/assets';
        } else if (currentPath.includes('/search/products')) {
            searchType = '/search/products';
        }

        // Build search object
        const searchObject = {
            searchTerm: query,
            facetFilters: facetCheckedState,
            numericFilters: selectedNumericFilters,
            rightsFilters: Object.keys(rightsFilters).length > 0 ? rightsFilters : undefined,
            searchType
        };

        // Build URL using shared utility
        const searchUrl = buildSavedSearchUrl(searchObject);

        // Copy to clipboard
        navigator.clipboard.writeText(searchUrl).then(() => {
            ToastQueue.positive('SEARCH LINK COPIED TO CLIPBOARD', { timeout: 3000 });
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = searchUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            ToastQueue.positive('SEARCH LINK COPIED TO CLIPBOARD', { timeout: 3000 });
        });
    };

    // Handle title expansion toggle
    const handleTitleToggle = () => {
        setIsTitleExpanded(!isTitleExpanded);
    };

    const handleSelectAuthorized = (isChecked: boolean) => {
        setSelectAuthorized(isChecked);
    };

    // Calculate statistics
    const totalCount = searchResult && searchResult.nbHits ? searchResult.nbHits.toString() : '0';

    return (
        <div className="image-gallery">
            <div className={`gallery-title ${isTitleExpanded ? 'expanded' : ''}`}>
                <div className="gallery-title-content">
                    <div className="gallery-title-icon" aria-label="Info"></div>
                    <h3 dangerouslySetInnerHTML={{ __html: accordionTitle }}></h3>
                </div>
                <button
                    className={`gallery-title-toggle ${isTitleExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={handleTitleToggle}
                />
            </div>
            {isTitleExpanded && (
                <div
                    className="gallery-title-expanded"
                    dangerouslySetInnerHTML={{ __html: accordionContent }}
                />
            )}

            {/* Search Panels */}
            <SearchPanel
                totalCount={totalCount}
                selectedCount={selectedCount}
                displayedCount={displayedCount}
                onSelectAll={handleSelectAll}
                onToggleMobileFilter={onToggleMobileFilter}
                isMobileFilterOpen={isMobileFilterOpen}
                onBulkAddToCart={handleBulkAddToCart}
                onBulkDownload={handleBulkDownload}
                onBulkShare={handleBulkShare}
                onBulkAddToCollection={handleBulkAddToCollection}
                onSortByTopResults={onSortByTopResults}
                onSortByDateCreated={onSortByDateCreated}
                onSortByLastModified={onSortByLastModified}
                onSortBySize={onSortBySize}
                onSortDirectionAscending={onSortDirectionAscending}
                onSortDirectionDescending={onSortDirectionDescending}
                selectedSortType={selectedSortType}
                selectedSortDirection={selectedSortDirection}
                onSortTypeChange={onSortTypeChange}
                onSortDirectionChange={onSortDirectionChange}
                expandAllDetails={expandAllDetails}
                onExpandAllDetailsChange={setExpandAllDetails}
                viewType={viewType}
                onViewTypeChange={setViewType}
                hasMorePages={hasMorePages}
                currentPage={(searchResult?.page as number) || 0}
                totalPages={(searchResult?.nbPages as number) || 0}
                selectAuthorized={selectAuthorized}
                onSelectAuthorized={handleSelectAuthorized}
                isRightsSearch={isRightsSearch}
                onShareSearch={handleShareSearch}
            />

            <div className="image-grid-wrapper">
                {loading ? (
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading images...</p>
                    </div>
                ) : visibleImages.length === 0 ? (
                    <div className="no-images">
                        <p>No images to display</p>
                    </div>
                ) : (
                    <>
                        <div className={viewType === 'grid' ? 'image-grid' : 'image-grid-list'}>
                            {visibleImages.map((visibleImage, index) => {
                                return (
                                    <AssetCard
                                        key={visibleImage.assetId}
                                        viewMode={viewType}
                                        image={visibleImage}
                                        handleCardDetailClick={handleCardDetailClick}
                                        handlePreviewClick={handleCardPreviewClick}
                                        handleAddToCart={handleAddToCart}
                                        handleRemoveFromCart={onRemoveFromCart}
                                        cartAssetItems={cartAssetItems}
                                        isSelected={selectedCards.has(visibleImage.assetId || '')}
                                        onCheckboxChange={handleCheckboxChange}
                                        expandAllDetails={expandAllDetails}
                                        index={index}
                                        onFacetCheckbox={onFacetCheckbox}
                                        onClearAllFacets={onClearAllFacets}
                                    />
                                );
                            })}
                        </div>

                        {/* Loading more indicator */}
                        {isLoadingMore && (
                            <div className="loading-more-container">
                                <div className="loading-spinner"></div>
                                <p>Loading more results...</p>
                            </div>
                        )}

                        {/* Load More Button */}
                        {hasMorePages && !isLoadingMore && (
                            <div className="load-more-button-container">
                                <button
                                    className="load-more-button"
                                    onClick={onLoadMoreResults}
                                >
                                    Load more
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Asset Preview Modal */}
            {createPortal(
                <AssetPreview
                    showModal={showPreviewModal}
                    closeModal={closeCardPreviewModal}
                    selectedImage={selectedCard}
                    handleAddToCart={handleAddToCart}
                    handleRemoveFromCart={onRemoveFromCart}
                    cartAssetItems={cartAssetItems}
                    renditions={selectedCard?.assetId ? assetRenditionsCache[selectedCard.assetId] : undefined}
                    fetchAssetRenditions={fetchAssetRenditions}
                />,
                document.body
            )}

            {/* Asset Details Modal */}
            <AssetDetails
                showModal={showDetailsModal}
                closeModal={closeDetailsModal}
                selectedImage={selectedCard}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={onRemoveFromCart}
                cartAssetItems={cartAssetItems}
                imagePresets={imagePresets}
                renditions={selectedCard?.assetId ? assetRenditionsCache[selectedCard.assetId] : undefined}
                fetchAssetRenditions={fetchAssetRenditions}
                isDeepLinkAsset={!!isDeepLinkAsset}
            />
        </div>
    );
};

export default ImageGallery; 