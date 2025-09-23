import React from 'react';
import { WorkflowStep, type Asset, type DownloadArchiveEntry } from '../../types';
import './DownloadPanelAssets.css';
import { WorkflowProgress } from './WorkflowProgress';

interface DownloadPanelAssetsProps {
    downloadItems: DownloadArchiveEntry[];
    onRemoveItem: (item: Asset) => void;
}

const DownloadPanelAssets: React.FC<DownloadPanelAssetsProps> = ({
    downloadItems,
    onRemoveItem
}) => {
    void onRemoveItem; // keep in props for future use

    return (
        <div className="download-panel-assets-content">
            {downloadItems.length === 0 ? (
                <div className="empty-download-assets">
                    <div className="empty-download-assets-message">
                        No pending downloads
                    </div>
                </div>
            ) : (
                <div className="download-panel-assets-wrapper">
                    <WorkflowProgress
                        activeStep={WorkflowStep.DOWNLOAD}
                        hasAllItemsReadyToUse={true}
                    />
                </div>
            )}
        </div>
    );
};

export default DownloadPanelAssets;
