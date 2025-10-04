import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { AssetDetailsProps, Rendition, Asset, Metadata } from '../../types';

import { AuthorizationStatus } from '../../clients/fadel-client';
import ActionButton from '../ActionButton';
import { BUTTON_CONFIGS } from '../ActionButtonConfigs';
import DownloadRenditionsModal from '../DownloadRenditionsModal';
import Picture from '../Picture';
import './AssetDetails.css';
import AssetDetailsDRM from './AssetDetailsDRM';
import AssetDetailsGeneralInfo from './AssetDetailsGeneralInfo';
import AssetDetailsIntendedUse from './AssetDetailsIntendedUse';
import AssetDetailsLegacyFields from './AssetDetailsLegacyFields';
import AssetDetailsMarketing from './AssetDetailsMarketing';
import AssetDetailsMarketingPackageContainer from './AssetDetailsMarketingPackageContainer';
import AssetDetailsOverview from './AssetDetailsOverview';
import AssetDetailsProduction from './AssetDetailsProduction';
import AssetDetailsScheduledActivation from './AssetDetailsScheduledActivation';
import AssetDetailsSystem from './AssetDetailsSystem';
import AssetDetailsSystemInfoLegacy from './AssetDetailsSystemInfoLegacy';
import AssetDetailsTechnicalInfo from './AssetDetailsTechnicalInfo';
import { populateAssetFromMetadata } from '../../utils/assetTransformers';

/* Displayed on the asset details modal header section
campaignName 
title
description
*/

