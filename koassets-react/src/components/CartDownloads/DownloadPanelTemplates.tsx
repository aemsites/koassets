import React from 'react';
import type { DownloadTemplateItem } from '../../types';
import './DownloadPanelTemplates.css';
import EmptyCartDownloadContent from './EmptyCartDownloadContent';

interface DownloadPanelTemplatesProps {
    downloadTemplateItems: DownloadTemplateItem[];
}

const DownloadPanelTemplates: React.FC<DownloadPanelTemplatesProps> = ({
    downloadTemplateItems
}) => {
    return (
        <div className="download-panel-templates-wrapper">
            {downloadTemplateItems.length === 0 ? (
                <EmptyCartDownloadContent msg="No pending downloads" />
            ) : (
                <div className="download-templates-list">
                    <h3>Template Downloads ({downloadTemplateItems.length})</h3>
                    {/* Template-specific content would go here */}
                    <EmptyCartDownloadContent msg="Template downloads not yet implemented" />
                </div>
            )}
        </div>
    );
};

export default DownloadPanelTemplates;
