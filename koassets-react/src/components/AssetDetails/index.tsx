import React, { useEffect, useState } from 'react';
import type { AssetDetailsProps } from '../../types';
import { fetchOptimizedDeliveryBlob } from '../../utils/blobCache';
import { removeHyphenTitleCase } from '../../utils/formatters';
import ActionButton from '../ActionButton';
import DownloadRenditions from '../DownloadRenditions';
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
    cartItems = [],
    dynamicMediaClient
}) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [imageLoading, setImageLoading] = useState<boolean>(false);
    const [collapseAll, setCollapseAll] = useState<boolean>(false);
    const [showDownloadRenditionsModal, setShowDownloadRenditionsModal] = useState<boolean>(false);

    const rightsFree: boolean = selectedImage?.rightsFree?.toLowerCase() === 'yes' ? true : false;

    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCollapseAll(e.target.checked);
    };

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
        if (e.target === e.currentTarget && !showDownloadRenditionsModal) {
            closeModal();
        }
    };

    const handleModalClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    // Handle action button click
    const handleClickDownload = async () => {
        if (!selectedImage || !dynamicMediaClient) {
            console.warn('No asset or dynamic media client available for download');
            return;
        }

        try {
            console.log('Downloading original asset:', selectedImage.assetId);
            await dynamicMediaClient.downloadAsset(selectedImage);
        } catch (error) {
            console.error('Failed to download asset:', error);
        }
    };

    const handleClickDownloadRenditions = async () => {
        setShowDownloadRenditionsModal(true);
    };

    const handleDownloadRenditionsModalClose = () => {
        setShowDownloadRenditionsModal(false);
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
                <button className="asset-details-main-close-button" onClick={closeModal}>
                    ×
                </button>

                <div className="asset-details-main-main-section">
                    <div className="asset-details-main-image-section">
                        {imageLoading ? (
                            <div className="asset-details-main-image-loading">
                                <div className="loading-spinner"></div>
                                <p>Loading high resolution image...</p>
                            </div>
                        ) : (
                            <img
                                src={blobUrl || selectedImage.url}
                                alt={selectedImage.alt || selectedImage.name}
                                className="asset-details-main-image"
                            />
                        )}
                    </div>

                    <div className="asset-details-main-info-section">
                        <div className="asset-details-main-info-section-inner">
                            <div className="asset-details-main-header">
                                <div className="asset-details-main-tags">
                                    {selectedImage?.campaignName as string && (
                                        <span className="asset-details-main-tag tccc-tag">{removeHyphenTitleCase(selectedImage?.campaignName as string)}</span>
                                    )}
                                </div>
                                <h2 className="asset-details-main-title">
                                    {selectedImage.title}
                                </h2>
                                {selectedImage?.description && (
                                    <p className="asset-details-main-description">{selectedImage?.description}</p>
                                )}
                            </div>

                            <div className="details-modal-details">
                                <div className="details-modal-grid">
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">CREATED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.createDate}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">TYPE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.formatLabel}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">SIZE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.formatedSize as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">LAST MODIFIED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.lastModified}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RES.</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.resolution as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">EXPIRED</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.expired}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">USAGE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.usage as string}</span>
                                    </div>
                                    <div className="details-modal-group">
                                        <span className="details-metadata-label tccc-metadata-label">RIGHTS FREE</span>
                                        <span className="details-metadata-value tccc-metadata-value">{selectedImage.rightsFree}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="tccc-assets-rights-container">
                                <div className="tccc-assets-rights-inner">
                                    <h3 className="tccc-assets-rights-title">Rights</h3>
                                    <div className="tccc-assets-rights-grid">
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS PROFILE TITLE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.rightsProfileTitle as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MARKET COVERED</span>
                                            <span className="tccc-metadata-value">{selectedImage?.marketCovered as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS START DATE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.rightsStartDate as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">RIGHTS END DATE</span>
                                            <span className="tccc-metadata-value">{selectedImage?.rightsEndDate as string}</span>
                                        </div>
                                        <div className="tccc-assets-rights-group">
                                            <span className="tccc-metadata-label">MEDIA</span>
                                            <span className="tccc-metadata-value">{selectedImage?.media as string}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="product-actions">
                                <div className="left-buttons-wrapper">
                                    <ActionButton
                                        name="download"
                                        onClick={handleClickDownload}
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
                    <div className="cmp-title" id="showfulldetails">
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
                            <AssetDetailsSystem selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsDRM selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsOverview selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsGeneralInfo selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsIntendedUse selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsScheduledActivation selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsTechnicalInfo selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsSystemInfoLegacy selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsProduction selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsLegacyFields selectedImage={selectedImage} forceCollapse={collapseAll} />
                        </div>
                        <div className="asset-details-main-metadata-right-container">
                            <AssetDetailsMarketing selectedImage={selectedImage} forceCollapse={collapseAll} />
                            <AssetDetailsMarketingPackageContainer selectedImage={selectedImage} forceCollapse={collapseAll} />
                        </div>
                    </div>
                </div>
            </div>

            <DownloadRenditions
                isOpen={showDownloadRenditionsModal}
                asset={selectedImage}
                onClose={handleDownloadRenditionsModalClose}
                dynamicMediaClient={dynamicMediaClient ?? null}
            />
        </div>
    );
};

export default AssetDetails; 