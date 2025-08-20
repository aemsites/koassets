import React, { useEffect, useState } from 'react';
import { ORIGINAL_RENDITION } from '../dynamicmedia-client';
import type { AssetPreviewProps } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { formatCategory, getFileExtension, removeHyphenTitleCase } from '../utils/formatters';
import ActionButton from './ActionButton';
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
    const handleAddRemoveCart = (e: React.MouseEvent<HTMLButtonElement>) => {
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

    const handleClickDownload = async (): Promise<void> => {
        if (!selectedImage || !dynamicMediaClient) {
            console.warn('No asset or dynamic media client available for download');
            return;
        }

        try {
            console.log('Downloading original asset:', selectedImage.assetId);
            await dynamicMediaClient.downloadAsset(
                selectedImage,
                ORIGINAL_RENDITION
            );
        } catch (error) {
            console.error('Failed to download asset:', error);
        }
    };

    return (
        <div className="asset-preview-modal" onClick={handleOverlayClick}>
            <div className="asset-preview-modal-inner" onClick={handleModalClick}>
                <button className="modal-close-button" onClick={closeModal}>
                    ✕
                </button>

                <div className="asset-preview-modal-container">
                    <div className="modal-header">
                        <div className="preview-tags">
                            {(selectedImage?.campaignName as string) && (
                                <span className="preview-tag tccc-tag">{removeHyphenTitleCase(selectedImage?.campaignName as string)}</span>
                            )}
                        </div>
                        <h3 className="modal-title">
                            {selectedImage?.title}
                        </h3>
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

                    <div className="preview-modal-details">
                        <div className="preview-modal-grid">
                            <div className="preview-modal-group">
                                <span className="preview-metadata-label tccc-metadata-label">SIZE</span>
                                <span className="preview-metadata-value tccc-metadata-value">{selectedImage.formatedSize as string}</span>
                            </div>
                            <div className="preview-modal-group">
                                <span className="preview-metadata-label tccc-metadata-label">TYPE</span>
                                <span className="preview-metadata-value tccc-metadata-value">{selectedImage.formatLabel}</span>
                            </div>
                            <div className="preview-modal-group">
                                <span className="preview-metadata-label tccc-metadata-label">FILE EXT</span>
                                <span className="preview-metadata-value tccc-metadata-value">{getFileExtension(selectedImage.name as string)}</span>
                            </div>
                            <div className="preview-modal-group">
                                <span className="preview-metadata-label tccc-metadata-label">RIGHTS FREE</span>
                                <span className="preview-metadata-value tccc-metadata-value">{selectedImage.rightsFree}</span>
                            </div>
                            <div className="preview-modal-group">
                                <span className="preview-metadata-label tccc-metadata-label">CATEGORY</span>
                                <span className="preview-metadata-value tccc-metadata-value">{formatCategory(selectedImage?.category as string)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="product-actions">
                        <div className="left-buttons-wrapper">
                            <button
                                className={`modal-add-to-cart-button${isInCart ? ' remove-from-cart' : ''}`}
                                onClick={handleAddRemoveCart}
                            >
                                {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                            </button>
                        </div>
                        <div className="right-buttons-wrapper">
                            <ActionButton
                                name="download"
                                onClick={handleClickDownload}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetPreview; 