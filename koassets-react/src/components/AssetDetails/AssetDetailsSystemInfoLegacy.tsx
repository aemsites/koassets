import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsSystemInfoLegacyProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsSystemInfoLegacy: React.FC<AssetDetailsSystemInfoLegacyProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">System Info Legacy</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Legacy Asset ID 1.0</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.legacyAssetId1 as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Legacy Asset ID 2.0</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.legacyAssetId2 as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Legacy File Name</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.legacyFileName as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Source Upload Date</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.sourceUploadDate as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Source Uploader</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.sourceUploader as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Job ID</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.jobId as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Project ID</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.projectId as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Legacy Source System</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.legacySourceSystem as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="assets-details-metadata-label">Intended Business Unit or Market</h4>
                            <span className="assets-details-metadata-value">{selectedImage?.intendedBusinessUnitOrMarket as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsSystemInfoLegacy;
