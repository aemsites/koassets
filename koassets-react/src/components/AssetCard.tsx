import React from 'react';
import { AuthorizationStatus } from '../clients/fadel-client';
import { EAGER_LOAD_IMAGE_COUNT } from '../constants/images';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AssetCardProps } from '../types';
import { getBucket } from '../utils/config';
import { formatCategory, getFileExtension } from '../utils/formatters';
import { getAssetFieldDisplayFacetName } from '../utils/displayUtils';
import ActionButton from './ActionButton';
import { BUTTON_CONFIGS } from './ActionButtonConfigs';
import Picture from './Picture';
import './AssetCardViewGrid.css';
import './AssetCardViewList.css';

export type ViewMode = 'grid' | 'list';

interface AssetCardBaseProps extends AssetCardProps {
    viewMode: ViewMode;
    className?: string;
}

const AssetCard: React.FC<AssetCardBaseProps> = ({
    image,
    handleCardDetailClick,
    handlePreviewClick,
    handleAddToCart,
    handleRemoveFromCart,
    cartAssetItems = [],
    isSelected = false,
    onCheckboxChange,
    expandAllDetails = true,
    index = 0,
    viewMode,
    className = '',
    onFacetCheckbox
}) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    
    // Check if this item is already in the cart
    const isInCart = cartAssetItems.some(cartAssetItem => cartAssetItem.assetId === image.assetId);

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
    const handleSelectCard = (e: React.ChangeEvent<HTMLInputElement>) => {
        onCheckboxChange?.(image.assetId || '', e.target.checked);
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

    // Dynamic classes and elements based on view mode
    const containerClass = `asset-card-view-${viewMode} ${className}`.trim();
    const innerClass = `asset-card-view-${viewMode}-inner`;
    
    // Title element - h3 for grid, div for list
    const TitleElement = viewMode === 'grid' ? 'h3' : 'div';
    
    // Action button wrappers
    const firstButtonWrapper = viewMode === 'grid' ? 'left-buttons-wrapper' : 'top-buttons-wrapper';
    const secondButtonWrapper = viewMode === 'grid' ? 'right-buttons-wrapper' : 'bottom-buttons-wrapper';

    // Metadata grid (shared between both views)
    const metadataGrid = expandAllDetails && (
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
    );

    // Authorization status (shared between both views)
    const authorizationStatus = (
        <>
            {(image.authorized === AuthorizationStatus.AVAILABLE) && (
                <span className="product-authorized-status green">AUTHORIZED</span>
            )}
            {(image.authorized === AuthorizationStatus.NOT_AVAILABLE || image.authorized === AuthorizationStatus.AVAILABLE_EXCEPT) && (
                <span className="product-authorized-status red">EXTENSION REQUIRED</span>
            )}
        </>
    );

    return (
        <div className={containerClass} id={image.assetId}>
            <div className={innerClass}>
                <div className="image-wrapper"
                    onClick={(e) => handleCardDetailClick(image, e)}
                    style={{ cursor: 'pointer' }}
                >
                    <input
                        type="checkbox"
                        className="tccc-checkbox"
                        checked={isSelected}
                        onChange={handleSelectCard}
                        onClick={(e) => e.stopPropagation()}
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

                    <Picture
                        key={image.assetId}
                        asset={image}
                        width={350}
                        className="image-container"
                        eager={index < EAGER_LOAD_IMAGE_COUNT}
                        fetchPriority={index < 2 ? 'high' : 'auto'}
                    />
                </div>

                <div className="product-info-container">
                    <div className="product-info">
                        <div className="product-title-section">
                            {image?.campaignName && (
                                <div className="product-tags">
                                    <span 
                                        className="product-tag tccc-tag"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onFacetCheckbox?.('tccc-campaignName', image?.campaignName as string);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {getAssetFieldDisplayFacetName('campaignName', image?.campaignName as string)}
                                    </span>
                                </div>
                            )}
                            <TitleElement
                                className="product-title"
                                onClick={(e) => handleCardDetailClick(image, e)}
                                style={{ cursor: 'pointer' }}
                            >
                                {image.title}
                            </TitleElement>
                            {authorizationStatus}
                        </div>

                        {metadataGrid}
                    </div>
                </div>

                <div className="product-actions">
                    <div className={firstButtonWrapper}>
                        {viewMode === 'grid' ? (
                            <button
                                className={`add-to-cart-btn${isInCart ? ' remove-from-cart' : ''}`}
                                onClick={handleAddRemoveCart}
                            >
                                {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                            </button>
                        ) : (
                            <ActionButton
                                config={BUTTON_CONFIGS.download}
                                hasLoadingState={true}
                                onClick={handleClickDownload}
                                style={{
                                    display: 'none'
                                }}
                            />
                        )}
                    </div>
                    <div className={secondButtonWrapper}>
                        {viewMode === 'grid' ? (
                            <ActionButton
                                config={BUTTON_CONFIGS.download}
                                hasLoadingState={true}
                                onClick={handleClickDownload}
                                style={{
                                    display: 'none'
                                }}
                            />
                        ) : (
                            <button
                                className={`add-to-cart-btn${isInCart ? ' remove-from-cart' : ''}`}
                                onClick={handleAddRemoveCart}
                            >
                                {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetCard;
