import React, { useEffect, useRef, useState } from 'react';
import type { DynamicMediaClient } from '../clients/dynamicmedia-client';
import { Asset, Rendition } from '../types';
import { formatDimensions, formatFileSize, formatFormatName } from '../utils/formatters';
import './DownloadRenditionsContent.css';
import ThumbnailImage from './ThumbnailImage';

interface AssetData {
    asset: Asset;
    renditions: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    imagePresets: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    renditionsLoading: boolean;
    renditionsError: string | null;
}

interface SelectAllRenditionsCheckboxProps {
    assetData: AssetData;
    index: number;
    selectedRenditions: Set<Rendition>;
    collapsedAssets: Set<string>;
    isRenditionSelected: (rendition: Rendition) => boolean;
    handleRenditionToggle: (rendition: Rendition) => void;
    toggleAssetCollapse: (assetId: string) => void;
}

const SelectAllRenditionsCheckbox: React.FC<SelectAllRenditionsCheckboxProps> = ({
    assetData,
    index,
    selectedRenditions,
    collapsedAssets,
    isRenditionSelected,
    handleRenditionToggle,
    toggleAssetCollapse
}) => {
    const assetId = assetData.asset.assetId || `asset-${index}`;
    const allRenditions = [...(assetData.renditions.items || []), ...(assetData.imagePresets.items || [])];
    const nonOriginalRenditions = allRenditions.filter(rendition => rendition.name?.toLowerCase() !== 'original')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const selectedNonOriginalRenditions = nonOriginalRenditions.filter(rendition =>
        Array.from(selectedRenditions).some(r => r.name === rendition.name)
    );
    const isAllNonOriginalSelected = nonOriginalRenditions.length > 0 && selectedNonOriginalRenditions.length === nonOriginalRenditions.length;
    const isSomeNonOriginalSelected = selectedNonOriginalRenditions.length > 0 && selectedNonOriginalRenditions.length < nonOriginalRenditions.length;
    const isCollapsed = collapsedAssets.has(assetId);

    const checkboxRef = useRef<HTMLInputElement>(null);

    // Set indeterminate state when some but not all renditions are selected
    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.indeterminate = isSomeNonOriginalSelected;
        }
    }, [isSomeNonOriginalSelected]);

    if (nonOriginalRenditions.length === 0) return null;

    const handleNonOriginalSelectAllToggle = () => {
        if (isAllNonOriginalSelected) {
            // Deselect all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (isRenditionSelected(rendition)) {
                    handleRenditionToggle(rendition);
                }
            });
        } else {
            // Select all non-original renditions for this asset
            nonOriginalRenditions.forEach(rendition => {
                if (!isRenditionSelected(rendition)) {
                    handleRenditionToggle(rendition);
                }
            });
        }
    };

    return (
        <div className="select-all-item">
            <label
                className="select-all-checkbox-wrapper"
                onClick={(e) => {
                    e.stopPropagation();
                }}
                onMouseDown={(e) => {
                    e.stopPropagation();
                }}
                onMouseUp={(e) => {
                    e.stopPropagation();
                }}
            >
                <input
                    ref={checkboxRef}
                    type="checkbox"
                    className="tccc-checkbox"
                    checked={isAllNonOriginalSelected}
                    onChange={handleNonOriginalSelectAllToggle}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                />
                <span className="select-all-label-clickable">
                    ALL AVAILABLE RENDITIONS
                </span>
            </label>
            <button
                type="button"
                className={`renditions-toggle-btn ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleAssetCollapse(assetId);
                }}
            />
        </div>
    );
};

interface DownloadRenditionsContentProps {
    assets: AssetData[];
    dynamicMediaClient: DynamicMediaClient | null;
    selectedRenditions: Set<Rendition>;
    acceptTerms: boolean;
    isDownloading: boolean;
    onClose: () => void;
    handleDownloadRenditions: () => Promise<void>;
    isRenditionSelected: (rendition: Rendition) => boolean;
    handleRenditionToggle: (rendition: Rendition) => void;
    setAcceptTerms: (checked: boolean) => void;
}

const DownloadRenditionsContent: React.FC<DownloadRenditionsContentProps> = ({
    assets,
    dynamicMediaClient,
    selectedRenditions,
    acceptTerms,
    isDownloading,
    onClose,
    handleDownloadRenditions,
    isRenditionSelected,
    handleRenditionToggle,
    setAcceptTerms
}) => {
    // State for collapsed/expanded per asset - collapsed by default
    const [collapsedAssets, setCollapsedAssets] = useState<Set<string>>(() => {
        // Initialize all assets as collapsed
        const initialCollapsed = new Set<string>();
        assets.forEach((assetData, index) => {
            const assetId = assetData.asset.assetId || `asset-${index}`;
            initialCollapsed.add(assetId);
        });
        return initialCollapsed;
    });

    // Update collapsed state when assets change
    useEffect(() => {
        setCollapsedAssets(prev => {
            const newCollapsed = new Set(prev);
            assets.forEach((assetData, index) => {
                const assetId = assetData.asset.assetId || `asset-${index}`;
                if (!newCollapsed.has(assetId)) {
                    newCollapsed.add(assetId); // New assets start collapsed
                }
            });
            return newCollapsed;
        });
    }, [assets]);

    // Auto-select original rendition by default for each asset
    useEffect(() => {
        assets.forEach(assetData => {
            const originalRendition = [...(assetData.renditions.items || []), ...(assetData.imagePresets.items || [])]
                .find(rendition => rendition.name === 'original');

            if (originalRendition && !isRenditionSelected(originalRendition)) {
                handleRenditionToggle(originalRendition);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, isRenditionSelected]); // Intentionally excluding handleRenditionToggle to prevent infinite re-renders

    const toggleAssetCollapse = (assetId: string) => {
        setCollapsedAssets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(assetId)) {
                newSet.delete(assetId);
            } else {
                newSet.add(assetId);
            }
            return newSet;
        });
    };
    return (
        <div className="download-renditions-content">
            <div className="download-renditions-table">
                <div className="download-renditions-table-header">
                    <span>THUMBNAIL</span>
                    <span>TITLE</span>
                    <span>DOWNLOAD OPTIONS</span>
                </div>

                {/* Asset Rows */}
                {assets.map((assetData, index) => (
                    <div key={assetData.asset.assetId || index} className="download-renditions-row">
                        <div className="download-renditions-thumbnail">
                            <ThumbnailImage
                                item={assetData.asset}
                                dynamicMediaClient={dynamicMediaClient}
                            />
                        </div>
                        <div className="download-renditions-title">
                            {assetData.asset.name}
                        </div>
                        <div className="download-renditions-options">
                            {/* Renditions status feedback */}
                            {assetData.renditionsLoading && (
                                <div className="renditions-status loading">
                                    Loading available renditions...
                                </div>
                            )}
                            {assetData.renditionsError && (
                                <div className="renditions-status error">
                                    {assetData.renditionsError}
                                </div>
                            )}

                            {/* Individual rendition checkboxes */}
                            {!assetData.renditionsLoading && !assetData.renditionsError &&
                                (assetData.renditions.items && assetData.renditions.items.length > 0 ||
                                    assetData.imagePresets.items && assetData.imagePresets.items.length > 0) && (
                                    <div className="renditions-list">
                                        {/* Original rendition - always visible */}
                                        {(() => {
                                            const assetId = assetData.asset.assetId || `asset-${index}`;
                                            const allRenditions = [...(assetData.renditions.items || []), ...(assetData.imagePresets.items || [])];
                                            const originalRendition = allRenditions.find(rendition => rendition.name?.toLowerCase() === 'original');

                                            if (!originalRendition) return null;

                                            return (
                                                <label key={`${assetId}-original`} className="rendition-item">
                                                    <input
                                                        type="checkbox"
                                                        className="tccc-checkbox"
                                                        checked={isRenditionSelected(originalRendition)}
                                                        onChange={() => handleRenditionToggle(originalRendition)}
                                                    />
                                                    <span className="rendition-name">ORIGINAL</span>
                                                    {formatDimensions(originalRendition.dimensions) && (
                                                        <>
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-dimensions">
                                                                {formatDimensions(originalRendition.dimensions)}
                                                            </span>
                                                        </>
                                                    )}
                                                    <span className="rendition-separator">|</span>
                                                    <span className="rendition-format">
                                                        {formatFormatName(originalRendition.format || '')}
                                                    </span>
                                                    {originalRendition?.size && originalRendition?.size > 0 && (
                                                        <>
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-size">
                                                                {formatFileSize(originalRendition.size || 0)}
                                                            </span>
                                                        </>
                                                    )}
                                                </label>
                                            );
                                        })()}

                                        {/* Select All checkbox with collapse/expand button - only for non-original renditions */}
                                        <SelectAllRenditionsCheckbox
                                            key={`select-all-${assetData.asset.assetId || index}`}
                                            assetData={assetData}
                                            index={index}
                                            selectedRenditions={selectedRenditions}
                                            collapsedAssets={collapsedAssets}
                                            isRenditionSelected={isRenditionSelected}
                                            handleRenditionToggle={handleRenditionToggle}
                                            toggleAssetCollapse={toggleAssetCollapse}
                                        />

                                        {/* Individual non-original renditions - only show if not collapsed */}
                                        {!collapsedAssets.has(assetData.asset.assetId || `asset-${index}`) && (() => {
                                            const nonOriginalRenditions = [...(assetData.renditions.items || []), ...(assetData.imagePresets.items || [])]
                                                .filter(rendition => rendition.name?.toLowerCase() !== 'original')
                                                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                                            return nonOriginalRenditions.map((rendition) => (
                                                <label key={`${assetData.asset.assetId}-${rendition.name}`} className="rendition-item">
                                                    <input
                                                        type="checkbox"
                                                        className="tccc-checkbox"
                                                        checked={isRenditionSelected(rendition)}
                                                        onChange={() => handleRenditionToggle(rendition)}
                                                    />
                                                    <span className="rendition-name">{rendition.name}</span>
                                                    {formatDimensions(rendition.dimensions) && (
                                                        <>
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-dimensions">
                                                                {formatDimensions(rendition.dimensions)}
                                                            </span>
                                                        </>
                                                    )}
                                                    <span className="rendition-separator">|</span>
                                                    <span className="rendition-format">
                                                        {formatFormatName(rendition.format || '')}
                                                    </span>
                                                    {rendition?.size && rendition?.size > 0 && (
                                                        <>
                                                            <span className="rendition-separator">|</span>
                                                            <span className="rendition-size">
                                                                {formatFileSize(rendition.size || 0)}
                                                            </span>
                                                        </>
                                                    )}
                                                </label>
                                            ));
                                        })()}
                                    </div>
                                )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="download-renditions-terms">
                <label className="download-renditions-checkbox">
                    <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <span className="checkmark-checkbox"></span>
                    I agree to the <a href="#" className="terms-link">terms and conditions</a> of use.
                </label>
            </div>

            <div className="download-renditions-actions">
                <button
                    className="download-renditions-button cancel secondary-button"
                    onClick={onClose}
                    disabled={isDownloading}
                >
                    Cancel
                </button>
                <button
                    className={`download-renditions-button primary-button ${(!acceptTerms || isDownloading || selectedRenditions.size === 0) ? 'disabled' : ''}`}
                    onClick={handleDownloadRenditions}
                    disabled={!acceptTerms || isDownloading || selectedRenditions.size === 0}
                >
                    {isDownloading ? 'Downloading...' : 'Download'}
                </button>
            </div>
        </div>
    );
};

export type { AssetData };
export default DownloadRenditionsContent;
