import React, { useEffect, useState } from 'react';
import type { Asset, ImageGalleryProps } from '../types';
import AssetCardViewGrid from './AssetCardViewGrid';
import AssetCardViewList from './AssetCardViewList';
import AssetDetails from './AssetDetails';
import AssetPreview from './AssetPreview';
import './ImageGallery.css';
import SearchPanel from './SearchPanel';

// Display list of images
const ImageGallery: React.FC<ImageGalleryProps> = ({
    title,
    images,
    loading,
    onAddToCart,
    onRemoveFromCart,
    cartItems = [],
    dynamicMediaClient,
    hits,
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
    isLoadingMore = false
}) => {
    // Modal state management for asset preview
    const [selectedCard, setSelectedCard] = useState<Asset | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    // Modal state management for asset details (card click)
    const [showFullScreenModal, setShowFullScreenModal] = useState<boolean>(false);
    // Checkbox selection state
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    // Show full details toggle state
    const [showFullDetails, setShowFullDetails] = useState<boolean>(true);
    // View type state (grid or list)
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

    const displayedCount = images.length;
    const selectedCount = selectedCards.size;

    // Handle keyboard events for modals
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showFullScreenModal) {
                    closeFullScreenModal();
                } else if (showPreviewModal) {
                    closeCardPreviewModal();
                }
            }
        };

        if (showPreviewModal || showFullScreenModal) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset'; // Restore scrolling
        };
    }, [showPreviewModal, showFullScreenModal]);

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
        setShowFullScreenModal(true);
    };

    // Handler to close asset details modal
    const closeFullScreenModal = () => {
        setShowFullScreenModal(false);
        setSelectedCard(null);
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
            setSelectedCards(new Set(images.map(img => img.assetId || '')));
        } else {
            setSelectedCards(new Set());
        }
    };

    // Bulk actions handlers
    const handleBulkAddToCartLocal = () => {
        onBulkAddToCart(selectedCards, images);
        setSelectedCards(new Set());
    };

    const handleBulkShare = () => {
        console.log('Bulk share:', Array.from(selectedCards));
    };

    const handleBulkAddToCollection = () => {
        console.log('Bulk add to collection:', Array.from(selectedCards));
    };

    // Calculate statistics
    const totalCount = hits && hits.nbHits ? (hits.nbHits > 100 ? '100+' : hits.nbHits.toString()) : '0';

    return (
        <div className="image-gallery">
            <div className="gallery-title">
                <h3>{title}</h3>
            </div>

            {/* Search Panels */}
            <SearchPanel
                totalCount={totalCount}
                selectedCount={selectedCount}
                displayedCount={displayedCount}
                onSelectAll={handleSelectAll}
                onToggleMobileFilter={onToggleMobileFilter}
                isMobileFilterOpen={isMobileFilterOpen}
                onBulkAddToCart={handleBulkAddToCartLocal}
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
                showFullDetails={showFullDetails}
                onShowFullDetailsChange={setShowFullDetails}
                viewType={viewType}
                onViewTypeChange={setViewType}
                hasMorePages={hasMorePages}
                currentPage={(hits?.page as number) || 0}
                totalPages={(hits?.nbPages as number) || 0}
            />

            {loading ? (
                <div className="image-grid-wrapper">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p>Loading images...</p>
                    </div>
                </div>
            ) : images.length === 0 ? (
                <div className="no-images">
                    <p>No images to display</p>
                </div>
            ) : (
                <div className="image-grid-wrapper">
                    <div className={viewType === 'grid' ? 'image-grid' : 'image-grid-list'}>
                        {images.map((image) => {
                            const CardComponent = viewType === 'grid' ? AssetCardViewGrid : AssetCardViewList;
                            return (
                                <CardComponent
                                    key={image.assetId}
                                    image={image}
                                    handleCardClick={handleCardDetailClick}
                                    handlePreviewClick={handleCardPreviewClick}
                                    handleAddToCart={handleAddToCart}
                                    handleRemoveFromCart={onRemoveFromCart}
                                    cartItems={cartItems}
                                    isSelected={selectedCards.has(image.assetId || '')}
                                    onCheckboxChange={handleCheckboxChange}
                                    dynamicMediaClient={dynamicMediaClient}
                                    showFullDetails={showFullDetails}
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
                </div>
            )}

            {/* Asset Preview Modal */}
            <AssetPreview
                showModal={showPreviewModal}
                selectedImage={selectedCard}
                closeModal={closeCardPreviewModal}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={onRemoveFromCart}
                cartItems={cartItems}
                dynamicMediaClient={dynamicMediaClient}
            />

            {/* Asset Details Modal */}
            <AssetDetails
                showModal={showFullScreenModal}
                selectedImage={selectedCard}
                closeModal={closeFullScreenModal}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={onRemoveFromCart}
                cartItems={cartItems}
                dynamicMediaClient={dynamicMediaClient}
            />
        </div>
    );
};

export default ImageGallery; 