import React from 'react';
import type { DownloadPanelProps } from '../../types';
import { WorkflowStep } from '../../types';
import BasePanel from './BasePanel';
import './BasePanel.css'; // Base panel styles
import './DownloadPanel.css'; // Download-specific styles
import DownloadPanelAssets from './DownloadPanelAssets';
import DownloadPanelTemplates from './DownloadPanelTemplates';

interface DownloadPanelContentProps {
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
    activeStep?: WorkflowStep;
    setActiveStep?: (step: WorkflowStep) => void;
    downloadAssetItems: DownloadPanelProps['downloadAssetItems'];
    downloadTemplateItems: DownloadPanelProps['downloadTemplateItems'];
    setDownloadTemplateItems: DownloadPanelProps['setDownloadTemplateItems'];
    onRemoveItem: DownloadPanelProps['onRemoveItem'];
}

const DownloadPanelContent: React.FC<DownloadPanelContentProps> = ({
    activeTab,
    downloadAssetItems,
    downloadTemplateItems,
    setDownloadTemplateItems, // Will be used for template management functionality
    onRemoveItem
}) => {
    // Explicitly mark setDownloadTemplateItems as intentionally unused for now
    void setDownloadTemplateItems;

    return (
        <>
            {activeTab === 'assets' && (
                <DownloadPanelAssets
                    downloadItems={downloadAssetItems}
                    onRemoveItem={onRemoveItem}
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
    onClose,
    downloadAssetItems,
    downloadTemplateItems,
    setDownloadTemplateItems,
    onRemoveItem
}) => {
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
                onRemoveItem={onRemoveItem}
            />
        </BasePanel>
    );
};

export default DownloadPanel;
