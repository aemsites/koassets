import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsDRMProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsDRM: React.FC<AssetDetailsDRMProps> = ({ selectedImage, forceCollapse }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    useEffect(() => {
        if (typeof forceCollapse === 'boolean') {
            setIsExpanded(!forceCollapse);
        }
    }, [forceCollapse]);

    const expanded = isExpanded;

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">DRM</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Risk Type Management</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.riskTypeManagement as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Rights Notes</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.rightsNotes as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Rights Status</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.rightsStatus as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Rights Free</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.readyToUse as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Business Affairs Manager</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.businessAffairsManager as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Fadel ID</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.fadelId as string}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsDRM; 