const AssetDetails: React.FC<AssetDetailsProps> = ({
    showModal,
    selectedImage,
    closeModal,
    handleAddToCart,
    handleRemoveFromCart,
    cartAssetItems = [],
    imagePresets = {},
    renditions = {},
    fetchAssetRenditions
}) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    const [collapseAll, setCollapseAll] = useState<boolean>(false);
    const [showDownloadRenditionsModal, setShowDownloadRenditionsModal] = useState<boolean>(false);
    const [actionButtonEnable, setActionButtonEnable] = useState<boolean>(false);
    const [watermarkRendition, setWatermarkRendition] = useState<Rendition | undefined>(undefined);
    const [populatedImage, setPopulatedImage] = useState<Asset>(selectedImage as Asset);

    const rightsFree: boolean = (populatedImage?.readyToUse?.toLowerCase() === 'yes' || populatedImage?.authorized === AuthorizationStatus.AVAILABLE) ? true : false;

    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCollapseAll(e.target.checked);
    };

    // Check if this item is already in the cart
    const isInCart = populatedImage ? cartAssetItems.some(cartAssetItem => cartAssetItem.assetId === populatedImage.assetId) : false;

    // Handle button click - either add or remove from cart
    const handleAddRemoveCart = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        if (!populatedImage) return;

        if (isInCart) {
            handleRemoveFromCart?.(populatedImage);
        } else {
            handleAddToCart?.(populatedImage, e);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget && !showDownloadRenditionsModal) {
            closeModal();
        }
    };

    const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    // Handle action button click
    const handleDownloadPreview = async () => {
        if (!populatedImage || !dynamicMediaClient) {
            console.warn('No asset or dynamic media client available for download');
            return;
        }

        if (!watermarkRendition) {
            console.warn('Download not available - no watermark rendition found');
            return;
        }

        try {
            console.log('Downloading watermark rendition:', watermarkRendition.name);
            await dynamicMediaClient.downloadAsset(populatedImage, watermarkRendition);
        } catch (error) {
            console.error('Failed to download asset:', error);
        }
    };

    const handleClickDownloadRenditions = async () => {
        setShowDownloadRenditionsModal(true);
    };

    // Add to Collection (opens EDS modal used by plain JS flows)
    const handleAddToCollection = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!populatedImage) return;
        try {
            const previewUrl = dynamicMediaClient?.getOptimizedDeliveryPreviewUrl
                ? dynamicMediaClient.getOptimizedDeliveryPreviewUrl(populatedImage.assetId || '', populatedImage.name || '', 350)
                : undefined;
            const assetForModal = previewUrl ? { ...populatedImage, previewUrl } : populatedImage;
            const detail = { asset: assetForModal, assetPath: populatedImage.assetId } as unknown as Record<string, unknown>;
            window.dispatchEvent(new CustomEvent('openCollectionModal', { detail }));
        } catch (error) {
            console.warn('Failed to open Add to Collection modal from AssetDetails:', error);
        }
    };

    const handleCloseDownloadRenditionsModal = () => {
        setShowDownloadRenditionsModal(false);
    };

    useEffect(() => {
        if (showModal && selectedImage && dynamicMediaClient) {
            setPopulatedImage(selectedImage as Asset);

            const fetchMetadata = async () => {
                // Populate image with metadata
                const metadataCache = JSON.parse(sessionStorage.getItem('assetMetadataCache') || '{}');
                let metadata = metadataCache[selectedImage.assetId];

                if (!metadata) {
                    // Fetch metadata if not in cache
                    metadata = await dynamicMediaClient?.getMetadata(selectedImage.assetId);

                    // Store in sessionStorage
                    if (metadata) {
                        metadataCache[selectedImage.assetId] = metadata;
                        sessionStorage.setItem('assetMetadataCache', JSON.stringify(metadataCache));
                    }
                }

                console.debug('Metadata:', metadata);
                setPopulatedImage(
                    { ...selectedImage, ...populateAssetFromMetadata(metadata as Metadata) }
                );
            }

            fetchMetadata();
        };
    }, [showModal, selectedImage, dynamicMediaClient]);

    useEffect(() => {
        if (showModal && populatedImage) {
            setActionButtonEnable(false);
            setWatermarkRendition(undefined);
        };
    }, [showModal, populatedImage]);

    // Fetch static renditions when modal opens
    useEffect(() => {
        if (showModal && populatedImage && fetchAssetRenditions) {
            fetchAssetRenditions(populatedImage);
        }
    }, [showModal, populatedImage, fetchAssetRenditions]);

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

    // Image presets are now fetched automatically by fetchAssetRenditions in MainApp

    if (!showModal || !populatedImage) return null;

    // Get or create the modal root container - insert before header to ensure proper stacking
    const getModalRoot = () => {
        let modalRoot = document.getElementById('modal-root');
        if (!modalRoot) {
            modalRoot = document.createElement('div');
            modalRoot.id = 'modal-root';
            modalRoot.style.position = 'fixed';
            modalRoot.style.top = '0';
            modalRoot.style.left = '0';
            modalRoot.style.width = '100%';
            modalRoot.style.height = '100%';
            modalRoot.style.zIndex = '1'; // Very low z-index
            modalRoot.style.pointerEvents = 'none';

            // Insert before the header element to ensure proper DOM order
            const header = document.querySelector('header');
            if (header) {
                document.body.insertBefore(modalRoot, header);
            } else {
                document.body.appendChild(modalRoot);
            }
        }
        return modalRoot;
    };

    return (
        createPortal(<div className="asset-details-modal portal-modal"
            onClick={handleOverlayClick}
            style={{ pointerEvents: 'auto' }} // Re-enable pointer events for the modal
        >
            <div className="asset-details-modal-inner" onClick={handleModalClick}>
                <div className="asset-details-main-main-section">
                    <div className="asset-details-main-image-section">
                        <div className="asset-details-image-wrapper">
                            {/* Add to Collection Overlay */}
                            <div className="add-to-collection-overlay" onClick={handleAddToCollection}>
                                <div className="add-to-collection-content">
                                    <i className="icon add circle"></i>
                                    <span>Add to Collection</span>
                                </div>
                            </div>
                            <Picture
                                key={selectedImage?.assetId}
                                asset={populatedImage}
                                width={1200}
                                className="asset-details-main-image"
                            />
                        </div>
                    </div>

                    <div className="asset-details-main-info-section">
                        <div className="asset-details-main-info-section-inner">
                            <div className="asset-details-main-header">
                                <button className="asset-details-main-close-button" onClick={closeModal}>
                                    ×
                                </button>
                                {populatedImage?.xcmKeywords && (
                                    <div className="asset-details-main-tags">
                                        {populatedImage.xcmKeywords.split(',').map((keyword, index) => (
                                            <span key={index} className="asset-details-main-tag tccc-tag">
                                                {keyword.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="modal-title">
                                    {populatedImage.title}
                                </div>
                                {populatedImage?.description && (
                                    <p className="modal-description">{populatedImage?.description}</p>
                                )}
                            </div>

                            <div className="details-modal-details">
                                <div className="details-modal-grid">
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">CREATED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.createDate}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">TYPE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.illustratorType as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">SIZE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.formatedSize as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">LAST MODIFIED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.lastModified}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RES.</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.resolution as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">EXPIRED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.expired}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">USAGE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.usage as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RIGHTS FREE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{populatedImage.readyToUse}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tccc-assets-rights-container">
                                <div className="tccc-assets-rights-inner">
                                    <h3 className="tccc-assets-rights-title">Rights</h3>
                                    <div className="tccc-assets-rights-grid">
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS PROFILE TITLE</span>
                                            <span className="tccc-metadata-value">{populatedImage?.rightsProfileTitle as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MARKET COVERED</span>
                                            <span className="tccc-metadata-value">{populatedImage?.marketCovered as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS START DATE</span>
                                            <span className="tccc-metadata-value">{populatedImage?.rightsStartDate as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS END DATE</span>
                                            <span className="tccc-metadata-value">{populatedImage?.rightsEndDate as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MEDIA</span>
                                            <span className="tccc-metadata-value">{populatedImage?.media as string}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="product-actions">
                                <div className="left-buttons-wrapper">
                                    <ActionButton
                                        disabled={!actionButtonEnable}
                                        config={BUTTON_CONFIGS.download}
                                        hasLoadingState={true}
                                        onClick={handleDownloadPreview}
                                    />
                                </div>
                                <div className="right-buttons-wrapper">
                                    <button
                                        disabled={!rightsFree}
                                        className={`secondary-button`}
                                        onClick={handleClickDownloadRenditions}
                                    >
                                        Download
                                    </button>
                                    <button
                                        className={`asset-details-main-add-to-cart-button${isInCart ? ' remove-from-cart' : ''} primary-button`}
                                        onClick={handleAddRemoveCart}
                                    >
                                        {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="asset-details-main-toggle-section"></div>

                <div className="asset-details-main-metadata-section">
                    <div className="cmp-title">
                        <h1>
                            Collapse All
                            <label className="switch">
                                <input type="checkbox" checked={collapseAll} onChange={handleToggleChange} />
                                <span className="slider round"></span>
                            </label>
                        </h1>
                    </div>
                    <div className="asset-details-main-metadata-grid">
                        <div className="asset-details-main-metadata-left-container">
                            <AssetDetailsSystem selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsDRM selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsOverview selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsGeneralInfo selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsIntendedUse selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsScheduledActivation selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsTechnicalInfo selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsSystemInfoLegacy selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsProduction selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsLegacyFields selectedImage={populatedImage} forceCollapse={collapseAll} />
                        </div>
                        <div className="asset-details-main-metadata-right-container">
                            <AssetDetailsMarketing selectedImage={populatedImage} forceCollapse={collapseAll} />
                            <AssetDetailsMarketingPackageContainer selectedImage={populatedImage} forceCollapse={collapseAll} />
                        </div>
                    </div>
                </div>
            </div>

            {createPortal(
                <DownloadRenditionsModal
                    isOpen={showDownloadRenditionsModal}
                    asset={populatedImage}
                    onCloseDownloadRenditions={handleCloseDownloadRenditionsModal}
                    renditions={renditions}
                    imagePresets={imagePresets}
                />,
                document.body
            )}
        </div>,
            getModalRoot()
        )
    );
};

export default AssetDetails; 