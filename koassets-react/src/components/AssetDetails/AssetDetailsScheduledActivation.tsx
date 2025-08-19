import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsScheduledActivationProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsScheduledActivation: React.FC<AssetDetailsScheduledActivationProps> = ({ selectedImage, forceCollapse }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = (): void => setIsExpanded(!isExpanded);

    useEffect(() => {
        if (typeof forceCollapse === 'boolean') {
            setIsExpanded(!forceCollapse);
        }
    }, [forceCollapse]);

    const expanded = isExpanded;

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">Scheduled (de)activation</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">On Time</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.onTime as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Off Time</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.offTime as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsScheduledActivation;
