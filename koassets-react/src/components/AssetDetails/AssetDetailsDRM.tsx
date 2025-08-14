import React, { useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsDRMProps {
    selectedImage: Asset;
}

const AssetDetailsDRM: React.FC<AssetDetailsDRMProps> = ({ selectedImage }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">DRM</h3>
                <span className={`asset-details-arrow ${isExpanded ? 'expanded' : ''}`}></span>
            </div>

            {isExpanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Risk Type Management</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.riskTypeManagement as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Rights Notes</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.rightsNotes as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Rights Status</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.rightsStatus as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Rights Free</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.rightsFree as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Business Affairs Manager</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.businessAffairsManager as string}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Fadel ID</h4>
                            <span className="assets-details-metadata-value">
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