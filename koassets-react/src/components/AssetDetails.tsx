import React, { useEffect, useState } from 'react';
import type { AssetDetailsProps } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import { formatCategory, formatDate, formatFileSize, removeHyphenTitleCase } from '../utils/formatters';
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
        <div className="asset-details-modal" onClick={handleOverlayClick}>
            <div className="asset-details-modal-inner" onClick={handleModalClick}>
                <button className="assets-details-close-button" onClick={closeModal}>
                    ×
                </button>

                <div className="assets-details-content">
                    <div className="assets-details-image-section">
                        {imageLoading ? (
                            <div className="assets-details-image-loading">
                                <div className="loading-spinner"></div>
                                <p>Loading high resolution image...</p>
                            </div>
                        ) : (
                            <img
                                src={blobUrl || selectedImage.url}
                                alt={selectedImage.alt || selectedImage.name}
                                className="assets-details-image"
                            />
                        )}
                    </div>

                    <div className="assets-details-info-section">
                        <div className="assets-details-info-section-inner">
                            <div className="assets-details-header">
                                <div className="assets-details-tags">
                                    {selectedImage?.['tccc-campaignName'] as string && (
                                        <span className="assets-details-tag tccc-tag">{removeHyphenTitleCase(selectedImage['tccc-campaignName'] as string)}</span>
                                    )}
                                </div>
                                <h2 className="assets-details-title">
                                    {selectedImage.title}
                                </h2>
                                {selectedImage?.description && (
                                    <p className="assets-details-description">{selectedImage?.description}</p>
                                )}
                            </div>

                            <div className="details-modal-details">
                                <div className="details-modal-grid">
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">CREATED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatDate(selectedImage['repo-createDate'] as number)}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">TYPE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.format || 'Unknown'}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">SIZE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatFileSize(selectedImage.size)}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">LAST MODIFIED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatDate(selectedImage.modifyDate)}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RES.</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatCategory(selectedImage.resolution as string || 'Unknown')}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">EXPIRED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{`${selectedImage.expired}`}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">USAGE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatCategory(selectedImage.usage as string || 'Unknown')}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RIGHTS FREE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{formatCategory(selectedImage.rightsFree as string || 'Unknown')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tccc-assets-rights-container">
                                <div className="tccc-assets-rights-inner">
                                    <h3 className="tccc-assets-rights-title">Rights</h3>
                                    <div className="tccc-assets-rights-grid">
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS PROFILE TITLE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.['tccc-rightsProfileTitle'] as string || 'Unknown'}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MARKET COVERED</span>
                                            <span className="tccc-metadata-value">{selectedImage?.['tccc-marketCovered'] as string || 'Unknown'}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS START DATE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.['tccc-rightsStartDate'] as string || 'Unknown'}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS END DATE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.['tccc-rightsEndDate'] as string || 'Unknown'}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MEDIA</span>
                                            <span className="tccc-metadata-value">{selectedImage?.['tccc-media'] as string || 'Unknown'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                className={`assets-details-add-to-cart-button${isInCart ? ' remove-from-cart' : ''}`}
                                onClick={handleButtonClick}
                            >
                                {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetDetails; 