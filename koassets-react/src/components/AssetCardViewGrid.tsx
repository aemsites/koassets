import React from 'react';
import { AuthorizationStatus } from '../clients/fadel-client';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AssetCardProps } from '../types';
import { getBucket } from '../utils/config';
import { formatCategory, getFileExtension, removeHyphenTitleCase } from '../utils/formatters';
import ActionButton from './ActionButton';
import { BUTTON_CONFIGS } from './ActionButtonConfigs';
import './AssetCardViewGrid.css';
import LazyImage from './LazyImage';

/* Displayed on the card view title section
campaignName
title
*/

const AssetCardViewGrid: React.FC<AssetCardProps> = ({
    image,
    handleCardDetailClick,
    handlePreviewClick,
    handleAddToCart,
    handleRemoveFromCart,
    cartItems = [],
    isSelected = false,
    onCheckboxChange,
    showFullDetails = true
}) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    // Check if this item is already in the cart
    const isInCart = cartItems.some(cartItem => cartItem.assetId === image.assetId);

    // Handle button click - either add or remove from cart
    const handleAddRemoveCart = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        if (isInCart) {
            handleRemoveFromCart?.(image);
        } else {
            handleAddToCart?.(image, e);
        }
    };

    // Handle checkbox change
    const handleCheckboxClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        onCheckboxChange?.(image.assetId || '', e.target.checked);
    };

    // Handle checkbox click to prevent propagation
    const handleCheckboxClickOnly = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click when clicking checkbox
    };

    // Handle action button click
    const handleClickDownload = async () => {
        if (!image || !dynamicMediaClient) {
            console.warn('No asset or dynamic media client available for download');
            return;
        }

        try {
            console.log('Downloading original asset:', image.assetId);
            await dynamicMediaClient.downloadAsset(image);
        } catch (error) {
            console.error('Failed to download asset:', error);
        }
    };

    // Handle add to collection click
    const handleAddToCollection = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Build a stable preview URL using Dynamic Media client (for collections)
        const previewUrl = dynamicMediaClient && image.assetId && image.name
            ? dynamicMediaClient.getOptimizedDeliveryPreviewUrl(image.assetId, image.name, 350)
            : undefined;
        const dmBucket = dynamicMediaClient ? getBucket() : undefined;
        // Trigger global collection modal with asset data (including previewUrl)
        const event = new CustomEvent('openCollectionModal', {
            detail: {
                asset: { ...image, previewUrl, dmBucket },
                assetPath: image.repositoryPath || image.assetId
            }
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="asset-card-view-grid" id={image.assetId}>
            <div className="asset-card-view-grid-inner">
                <div className="image-wrapper"
                    onClick={(e) => handleCardDetailClick(image, e)}
                    style={{ cursor: 'pointer' }}
                >
                    <input
                        type="checkbox"
                        className="tccc-checkbox"
                        checked={isSelected}
                        onChange={handleCheckboxClick}
                        onClick={handleCheckboxClickOnly}
                    />

                    <button
                        className="image-preview-button"
                        onClick={(e) => handlePreviewClick(image, e)}
                        title="View larger image"
                    >
                        <svg viewBox="0 0 256.001 256.001" xmlns="http://www.w3.org/2000/svg">
                            <path d="M159.997 116a12 12 0 0 1-12 12h-20v20a12 12 0 0 1-24 0v-20h-20a12 12 0 0 1 0-24h20V84a12 12 0 0 1 24 0v20h20a12 12 0 0 1 12 12Zm72.48 116.482a12 12 0 0 1-16.971 0l-40.679-40.678a96.105 96.105 0 1 1 16.972-16.97l40.678 40.678a12 12 0 0 1 0 16.97Zm-116.48-44.486a72 72 0 1 0-72-72 72.081 72.081 0 0 0 72 72Z" />
                        </svg>
                    </button>

                    {/* Add to Collection Overlay */}
                    <div className="add-to-collection-overlay" onClick={handleAddToCollection}>
                        <div className="add-to-collection-content">
                            <i className="icon add circle"></i>
                            <span>Add to Collection</span>
                        </div>
                    </div>

                    <LazyImage
                        asset={image}
                        width={350}
                        className="image-container"
                        alt={image.alt || image.name}
                    />
                </div>

                <div className="product-info-container">
                    <div className="product-info">
                        <div className="product-title-section">
                            <div className="product-tags">
                                {(image?.campaignName as string) && (
                                    <span className="product-tag tccc-tag">{removeHyphenTitleCase(image?.campaignName as string)}</span>
                                )}
                            </div>
                            <h3
                                className="product-title"
                                onClick={(e) => handleCardDetailClick(image, e)}
                                style={{ cursor: 'pointer' }}
                            >
                                {image.title}
                            </h3>
                            <>
                                {(image.authorized === AuthorizationStatus.AVAILABLE) && (
                                    <span className="product-authorized-status green">AUTHORIZED</span>
                                )}
                                {(image.authorized === AuthorizationStatus.NOT_AVAILABLE || image.authorized === AuthorizationStatus.AVAILABLE_EXCEPT) && (
                                    <span className="product-authorized-status red">EXTENSION REQUIRED</span>
                                )}
                            </>
                        </div>

                        {showFullDetails && (
                            <div className="product-meta-grid">
                                <div className="product-meta-item">
                                    <span className="product-meta-label tccc-metadata-label">SIZE</span>
                                    <span className="product-meta-value tccc-metadata-value">{image.formatedSize as string}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label tccc-metadata-label">TYPE</span>
                                    <span className="product-meta-value tccc-metadata-value">{image.formatLabel}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label tccc-metadata-label">FILE EXT</span>
                                    <span className="product-meta-value tccc-metadata-value">{getFileExtension(image.name as string)}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label tccc-metadata-label">RIGHTS FREE</span>
                                    <span className="product-meta-value tccc-metadata-value">{image.readyToUse}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label tccc-metadata-label">CATEGORY</span>
                                    <span className="product-meta-value tccc-metadata-value">{formatCategory(image?.category as string)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="product-actions">
                    <div className="left-buttons-wrapper">
                        <button
                            className={`add-to-cart-btn${isInCart ? ' remove-from-cart' : ''}`}
                            onClick={handleAddRemoveCart}
                        >
                            {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                        </button>
                    </div>
                    <div className="right-buttons-wrapper">
                        <ActionButton
                            config={BUTTON_CONFIGS.download}
                            hasLoadingState={true}
                            onClick={handleClickDownload}
                            style={{
                                display: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetCardViewGrid; 
