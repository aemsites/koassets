import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AuthorizationStatus } from '../clients/fadel-client';
import { DEFAULT_ACCORDION_CONFIG } from '../constants/accordion';
import { useAppConfig } from '../hooks/useAppConfig';
import type { Asset, ImageGalleryProps } from '../types';
import AssetCard from './AssetCard';
import AssetDetails from './AssetDetails/';
import AssetPreview from './AssetPreview';
import './ImageGallery.css';
import SearchPanel from './SearchPanel';

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
    onClearAllFacets
}: ImageGalleryProps) => {
    // Get external params and dynamic media client from context
    const { externalParams } = useAppConfig();

    // Extract accordion parameters from external params with fallbacks
    const accordionTitle = externalParams?.accordionTitle || DEFAULT_ACCORDION_CONFIG.accordionTitle;
    const accordionContent = externalParams?.accordionContent || DEFAULT_ACCORDION_CONFIG.accordionContent;

    // Modal state management for asset preview
    const [selectedCard, setSelectedCard] = useState<Asset | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    // Modal state management for asset details (card click)
    const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
    // Checkbox selection state
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    // Show full details toggle state
    const [expandAllDetails, setExpandAllDetails] = useState<boolean>(true);
    // View type state (grid or list)
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
    // Title expansion state
    const [isTitleExpanded, setIsTitleExpanded] = useState<boolean>(false);
    // Select authorized state
    const [selectAuthorized, setSelectAuthorized] = useState<boolean>(false);

    const [visibleImages, setVisibleImages] = useState<Asset[]>(images);

    const displayedCount = visibleImages.length;
    const selectedCount = selectedCards.size;

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

    // Handle keyboard events for modals
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showDetailsModal) {
                    closeDetailsModal();
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
    }, [showPreviewModal, showDetailsModal]);

    // Create stable callback for opening details view
    const openDetailsView = useCallback(async (asset?: Asset, loadMetadata: boolean = false) => {
        console.debug('openDetailsView called with asset:', asset, 'loadMetadata:', loadMetadata);
        if (asset) {
            console.debug('Setting selected card with asset ID:', asset.assetId, 'Asset object:', JSON.stringify(asset, null, 2));
            setSelectedCard(asset as Asset);
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
    }, [openDetailsView]);

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

    // Handler to close asset details modal
    const closeDetailsModal = () => {
        setSelectedCard(null);
        setShowDetailsModal(false);
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
        console.log('Bulk share:', Array.from(selectedCards));
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
            />
        </div>
    );
};

export default ImageGallery; 