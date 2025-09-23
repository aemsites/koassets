import React, { useMemo, useState } from 'react';
import type {
    Asset,
    DownloadArchiveEntry,
    WorkflowStepStatuses
} from '../../types';

import { StepStatus, WorkflowStep } from '../../types';
import EmptyCartDownloadContent from './EmptyCartDownloadContent';

import './DownloadPanelAssets.css';
import { WorkflowProgress } from './WorkflowProgress';

// Status types for download archives
enum DownloadStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    READY_TO_DOWNLOAD = 'READY_TO_DOWNLOAD',
    FAILED = 'FAILED'
}

interface DownloadPanelAssetsProps {
    downloadItems: DownloadArchiveEntry[];
    onRemoveItem: (item: Asset) => void;
}

const DownloadPanelAssets: React.FC<DownloadPanelAssetsProps> = ({
    downloadItems,
    onRemoveItem
}) => {
    const stepStatus: WorkflowStepStatuses = {
        [WorkflowStep.CART]: StepStatus.SUCCESS,
        [WorkflowStep.DOWNLOAD]: StepStatus.CURRENT,
        [WorkflowStep.CLOSE_DOWNLOAD]: StepStatus.INIT
    };

    // Status filter state
    const [statusFilters, setStatusFilters] = useState({
        [DownloadStatus.IN_PROGRESS]: true,
        [DownloadStatus.READY_TO_DOWNLOAD]: true,
        [DownloadStatus.FAILED]: true
    });

    // Helper function to determine archive status
    const getArchiveStatus = (archiveId: string): DownloadStatus => {
        if (archiveId.startsWith('pending-')) {
            return DownloadStatus.IN_PROGRESS;
        }
        // Add logic here to check if archive is ready or failed
        // For now, assume non-pending archives are ready
        return DownloadStatus.READY_TO_DOWNLOAD;
    };

    // Filter download items based on status
    const filteredDownloadItems = useMemo(() => {
        return downloadItems.filter(item => {
            const status = getArchiveStatus(item.archiveId);
            return statusFilters[status];
        });
    }, [downloadItems, statusFilters]);

    // Handle status filter change
    const handleStatusFilterChange = (status: DownloadStatus, checked: boolean) => {
        setStatusFilters(prev => ({
            ...prev,
            [status]: checked
        }));
    };

    // Handle download action
    const handleDownload = (archiveId: string) => {
        console.log('Downloading archive:', archiveId);
        // TODO: Implement actual download logic
    };

    // Handle remove archive
    const handleRemoveArchive = (archiveEntry: DownloadArchiveEntry) => {
        // Remove all assets from this archive
        archiveEntry.assetsRenditions.forEach(assetRendition => {
            // Find the asset to remove - we only have assetId, so we need to create a mock Asset
            const mockAsset: Asset = { assetId: assetRendition.assetId } as Asset;
            onRemoveItem(mockAsset);
        });
    };

    // Table header
    const tableHeader = useMemo(() => (
        <div className="download-table-header">
            <div className="col-zip-files">ZIP FILES</div>
            <div className="col-file-count">NO OF FILES</div>
            <div className="col-status">STATUS</div>
            <div className="col-action">ACTION</div>
        </div>
    ), []);

    // Download item row component
    const DownloadItemRow: React.FC<{ item: DownloadArchiveEntry }> = ({ item }) => {
        const status = getArchiveStatus(item.archiveId);
        const fileCount = item.assetsRenditions.length;

        return (
            <div className="download-item-row">
                <div className="col-zip-files">
                    <div className="zip-file-info">
                        <span className="expand-icon">▼</span>
                        <span className="zip-filename">Assets.zip</span>
                    </div>
                </div>
                <div className="col-file-count">{fileCount}</div>
                {/* <div className="col-status">
                    <span className={`status-badge status-${status.toLowerCase().replace('_', '-')}`}>
                        {status === DownloadStatus.IN_PROGRESS ? 'In Progress' :
                            status === DownloadStatus.READY_TO_DOWNLOAD ? 'Ready to Download' : 'Failed'}
                    </span>
                </div> */}
                <div className="col-status">
                    {status === DownloadStatus.READY_TO_DOWNLOAD && (
                        <button
                            className="download-btn primary-button"
                            onClick={() => handleDownload(item.archiveId)}
                        >
                            Download
                        </button>
                    )}
                </div>
                <div className="col-action">
                    <button
                        className="delete-button"
                        onClick={() => handleRemoveArchive(item)}
                        aria-label="Remove item"
                    >
                    </button>
                </div>
            </div>
        );
    };

    if (downloadItems.length === 0) {
        return <EmptyCartDownloadContent msg="No pending downloads" />;
    }

    return (
        <div className="download-panel-assets-wrapper">
            <WorkflowProgress
                activeStep={WorkflowStep.DOWNLOAD}
                hasAllItemsReadyToUse={true}
                stepStatus={stepStatus}
            />

            {/* Status Filters */}
            <div className="download-status-filters">
                <label className="status-filter">
                    <input
                        type="checkbox"
                        checked={statusFilters[DownloadStatus.IN_PROGRESS]}
                        onChange={(e) => handleStatusFilterChange(DownloadStatus.IN_PROGRESS, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    In Progress
                </label>
                <label className="status-filter">
                    <input
                        type="checkbox"
                        checked={statusFilters[DownloadStatus.READY_TO_DOWNLOAD]}
                        onChange={(e) => handleStatusFilterChange(DownloadStatus.READY_TO_DOWNLOAD, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Ready to Download
                </label>
                <label className="status-filter">
                    <input
                        type="checkbox"
                        checked={statusFilters[DownloadStatus.FAILED]}
                        onChange={(e) => handleStatusFilterChange(DownloadStatus.FAILED, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Failed
                </label>
            </div>

            {/* Download Table */}
            <div className="download-table-container">
                {/* Table Header */}
                {tableHeader}

                {/* Download Items */}
                <div className="download-items-table">
                    {filteredDownloadItems.map((item, index) => (
                        <DownloadItemRow key={`${item.archiveId}-${index}`} item={item} />
                    ))}
                </div>
            </div>

            {/* Close Button */}
            <div className="download-panel-footer">
                <button className="close-btn">Close</button>
            </div>
        </div>
    );
};

export default DownloadPanelAssets;
