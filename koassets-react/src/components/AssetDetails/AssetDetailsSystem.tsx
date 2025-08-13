import React, { useState } from 'react';
import type { Asset } from '../../types';
import { formatDate } from '../../utils/formatters';
import './AssetDetailsSystem.css';

interface AssetDetailsSystemProps {
    selectedImage: Asset;
}

const AssetDetailsSystem: React.FC<AssetDetailsSystemProps> = ({ selectedImage }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className="asset-details-system">
            <div className="asset-details-system-header" onClick={toggleExpanded}>
                <h3 className="asset-details-system-title">System Details</h3>
                <span className={`asset-details-system-arrow ${isExpanded ? 'expanded' : ''}`}>
                </span>
            </div>

            {isExpanded && (
                <div className="asset-details-system-content">
                    <div className="asset-details-system-grid">
                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Date Created</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.createDate}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Date Published</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.publishDate}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Date Modified</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage.modifyDate}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Created By</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.createBy || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Published By</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.publishBy || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Publish Status</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.publishStatus || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Workfront ID</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.workfrontId || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Modified By</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.modifyBy || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Source ID</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.sourceId || 'Unknown'}
                            </span>
                        </div>

                        <div className="asset-details-system-group">
                            <h4 className="assets-details-metadata-label asset-details-system-label">Migration ID</h4>
                            <span className="assets-details-metadata-value asset-details-system-value">
                                {selectedImage?.migrationId || 'Unknown'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsSystem; 