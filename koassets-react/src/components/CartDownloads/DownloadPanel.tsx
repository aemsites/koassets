import React, { useCallback, useEffect, useState } from 'react';
import { ARCHIVE_STATUS, type ArchiveStatusType } from '../../clients/dynamicmedia-client';
import { useAppConfig } from '../../hooks/useAppConfig';
import type { DownloadAssetItem, DownloadPanelProps, DownloadTemplateItem } from '../../types';
import { WorkflowStep } from '../../types';
import BasePanel from './BasePanel';
import './BasePanel.css'; // Base panel styles
import './DownloadPanel.css'; // Download-specific styles
import DownloadPanelAssets from './DownloadPanelAssets';
import DownloadPanelTemplates from './DownloadPanelTemplates';

// Extend window interface for download badge function
declare global {
    interface Window {
        updateDownloadBadge?: (numItems: number) => void;
    }
}

interface DownloadPanelContentProps {
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
    activeStep?: WorkflowStep;
    setActiveStep?: (step: WorkflowStep) => void;
    downloadAssetItems: DownloadAssetItem[];
    downloadTemplateItems: DownloadTemplateItem[];
    setDownloadTemplateItems: React.Dispatch<React.SetStateAction<DownloadTemplateItem[]>>;
    onRemoveArchiveItem: (item: DownloadAssetItem) => void;
    archivePollingResults: Map<string, string[] | undefined>;
    onClose: () => void;
}

const DownloadPanelContent: React.FC<DownloadPanelContentProps> = ({
    activeTab,
    downloadAssetItems,
    downloadTemplateItems,
    setDownloadTemplateItems, // Will be used for template management functionality
    onRemoveArchiveItem,
    archivePollingResults,
    onClose
}) => {
    // Explicitly mark setDownloadTemplateItems as intentionally unused for now
    void setDownloadTemplateItems;

    return (
        <>
            {activeTab === 'assets' && (
                <DownloadPanelAssets
                    downloadAssetItems={downloadAssetItems}
                    onRemoveArchiveItem={onRemoveArchiveItem}
                    archivePollingResults={archivePollingResults}
                    onClose={onClose}
                />
            )}

            {activeTab === 'templates' && (
                <DownloadPanelTemplates downloadTemplateItems={downloadTemplateItems} />
            )}
        </>
    );
};

const DownloadPanel: React.FC<DownloadPanelProps> = ({
    isOpen,
    onClose
}) => {
    // Download panel state - moved from MainApp
    const [downloadAssetItems, setDownloadAssetItems] = useState<DownloadAssetItem[]>([]);
    const [downloadTemplateItems, setDownloadTemplateItems] = useState<DownloadTemplateItem[]>([]);

    // State to track polling results for each archive - moved from DownloadPanelAssets
    const [archivePollingResults, setArchivePollingResults] = useState<Map<string, string[] | undefined>>(new Map());

    const loadDownloadAssetItems = useCallback(() => {
        try {
            const stored = localStorage.getItem('downloadArchives');
            if (stored) {
                const parsedData = JSON.parse(stored);
                setDownloadAssetItems(parsedData);
            }
        } catch (error) {
            console.warn('Failed to load download archives from localStorage:', error);
            setDownloadAssetItems([]);
        }
    }, []);

    // Always load from localStorage when component launches or panel opens
    useEffect(() => {
        loadDownloadAssetItems();
    }, [loadDownloadAssetItems]);

    useEffect(() => {
        if (isOpen) {
            loadDownloadAssetItems();
        }
    }, [isOpen, loadDownloadAssetItems]);

    useEffect(() => {
        localStorage.setItem('downloadArchives', JSON.stringify(downloadAssetItems));
        if (window.updateDownloadBadge && typeof window.updateDownloadBadge === 'function') {
            window.updateDownloadBadge(downloadAssetItems.length);
        }
    }, [downloadAssetItems]);

    const handleRemoveArchiveItem = useCallback((archiveItem: DownloadAssetItem): void => {
        const newDownloadAssetItems = downloadAssetItems.filter(entry =>
            entry.archiveId !== archiveItem.archiveId
        );
        setDownloadAssetItems(newDownloadAssetItems);
        console.debug('Removed archive:', archiveItem.archiveId);
    }, [downloadAssetItems]);

    // Archive polling functions - moved from DownloadPanelAssets
    const { dynamicMediaClient } = useAppConfig();

    // Get polling result for a specific archive
    const getArchivePollingResult = useCallback((archiveId: string): string[] | undefined => {
        return archivePollingResults.get(archiveId);
    }, [archivePollingResults]);

    // Poll archive status and return download links when ready
    const pollingArchiveDownloadLinks = useCallback(async (archiveId: string): Promise<string[] | undefined> => {
        // Check if we already have a result for this archive
        const existingResult = getArchivePollingResult(archiveId);
        if (existingResult !== undefined) {
            return existingResult;
        }

        // Poll for status until no longer processing
        let archiveStatus: { data?: { status?: ArchiveStatusType; files?: string[] } } | undefined;
        const maxRetries = 60; // Maximum 5 minutes (60 * 5s intervals)
        let retryCount = 0;
        let result: string[] | undefined;

        do {
            archiveStatus = await dynamicMediaClient?.getAssetsArchiveStatus(archiveId);
            const status = archiveStatus?.data?.status;

            if (status === ARCHIVE_STATUS.FAILED) {
                result = undefined;
                break;
            } else if (status === ARCHIVE_STATUS.COMPLETED) {
                result = archiveStatus?.data?.files;
                break;
            }

            // Wait 5 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 5000));
            retryCount++;

        } while (retryCount < maxRetries && archiveStatus?.data?.status === ARCHIVE_STATUS.PROCESSING);

        // If we didn't get a result and timed out
        if (result === undefined && retryCount >= maxRetries) {
            result = undefined; // Timeout occurred
        }

        return result;
    }, [dynamicMediaClient, getArchivePollingResult]);

    // Auto-poll archive status for all download items when they change
    useEffect(() => {
        if (isOpen && downloadAssetItems.length > 0) {
            downloadAssetItems.forEach((item) => {
                // Start polling in parallel without waiting
                pollingArchiveDownloadLinks(item.archiveId)
                    .then((result) => {
                        // Store the result in our map
                        setArchivePollingResults(prev => {
                            const newMap = new Map(prev);
                            newMap.set(item.archiveId, result);
                            return newMap;
                        });

                        console.debug('Completed polling for archive:', item.archiveId, 'Result:', result ? `${result.length} files` : 'no files');
                    })
                    .catch((error) => {
                        console.error('Failed to poll archive:', item.archiveId, error);
                    });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [downloadAssetItems, isOpen]);

    const tabs = [
        { id: 'assets', label: 'Assets', count: downloadAssetItems.length },
        { id: 'templates', label: 'Templates', count: downloadTemplateItems.length }
    ];

    return (
        <BasePanel
            isOpen={isOpen}
            onClose={onClose}
            title="Downloads"
            tabs={tabs}
            panelClassName="download-panel"
        >
            <DownloadPanelContent
                downloadAssetItems={downloadAssetItems}
                downloadTemplateItems={downloadTemplateItems}
                setDownloadTemplateItems={setDownloadTemplateItems}
                onRemoveArchiveItem={handleRemoveArchiveItem}
                archivePollingResults={archivePollingResults}
                onClose={onClose}
            />
        </BasePanel>
    );
};

export default DownloadPanel;
