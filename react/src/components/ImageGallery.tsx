import React, { useEffect, useState } from 'react';
import type { Asset, ImageGalleryProps } from '../types';
import AssetCard from './AssetCard';
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
    onSortDirectionChange
}) => {
    // Modal state management for asset preview (zoom button)
    const [selectedCard, setSelectedCard] = useState<Asset | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
    // Modal state management for asset details (card click)
    const [showFullScreenModal, setShowFullScreenModal] = useState<boolean>(false);
    // Checkbox selection state
    const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
    // Show full details toggle state
    const [showFullDetails, setShowFullDetails] = useState<boolean>(true);

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

    // Handler for zoom button click to show asset preview modal
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
            setSelectedCards(new Set(images.map(img => img.id)));
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

    // Helper function to format file size
    const formatFileSize = (bytes?: number, decimalPoint: number = 2): string => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimalPoint < 0 ? 0 : decimalPoint;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Helper function to get file extension
    const getFileExtension = (filename?: string): string => {
        if (!filename) return '';
        return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
    };

    // Helper function to format category array
    const formatCategory = (categories?: string | string[]): string => {
        if (!categories) return 'Asset';

        // If it's a string, convert to array (split by comma)
        if (typeof categories === 'string') {
            const categoryArray = categories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
            return categoryArray.slice(0, 3).join(', ');
        }

        // If it's an array
        if (Array.isArray(categories)) {
            // Check if it's an array with a single comma-separated string
            if (categories.length === 1 && typeof categories[0] === 'string' && categories[0].includes(',')) {
                const categoryArray = categories[0].split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
                return categoryArray.slice(0, 3).join(', ');
            }
            // Otherwise treat as array of individual categories
            return categories.slice(0, 3).join(', ');
        }

        // Fallback
        return 'Asset';
    };

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
                    <div className="image-grid">
                        {images.map((image) => (
                            <AssetCard
                                key={image.id}
                                image={image}
                                handleCardClick={handleCardDetailClick}
                                handleZoomClick={handleCardPreviewClick}
                                formatFileSize={formatFileSize}
                                getFileExtension={getFileExtension}
                                formatCategory={formatCategory}
                                handleAddToCart={handleAddToCart}
                                handleRemoveFromCart={onRemoveFromCart}
                                cartItems={cartItems}
                                isSelected={selectedCards.has(image.id)}
                                onCheckboxChange={handleCheckboxChange}
                                dynamicMediaClient={dynamicMediaClient}
                                showFullDetails={showFullDetails}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Asset Preview Modal */}
            <AssetPreview
                showModal={showPreviewModal}
                selectedImage={selectedCard}
                closeModal={closeCardPreviewModal}
                formatCategory={formatCategory}
                formatFileSize={formatFileSize}
                getFileExtension={getFileExtension}
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
                formatCategory={formatCategory}
                formatFileSize={formatFileSize}
                getFileExtension={getFileExtension}
                handleAddToCart={handleAddToCart}
                handleRemoveFromCart={onRemoveFromCart}
                cartItems={cartItems}
                dynamicMediaClient={dynamicMediaClient}
            />
        </div>
    );
};

export default ImageGallery; 