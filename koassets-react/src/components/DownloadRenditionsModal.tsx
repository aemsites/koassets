import { ToastQueue } from '@react-spectrum/toast';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { DynamicMediaClient } from '../clients/dynamicmedia-client';
import { Asset, Rendition } from '../types';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import './DownloadRenditionsModal.css';

interface DownloadRenditionsModalProps {
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

const DownloadRenditionsModal: React.FC<DownloadRenditionsModalProps> = ({
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
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (!isOpen) return;

        // Use capture: true to ensure this handler runs before others
        document.addEventListener('keydown', handleEscape, { capture: true });
        return () => document.removeEventListener('keydown', handleEscape, { capture: true });
    }, [isOpen, handleEscape]);

    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    const handleRenditionToggle = useCallback((rendition: Rendition) => {
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
    }, []);

    const isRenditionSelected = useCallback((rendition: Rendition) => {
        return Array.from(selectedRenditions).some(r => r.name === rendition.name);
    }, [selectedRenditions]);


    const handleDownloadRenditions = useCallback(async () => {
        if (!asset || !dynamicMediaClient || (!acceptTerms) || isDownloading || selectedRenditions.size === 0) {
            console.warn('Cannot download: missing requirements, already downloading, or no renditions selected');
            return;
        }

        if (!asset.readyToUse) {
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
    }, [asset, dynamicMediaClient, acceptTerms, isDownloading, selectedRenditions, imagePresets, onClose]);

    // Memoize the assets array to prevent unnecessary re-renders of child component
    const assets = useMemo(() => [{
        asset: asset!, // Non-null assertion since we check for asset existence before this point
        renditions,
        imagePresets,
        renditionsLoading,
        renditionsError
    }], [asset, renditions, imagePresets, renditionsLoading, renditionsError]);

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

                <DownloadRenditionsContent
                    assets={assets}
                    dynamicMediaClient={dynamicMediaClient}
                    selectedRenditions={selectedRenditions}
                    acceptTerms={acceptTerms}
                    isDownloading={isDownloading}
                    onClose={onClose}
                    handleDownloadRenditions={handleDownloadRenditions}
                    isRenditionSelected={isRenditionSelected}
                    handleRenditionToggle={handleRenditionToggle}
                    setAcceptTerms={setAcceptTerms}
                />
            </div>
        </div>
    );
};

export default DownloadRenditionsModal;
