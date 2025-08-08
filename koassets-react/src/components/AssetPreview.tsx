import React, { useEffect, useState } from 'react';
import type { AssetPreviewProps } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { formatCategory, formatFileSize, getFileExtension } from '../utils/formatters';
import './AssetPreview.css';

const AssetPreview: React.FC<AssetPreviewProps> = ({
    showModal,
    selectedImage,
    closeModal,
    handleAddToCart,
    handleRemoveFromCart,
    cartItems = [],
    dynamicMediaClient
}) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState<boolean>(false);

    // Check if this item is already in the cart
    const isInCart = selectedImage ? cartItems.some(cartItem => cartItem.assetId === selectedImage.assetId) : false;

    // Handle button click - either add or remove from cart
    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        if (!selectedImage) return;

        if (isInCart) {
            handleRemoveFromCart?.(selectedImage);
        } else {
            handleAddToCart?.(selectedImage, e);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    };

    const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    useEffect(() => {
        if (showModal && selectedImage && dynamicMediaClient) {
            setImageLoading(true);
            setBlobUrl(null);

            const fetchOptimizedImage = async () => {
                try {
                    // Fetch 350px optimized image for preview modal
                    const blobUrl = await fetchOptimizedDeliveryBlob(
                        dynamicMediaClient,
                        selectedImage,
                        350,
                        {
                            cache: true,
                            cacheKey: `${selectedImage.assetId}-350`,
                            fallbackUrl: selectedImage.url
                        }
                    );
                    setBlobUrl(blobUrl);
                } catch (error) {
                    console.error(`Error getting optimized delivery blob for asset ${selectedImage.assetId}: ${error}`);
                    // Fallback to original URL
                    setBlobUrl(selectedImage.url);
                } finally {
                    setImageLoading(false);
                }
            };

            fetchOptimizedImage();
        }
    }, [showModal, selectedImage, dynamicMediaClient]);

    // Separate effect for cleanup
    useEffect(() => {
        return () => {
            if (blobUrl && blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [blobUrl]);

    if (!showModal || !selectedImage) return null;

    return (
        <div className="image-modal-overlay" onClick={handleOverlayClick}>
            <div className="image-modal" onClick={handleModalClick}>
                <button className="modal-close-button" onClick={closeModal}>
                    ✕
                </button>

                <div className="modal-header">
                    <div className="modal-tags">
                        {selectedImage?.subject && (
                            <span className="modal-tag">{formatCategory(selectedImage['tccc-campaignName'])}</span>
                        )}
                    </div>
                    <h2 className="modal-title">
                        {selectedImage.name || selectedImage.alt || 'Untitled Asset'}
                    </h2>
                    {selectedImage?.description && (
                        <p className="modal-description">{selectedImage?.description}</p>
                    )}
                </div>

                <div className="modal-image-container">
                    {imageLoading ? (
                        <div className="modal-image-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading optimized image...</p>
                        </div>
                    ) : (
                        <img
                            src={blobUrl || selectedImage.url}
                            alt={selectedImage.alt || selectedImage.name}
                            className="modal-image"
                        />
                    )}
                </div>

                <div className="modal-details">
                    <div className="modal-detail-row">
                        <div className="modal-detail-group">
                            <span className="modal-detail-label">SIZE</span>
                            <span className="modal-detail-value">{formatFileSize(selectedImage.size)}</span>
                        </div>
                        <div className="modal-detail-group">
                            <span className="modal-detail-label">TYPE</span>
                            <span className="modal-detail-value">{selectedImage.format || 'Unknown'}</span>
                        </div>
                        <div className="modal-detail-group">
                            <span className="modal-detail-label">FILE EXT</span>
                            <span className="modal-detail-value">{getFileExtension(selectedImage.name || selectedImage.mimeType)}</span>
                        </div>
                    </div>
                    <div className="modal-detail-row">
                        <div className="modal-detail-group">
                            <span className="modal-detail-label">RIGHTS FREE</span>
                            <span className="modal-detail-value">N/A</span>
                        </div>
                        <div className="modal-detail-group">
                            <span className="modal-detail-label">CATEGORY</span>
                            <span className="modal-detail-value">{formatCategory(selectedImage?.subject)}</span>
                        </div>
                    </div>
                </div>

                <button
                    className={`modal-add-to-cart-button${isInCart ? ' remove-from-cart' : ''}`}
                    onClick={handleButtonClick}
                >
                    {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                </button>
            </div>
        </div>
    );
};

export default AssetPreview; 