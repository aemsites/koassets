import React, { useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsSystemProps {
    selectedImage: Asset;
}

const AssetDetailsSystem: React.FC<AssetDetailsSystemProps> = ({ selectedImage }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">System Details</h3>
                <span className={`asset-details-arrow ${isExpanded ? 'expanded' : ''}`}>
                </span>
            </div>

            {isExpanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Date Created</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.createDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Date Published</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.publishDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Date Modified</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage.modifyDate}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Created By</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.createBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Published By</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.publishBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Publish Status</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.publishStatus}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Workfront ID</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.workfrontId}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Modified By</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.modifyBy}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Source ID</h4>
                            <span className="assets-details-metadata-value">
                                {selectedImage?.sourceId}
                            </span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Migration ID</h4>
                            <span className="assets-details-metadata-value">
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