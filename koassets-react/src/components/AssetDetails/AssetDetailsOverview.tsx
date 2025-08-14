import React, { useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsOverviewProps {
    selectedImage: Asset;
}

const AssetDetailsOverview: React.FC<AssetDetailsOverviewProps> = ({ selectedImage }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => setIsExpanded(!isExpanded);

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">Overview</h3>
                <span className={`asset-details-arrow ${isExpanded ? 'expanded' : ''}`}></span>
            </div>

            {isExpanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Title</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.title as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Japanese Title</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.japaneseTitle as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Tags</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.tags as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Japanese Description</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.japaneseDescription as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Asset Description</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.description as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">File Type</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.format as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Language</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.language as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Asset Status</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.assetStatus as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Asset Expiry Date</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.expirationDate as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Asset Category and Asset Type Execution</h4>
                            <span className="assets-details-metadata-value">{(selectedImage?.category as string) || (selectedImage?.categoryAndType as string)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsOverview;
