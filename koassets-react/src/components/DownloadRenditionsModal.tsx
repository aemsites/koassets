import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Asset, Rendition } from '../types';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import './DownloadRenditionsModal.css';

interface DownloadRenditionsModalProps {
    isOpen: boolean;
    asset: Asset | null;
    onClose: () => void;
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
    renditions,
    imagePresets
}) => {
    const [renditionsLoading, setRenditionsLoading] = useState(false);
    const [renditionsError, setRenditionsError] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
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
                    onClose={onClose}
                />
            </div>
        </div>
    );
};

export default DownloadRenditionsModal;
