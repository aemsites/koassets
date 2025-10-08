import React, { useEffect, useState } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { AssetPreviewProps, Rendition } from '../types';
import { formatCategory, getFileExtension } from '../utils/formatters';
import { getAssetFieldDisplayName } from '../utils/displayUtils';
import ActionButton from './ActionButton';
import { BUTTON_CONFIGS } from './ActionButtonConfigs';
import './AssetPreview.css';
import Picture from './Picture';

const AssetPreview: React.FC<AssetPreviewProps> = ({
    showModal,
    selectedImage,
    closeModal,
    handleAddToCart,
    handleRemoveFromCart,
    cartAssetItems = [],
    renditions = {},
    fetchAssetRenditions
}) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    const [actionButtonEnable, setActionButtonEnable] = useState<boolean>(false);
    const [watermarkRendition, setWatermarkRendition] = useState<Rendition | undefined>(undefined);

    // Check if this item is already in the cart
    const isInCart = selectedImage ? cartAssetItems.some(cartAssetItem => cartAssetItem.assetId === selectedImage.assetId) : false;

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
        if (showModal && selectedImage) {
            setActionButtonEnable(false);
            setWatermarkRendition(undefined);
        }
    }, [showModal, selectedImage]);

    // Fetch renditions when modal opens
    useEffect(() => {
        if (showModal && selectedImage && fetchAssetRenditions) {
            fetchAssetRenditions(selectedImage);
        }
    }, [showModal, selectedImage, fetchAssetRenditions]);

    // Update watermarkRendition state based on renditions
    useEffect(() => {
        const foundWatermarkRendition = renditions.items?.find(rendition =>
            rendition.name?.toLowerCase().startsWith('watermark')
        );
        setWatermarkRendition(foundWatermarkRendition);
    }, [renditions]);

    // Update action button display based on watermarkRendition
    useEffect(() => {
        setActionButtonEnable(watermarkRendition ? true : false);
    }, [watermarkRendition]);

    if (!showModal || !selectedImage) return null;

    const handleDownloadPreview = async (): Promise<void> => {
        if (!selectedImage || !dynamicMediaClient) {
            console.warn('No asset or dynamic media client available for download');
            return;
        }

        if (!watermarkRendition) {
            console.warn('Download not available - no watermark rendition found');
            return;
        }

        try {
            console.log('Downloading watermark rendition:', watermarkRendition.name);
            await dynamicMediaClient.downloadAsset(selectedImage, watermarkRendition);
        } catch (error) {
            console.error('Failed to download asset:', error);
        }
    };

    return (
        <div className="asset-preview-modal portal-modal" onClick={handleOverlayClick}>
            <div className="asset-preview-modal-inner" onClick={handleModalClick}>
                <button className="modal-close-button" onClick={closeModal}>
                    ✕
                </button>

                <div className="asset-preview-modal-container">
                    <div className="modal-header">
                        <div className="preview-tags">
                            {(selectedImage?.campaignName as string) && (
                                <span className="preview-tag tccc-tag">{getAssetFieldDisplayName('campaignName', selectedImage?.campaignName as string)}</span>
                            )}
                        </div>
                        <h3 className="modal-title">
                            {selectedImage?.title}
                        </h3>
                    </div>

                    <div className="modal-image-container">
                        <Picture
                            key={selectedImage.assetId}
                            asset={selectedImage}
                            width={350}
                            className="modal-image"
                            eager={true}
                            fetchPriority="high"
                        />
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
                                <span className="preview-metadata-value tccc-metadata-value">{selectedImage.readyToUse}</span>
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
                                disabled={!actionButtonEnable}
                                config={BUTTON_CONFIGS.download}
                                hasLoadingState={true}
                                onClick={handleDownloadPreview}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetPreview; 