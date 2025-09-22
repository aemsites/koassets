import React from 'react';
import type { CartItem } from '../types';
import './DownloadPanelAssets.css';

interface DownloadPanelAssetsProps {
    downloadItems: CartItem[];
    onRemoveItem: (item: CartItem) => void;
}

const DownloadPanelAssets: React.FC<DownloadPanelAssetsProps> = ({
    downloadItems,
    onRemoveItem
}) => {
    return (
        <div className="download-panel-assets-content">
            {downloadItems.length === 0 ? (
                <div className="empty-download-assets">
                    <div className="empty-download-assets-message">
                        No pending downloads
                    </div>
                </div>
            ) : (
                <>
                </>
            )}
        </div>
    );
};

export default DownloadPanelAssets;
