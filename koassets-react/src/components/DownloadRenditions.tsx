import { ToastQueue } from '@react-spectrum/toast';
import React, { useEffect, useState } from 'react';
import type { DynamicMediaClient } from '../dynamicmedia-client';
import { Asset } from '../types';
import { formatDimensions, formatFileSize, formatFormatName } from '../utils/formatters';
import './DownloadRenditions.css';
import ThumbnailImage from './ThumbnailImage';

export interface Rendition {
    name?: string;
    format?: string;
    size?: number;
    dimensions?: { width: number; height: number };
}

interface DownloadRenditionsProps {
    isOpen: boolean;
    asset: Asset | null;
    onClose: () => void;
    dynamicMediaClient: DynamicMediaClient | null;
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
}

const DownloadRenditions: React.FC<DownloadRenditionsProps> = ({
    isOpen,
    asset,
    onClose,
    dynamicMediaClient,
    renditions,
    imagePresets
}) => {
    const [selectedRenditions, setSelectedRenditions] = useState<Set<Rendition>>(new Set());
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [renditionsLoading, setRenditionsLoading] = useState(false);
    const [renditionsError, setRenditionsError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedRenditions(new Set());
            setAcceptTerms(false);
            setIsDownloading(false);
            setRenditionsLoading(false);
            setRenditionsError(null);
        }
    }, [isOpen]);



    // Handle escape key with capture to intercept before parent modals
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                onClose();
            }
        };

        // Use capture: true to ensure this handler runs before others
        document.addEventListener('keydown', handleEscape, { capture: true });
        return () => document.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, onClose]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleRenditionToggle = (rendition: Rendition) => {
        setSelectedRenditions(prev => {
            const newSet = new Set(prev);
            const existingRendition = Array.from(newSet).find(r => r.name === rendition.name);

            if (existingRendition) {
                newSet.delete(existingRendition);
            } else {
                newSet.add(rendition);
            }
            return newSet;
        });
    };

    const handleSelectAllToggle = () => {
        const allRenditionItems = [...(renditions.items || []), ...(imagePresets?.items || [])];

        if (selectedRenditions.size === allRenditionItems.length) {
            // If all are selected, deselect all
            setSelectedRenditions(new Set());
        } else {
            // If not all are selected, select all
            setSelectedRenditions(new Set(allRenditionItems));
        }
    };

    const isAllSelected = () => {
        const allRenditionItems = [...(renditions.items || []), ...(imagePresets?.items || [])];
        return allRenditionItems.length > 0 && selectedRenditions.size === allRenditionItems.length;
    };

    const isRenditionSelected = (rendition: Rendition) => {
        return Array.from(selectedRenditions).some(r => r.name === rendition.name);
    };

    const getSortedRenditions = () => {
        return [...(renditions.items || []).sort((a, b) => {
            // Put 'original' first
            if (a.name === 'original') return -1;
            if (b.name === 'original') return 1;
            // Sort others alphabetically
            return (a.name || '').localeCompare(b.name || '');
        }), ...(imagePresets?.items || [])];
    };

    const handleDownloadRenditions = async () => {
        if (!asset || !dynamicMediaClient || (!acceptTerms) || isDownloading || selectedRenditions.size === 0) {
            console.warn('Cannot download: missing requirements, already downloading, or no renditions selected');
            return;
        }

        if (!asset.rightsFree) {
            ToastQueue.negative(`This asset is not rights free.`, { timeout: 1000 });
            return;
        }


        const count = selectedRenditions.size;
        setIsDownloading(true);
        let closeProcessingToast;

        try {
            if (count === 1) {
                const rendition = selectedRenditions.values().next().value;
                const isImagePreset = rendition && imagePresets?.items?.some(preset => preset.name === rendition.name);
                await dynamicMediaClient.downloadAsset(asset, rendition, isImagePreset);
                onClose();
            } else {
                // Create renditionsToDownload with preset prefix for image presets
                const renditionsToDownload = new Set(
                    Array.from(selectedRenditions).map(rendition => {
                        const isImagePreset = rendition && imagePresets?.items?.some(preset => preset.name === rendition.name);
                        if (isImagePreset) {
                            return {
                                ...rendition,
                                name: `preset_${rendition.name}`
                            };
                        }
                        return rendition;
                    })
                );

                // Multiple assets archive download - show toast notifications
                closeProcessingToast = ToastQueue.info(`Processing download request for ${count} renditions. Refreshing the page will cancel the download.`);

                const success = await dynamicMediaClient.downloadAssetsArchive(
                    [{ asset, renditions: Array.from(renditionsToDownload).map(rendition => ({ name: rendition.name })) }]);

                if (success) {
                    closeProcessingToast?.();
                    ToastQueue.positive(`Successfully started downloading ${count} renditions.`, { timeout: 1000 });
                    onClose();
                } else {
                    closeProcessingToast?.();
                    ToastQueue.negative(`Failed to create archive for ${count} renditions.`, { timeout: 1000 });
                }
            }
        } catch (error) {
            console.error('Failed to download asset:', error);
            closeProcessingToast?.();
            ToastQueue.negative(`Unexpected error occurred while downloading ${count} renditions.`, { timeout: 1000 });
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen || !asset) return null;

    return (
        <div className="download-renditions-overlay" onClick={handleOverlayClick}>
            <div className="download-renditions-modal">
                <div className="download-renditions-header">
                    <div className="download-renditions-header-title">Download</div>
                    <button className="download-renditions-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="download-renditions-content">
                    <div className="download-renditions-table">
                        <div className="download-renditions-table-header">
                            <span>THUMBNAIL</span>
                            <span>TITLE</span>
                            <span>DOWNLOAD OPTIONS</span>
                        </div>

                        <div className="download-renditions-row">
                            <div className="download-renditions-thumbnail">
                                <ThumbnailImage
                                    item={asset}
                                    dynamicMediaClient={dynamicMediaClient}
                                />
                            </div>
                            <div className="download-renditions-title">
                                {asset.name}
                            </div>
                            <div className="download-renditions-options">
                                {/* Renditions status feedback */}
                                {renditionsLoading && (
                                    <div className="renditions-status loading">
                                        Loading available renditions...
                                    </div>
                                )}
                                {renditionsError && (
                                    <div className="renditions-status error">
                                        {renditionsError}
                                    </div>
                                )}

                                {/* Individual rendition checkboxes */}
                                {!renditionsLoading && !renditionsError && (renditions.items && renditions.items.length > 0 || imagePresets.items && imagePresets.items.length > 0) && (
                                    <div className="renditions-list">
                                        {/* Select All checkbox */}
                                        <label className="select-all-item">
                                            <input
                                                type="checkbox"
                                                className="tccc-checkbox"
                                                checked={isAllSelected()}
                                                onChange={handleSelectAllToggle}
                                            />
                                            <span className="select-all-label">Select All</span>
                                        </label>

                                        {/* Individual renditions */}
                                        {getSortedRenditions().map((rendition) => (
                                            <label key={rendition.name} className="rendition-item">
                                                <input
                                                    type="checkbox"
                                                    className="tccc-checkbox"
                                                    checked={isRenditionSelected(rendition)}
                                                    onChange={() => handleRenditionToggle(rendition)}
                                                />
                                                <span className="rendition-name">
                                                    {rendition.name === 'original' ? 'Original' : rendition.name}
                                                </span>
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
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
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
            </div>
        </div>
    );
};

export default DownloadRenditions;
