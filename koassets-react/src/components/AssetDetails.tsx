import React, { useEffect, useState } from 'react';
import type { AssetDetailsProps } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { formatCategory, formatFileSize, getFileExtension } from '../utils/formatters';
import './AssetDetails.css';

const AssetDetails: React.FC<AssetDetailsProps> = ({
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

            const fetchHighResImage = async () => {
                try {
                    // Just fetch high-res image directly, no caching for viewing
                    const blobUrl = await fetchOptimizedDeliveryBlob(
                        dynamicMediaClient,
                        selectedImage,
                        1200,
                        {
                            cache: true,
                            cacheKey: `${selectedImage.assetId}-1200`,
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

            fetchHighResImage();
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
        <div className="fullscreen-modal-overlay" onClick={handleOverlayClick}>
            <div className="fullscreen-modal" onClick={handleModalClick}>
                <button className="fullscreen-close-button" onClick={closeModal}>
                    ×
                </button>

                <div className="fullscreen-content">
                    <div className="fullscreen-image-section">
                        {imageLoading ? (
                            <div className="fullscreen-image-loading">
                                <div className="loading-spinner"></div>
                                <p>Loading high resolution image...</p>
                            </div>
                        ) : (
                            <img
                                src={blobUrl || selectedImage.url}
                                alt={selectedImage.alt || selectedImage.name}
                                className="fullscreen-image"
                            />
                        )}
                    </div>

                    <div className="fullscreen-info-section">
                        <div className="fullscreen-header">
                            <div className="fullscreen-tags">
                                {selectedImage.tags && selectedImage.tags.length > 0 && (
                                    selectedImage.tags.map((tag, index) => (
                                        <span key={index} className="fullscreen-tag">{tag}</span>
                                    ))
                                )}
                            </div>
                            <h2 className="fullscreen-title">
                                {selectedImage.name || selectedImage.alt || 'Untitled Asset'}
                            </h2>
                            {selectedImage?.description && (
                                <p className="fullscreen-description">{selectedImage?.description}</p>
                            )}
                        </div>

                        <div className="fullscreen-details">
                            <div className="fullscreen-detail-row">
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">SIZE</span>
                                    <span className="fullscreen-detail-value">{formatFileSize(selectedImage.size)}</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">TYPE</span>
                                    <span className="fullscreen-detail-value">{selectedImage.format || 'Unknown'}</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">FILE EXT</span>
                                    <span className="fullscreen-detail-value">{getFileExtension(selectedImage.name || selectedImage.mimeType)}</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">RIGHTS FREE</span>
                                    <span className="fullscreen-detail-value">N/A</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">CATEGORY</span>
                                    <span className="fullscreen-detail-value">{formatCategory(selectedImage?.subject)}</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">PATH</span>
                                    <span className="fullscreen-detail-value">{selectedImage.path || 'N/A'}</span>
                                </div>
                                <div className="fullscreen-detail-group">
                                    <span className="fullscreen-detail-label">CREATOR</span>
                                    <span className="fullscreen-detail-value">{selectedImage?.creator || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            className={`fullscreen-add-to-cart-button${isInCart ? ' remove-from-cart' : ''}`}
                            onClick={handleButtonClick}
                        >
                            {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetails; 