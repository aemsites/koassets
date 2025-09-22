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
    downloadItems: DownloadPanelProps['downloadItems'];
    onRemoveItem: DownloadPanelProps['onRemoveItem'];
}

const DownloadPanelContent: React.FC<DownloadPanelContentProps> = ({
    activeTab,
    downloadItems,
    onRemoveItem
}) => {
    return (
        <>
            {activeTab === 'assets' && (
                <DownloadPanelAssets
                    downloadItems={downloadItems}
                    onRemoveItem={onRemoveItem}
                />
            )}

            {activeTab === 'templates' && (
                <DownloadPanelTemplates downloadItems={downloadItems} />
            )}
        </>
    );
};

const DownloadPanel: React.FC<DownloadPanelProps> = ({
    isOpen,
    onClose,
    downloadItems,
    onRemoveItem
}) => {
    const tabs = [
        { id: 'assets', label: 'Assets', count: downloadItems.length },
        { id: 'templates', label: 'Templates', count: 0 }
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
                downloadItems={downloadItems}
                onRemoveItem={onRemoveItem}
            />
        </BasePanel>
    );
};

export default DownloadPanel;
