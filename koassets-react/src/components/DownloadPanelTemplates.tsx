import React from 'react';
import type { CartItem } from '../types';
import './DownloadPanelTemplates.css';

interface DownloadPanelTemplatesProps {
    downloadItems: CartItem[];
}

const DownloadPanelTemplates: React.FC<DownloadPanelTemplatesProps> = ({
    downloadItems
}) => {
    return (
        <div className="download-panel-templates-content">
            {downloadItems.length === 0 ? (
                <div className="empty-download-templates">
                    <div className="empty-download-templates-message">
                        No pending downloads
                    </div>
                </div>
            ) : (
                <div className="download-templates-list">
                    <h3>Template Downloads ({downloadItems.length})</h3>
                    {/* Template-specific content would go here */}
                    <div className="empty-download-templates">
                        <div className="empty-download-templates-message">
                            Template downloads not yet implemented
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DownloadPanelTemplates;
