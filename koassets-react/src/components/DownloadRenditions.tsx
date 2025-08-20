import React, { useEffect, useState } from 'react';
import type { DynamicMediaClient } from '../dynamicmedia-client';
import { Asset } from '../types';
import './DownloadRenditions.css';
import ThumbnailImage from './ThumbnailImage';

interface Rendition {
    name: string;
    format: string;
    size: number;
    dimensions?: { width: number; height: number };
}

interface DownloadRenditionsProps {
    isOpen: boolean;
    asset: Asset | null;
    onClose: () => void;
    dynamicMediaClient: DynamicMediaClient | null;
}

const DownloadRenditions: React.FC<DownloadRenditionsProps> = ({
    isOpen,
    asset,
    onClose,
    dynamicMediaClient
}) => {
    const [selectedRenditions, setSelectedRenditions] = useState<Set<Rendition>>(new Set());
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [assetRenditions, setAssetRenditions] = useState<{
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    }>({});
    const [renditionsLoading, setRenditionsLoading] = useState(false);
    const [renditionsError, setRenditionsError] = useState<string | null>(null);

    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Helper function to format dimensions
    const formatDimensions = (dimensions?: { width: number; height: number }): string => {
        if (!dimensions || dimensions.width === 0 || dimensions.height === 0) return '';
        return `W: ${dimensions.width}  H: ${dimensions.height}`;
    };

    // Helper function to format format name
    const formatFormatName = (format: string): string => {
        return format.toUpperCase().replace('IMAGE/', '').replace('VND.ADOBE.', '');
    };

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedRenditions(new Set());
            setAcceptTerms(false);
            setIsDownloading(false);
            setAssetRenditions({});
            setRenditionsLoading(false);
            setRenditionsError(null);
        }
    }, [isOpen]);

    // Fetch asset renditions when modal opens
    useEffect(() => {
        const fetchRenditions = async () => {
            if (!isOpen || !asset || !dynamicMediaClient) {
                return;
            }

            setRenditionsLoading(true);
            setRenditionsError(null);

            try {
                console.log('Fetching renditions for asset:', asset.assetId);
                const renditions = await dynamicMediaClient.getAssetRenditions(asset);
                console.log('Fetched renditions:', JSON.stringify(renditions));
                setAssetRenditions(renditions || {});
            } catch (error) {
                console.error('Failed to fetch asset renditions:', error);
                setRenditionsError('Failed to load asset renditions');
                setAssetRenditions({});
            } finally {
                setRenditionsLoading(false);
            }
        };

        fetchRenditions();
    }, [isOpen, asset, dynamicMediaClient]);

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
        const renditionItems = assetRenditions.items || [];

        if (selectedRenditions.size === renditionItems.length) {
            // If all are selected, deselect all
            setSelectedRenditions(new Set());
        } else {
            // If not all are selected, select all
            setSelectedRenditions(new Set(renditionItems));
        }
    };

    const isAllSelected = () => {
        const renditionItems = assetRenditions.items || [];
        return renditionItems.length > 0 && selectedRenditions.size === renditionItems.length;
    };

    const isRenditionSelected = (rendition: Rendition) => {
        return Array.from(selectedRenditions).some(r => r.name === rendition.name);
    };

    const getSortedRenditions = () => {
        const renditionItems = assetRenditions.items || [];
        return renditionItems.sort((a, b) => {
            // Put 'original' first
            if (a.name === 'original') return -1;
            if (b.name === 'original') return 1;
            // Sort others alphabetically
            return a.name.localeCompare(b.name);
        });
    };

    const handleDownloadRendition = async () => {
        if (!asset || !dynamicMediaClient || (!acceptTerms) || isDownloading || selectedRenditions.size === 0) {
            console.warn('Cannot download: missing requirements, already downloading, or no renditions selected');
            return;
        }

        setIsDownloading(true);

        try {
            // Download all selected renditions in parallel
            const downloadPromises = Array.from(selectedRenditions).map(async (rendition: Rendition) => {
                console.log('Downloading rendition:', rendition.name);

                const resolution = rendition.dimensions && rendition.dimensions.width > 0 && rendition.dimensions.height > 0
                    ? `${rendition.dimensions.width}x${rendition.dimensions.height}`
                    : '';
                await dynamicMediaClient.downloadAsset(asset, rendition.name, rendition.format, resolution);
                console.log(`Downloaded ${rendition.name} successfully`);
                return rendition.name;
            });

            await Promise.all(downloadPromises);

            // Close modal on successful download
            onClose();
        } catch (error) {
            console.error('Failed to download asset:', error);
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
                                {!renditionsLoading && !renditionsError && assetRenditions.items && assetRenditions.items.length > 0 && (
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
                                                    {formatFormatName(rendition.format)}
                                                </span>
                                                <span className="rendition-separator">|</span>
                                                <span className="rendition-size">
                                                    {formatFileSize(rendition.size)}
                                                </span>
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
                            onClick={handleDownloadRendition}
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
