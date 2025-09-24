import React, { useCallback, useMemo, useState } from 'react';
import type {
    DownloadAssetItem,
    WorkflowStepStatuses
} from '../../types';

import { StepStatus, WorkflowStep } from '../../types';
import EmptyCartDownloadContent from './EmptyCartDownloadContent';

import { ARCHIVE_STATUS, type ArchiveStatusType } from '../../clients/dynamicmedia-client';
import { useAppConfig } from '../../hooks/useAppConfig';
import './DownloadPanelAssets.css';
import { WorkflowProgress } from './WorkflowProgress';


interface DownloadPanelAssetsProps {
    downloadAssetItems: DownloadAssetItem[];
    onRemoveArchiveItem: (item: DownloadAssetItem) => void;
    archivePollingResults: Map<string, string[] | undefined>;
    onClose: () => void;
}

const DownloadPanelAssets: React.FC<DownloadPanelAssetsProps> = ({
    downloadAssetItems,
    onRemoveArchiveItem,
    archivePollingResults,
    onClose
}) => {
    const { dynamicMediaClient } = useAppConfig();

    const stepStatus: WorkflowStepStatuses = {
        [WorkflowStep.CART]: StepStatus.SUCCESS,
        [WorkflowStep.DOWNLOAD]: StepStatus.CURRENT,
        [WorkflowStep.CLOSE_DOWNLOAD]: StepStatus.INIT
    };

    // Status filter state
    const [statusFilters, setStatusFilters] = useState({
        [ARCHIVE_STATUS.PROCESSING]: true,
        [ARCHIVE_STATUS.COMPLETED]: true,
        [ARCHIVE_STATUS.FAILED]: true
    });

    // Expanded items state
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Handle status filter change
    const handleStatusFilterChange = (status: ArchiveStatusType, checked: boolean) => {
        setStatusFilters(prev => ({
            ...prev,
            [status]: checked
        }));
    };

    // Helper function to determine item status based on polling results
    const getItemStatus = useCallback((item: DownloadAssetItem): ArchiveStatusType => {
        const hasPollingStarted = archivePollingResults.has(item.archiveId);
        const pollingResult = archivePollingResults.get(item.archiveId);

        if (!hasPollingStarted) {
            return ARCHIVE_STATUS.PROCESSING; // "In Progress"
        } else if (pollingResult !== undefined) {
            return ARCHIVE_STATUS.COMPLETED; // "Ready to Download"
        } else {
            return ARCHIVE_STATUS.FAILED; // "Failed"
        }
    }, [archivePollingResults]);

    // Filter download items based on status filters
    const filteredDownloadAssetItems = useMemo(() => {
        return downloadAssetItems.filter(item => {
            const status = getItemStatus(item);
            return statusFilters[status];
        });
    }, [downloadAssetItems, statusFilters, getItemStatus]);

    // Handle download action
    const handleDownload = async (archiveId: string) => {
        console.log('Downloading archive:', archiveId);

        // Get polling results for this archiveId
        const pollingResult = archivePollingResults.get(archiveId);

        if (!pollingResult || !dynamicMediaClient) {
            console.warn('No polling results found for archiveId:', archiveId);
            return;
        }

        try {
            // Download all files in parallel
            console.log(`Starting parallel download of ${pollingResult.length} files for archive:`, archiveId);

            const downloadPromises = pollingResult.map(url =>
                dynamicMediaClient.downloadFromUrl(url, 'Assets.zip')
            );

            const results = await Promise.allSettled(downloadPromises);

            // Log results
            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            console.log(`Download completed for archive ${archiveId}: ${successful} successful, ${failed} failed`);

            if (failed > 0) {
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Failed to download file ${index + 1}:`, result.reason);
                    }
                });
            }

            // If all downloads were successful, remove the item from downloadAssetItems
            // if (failed === 0 && successful > 0) {
            //     const itemToRemove = downloadAssetItems.find(item => item.archiveId === archiveId);
            //     if (itemToRemove) {
            //         console.log(`All files downloaded successfully for archive ${archiveId}. Removing from download list.`);
            //         onRemoveArchiveItem(itemToRemove);
            //     }
            // }
        } catch (error) {
            console.error('Failed to download archive:', archiveId, error);
        }
    };

    // Handle remove archive
    const handleRemoveArchive = (archiveEntry: DownloadAssetItem) => {
        onRemoveArchiveItem(archiveEntry);
    };

    // Toggle expanded state for an item
    const toggleExpanded = (archiveId: string) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(archiveId)) {
                newSet.delete(archiveId);
            } else {
                newSet.add(archiveId);
            }
            return newSet;
        });
    };

    // Process renditions according to the specified rules
    const processRenditions = (item: DownloadAssetItem): string[] => {
        if (!item.assetsRenditions || !item.assetsRenditions.length) {
            return [];
        }

        const processedRenditions: string[] = [];

        item.assetsRenditions.forEach(assetRendition => {
            if (!assetRendition.assetName || !assetRendition.renditions) {
                return;
            }

            // Get name without extension from assetName
            const nameWithoutExtension = assetRendition.assetName.replace(/\.[^/.]+$/, '');

            assetRendition.renditions.forEach(rendition => {
                if (rendition.startsWith('preset_')) {
                    // Remove 'preset_' and prepend nameWithoutExtension
                    const processedName = nameWithoutExtension + '_' + rendition.replace('preset_', '');
                    processedRenditions.push(processedName);
                } else if (rendition === 'original') {
                    // Remove 'original' and prepend full assetName
                    processedRenditions.push(assetRendition.assetName);
                } else {
                    // Keep other renditions as is, with nameWithoutExtension prepended
                    processedRenditions.push(nameWithoutExtension + '_' + rendition);
                }
            });
        });

        return processedRenditions;
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
    const DownloadAssetItemRow: React.FC<{ item: DownloadAssetItem }> = ({ item }) => {
        const fileCount = item.assetsRenditions.reduce((acc, assetRendition) => acc + assetRendition.renditions.length, 0);
        const isExpanded = expandedItems.has(item.archiveId);
        const processedRenditions = processRenditions(item);
        const itemStatus = getItemStatus(item);

        // Determine status states
        const isLoading = itemStatus === ARCHIVE_STATUS.PROCESSING;
        const isReady = itemStatus === ARCHIVE_STATUS.COMPLETED;
        const isFailed = itemStatus === ARCHIVE_STATUS.FAILED;

        const handleToggleExpand = () => {
            toggleExpanded(item.archiveId);
        };

        return (
            <div className="download-item-container">
                <div className="download-item-row">
                    <div className="col-zip-files" onClick={handleToggleExpand}>
                        <div className="zip-file-info">
                            <span className={`expand-icon ${isExpanded ? 'expanded' : 'collapsed'}`}>
                                {isExpanded ? '▲' : '▼'}
                            </span>
                            <span className="zip-filename">Assets.zip</span>
                        </div>
                    </div>
                    <div className="col-file-count" onClick={handleToggleExpand}>{fileCount}</div>
                    <div className="col-status">
                        {isLoading && (
                            <div className="status-badge processing-status">
                                <span>PROCESSING</span>
                                <span className="fa-spinner"></span>
                            </div>
                        )}
                        {isFailed && (
                            <span className="status-badge status-failed">
                                Failed
                            </span>
                        )}
                        {isReady && (
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
                {isExpanded && (
                    <div className="download-renditions-expanded">
                        <div className="rendition-list">
                            <div className="rendition-item">
                                FILES ADDED TO ZIP:
                            </div>
                            {processedRenditions.map((rendition, index) => (
                                <div key={index} className="rendition-item">
                                    {rendition}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (downloadAssetItems.length === 0) {
        return <EmptyCartDownloadContent msg="No pending downloads" />;
    }

    if (filteredDownloadAssetItems.length === 0) {
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
                            checked={statusFilters[ARCHIVE_STATUS.PROCESSING]}
                            onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.PROCESSING, e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        In Progress
                    </label>
                    <label className="status-filter">
                        <input
                            type="checkbox"
                            checked={statusFilters[ARCHIVE_STATUS.COMPLETED]}
                            onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.COMPLETED, e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Ready to Download
                    </label>
                    <label className="status-filter">
                        <input
                            type="checkbox"
                            checked={statusFilters[ARCHIVE_STATUS.FAILED]}
                            onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.FAILED, e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Failed
                    </label>
                </div>

                <EmptyCartDownloadContent msg="No items match the selected filters" />

                {/* Close Button */}
                <div className="download-panel-footer">
                    <button className="close-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        );
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
                        checked={statusFilters[ARCHIVE_STATUS.PROCESSING]}
                        onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.PROCESSING, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    In Progress
                </label>
                <label className="status-filter">
                    <input
                        type="checkbox"
                        checked={statusFilters[ARCHIVE_STATUS.COMPLETED]}
                        onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.COMPLETED, e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Ready to Download
                </label>
                <label className="status-filter">
                    <input
                        type="checkbox"
                        checked={statusFilters[ARCHIVE_STATUS.FAILED]}
                        onChange={(e) => handleStatusFilterChange(ARCHIVE_STATUS.FAILED, e.target.checked)}
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
                    {filteredDownloadAssetItems.map((item, index) => (
                        <DownloadAssetItemRow key={`${item.archiveId}-${index}`} item={item} />
                    ))}
                </div>
            </div>

            {/* Close Button */}
            <div className="download-panel-footer">
                <button className="close-btn secondary-button" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

export default DownloadPanelAssets;
