import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsSystemProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsSystem: React.FC<AssetDetailsSystemProps> = ({ selectedImage, forceCollapse }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    // Sync local expanded state with global collapse toggle, but allow local overrides via clicks
    useEffect(() => {
        if (typeof forceCollapse === 'boolean') {
            setIsExpanded(!forceCollapse);
        }
    }, [forceCollapse]);

    const expanded = isExpanded;

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">System Details</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}>
                </span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Date Created</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.createDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Date Published</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.publishDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Date Modified</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage.modifyDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Created By</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.createBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Published By</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.publishBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Publish Status</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.publishStatus}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Workfront ID</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.workfrontId}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Modified By</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.modifyBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Source ID</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.sourceId}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Migration ID</h4>
                            <span className="asset-details-main-metadata-value">
                                {selectedImage?.migrationId}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsSystem; 