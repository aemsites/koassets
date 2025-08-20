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
                            <h4 className="asset-details-main-metadata-label">Legacy Asset ID 1.0</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.legacyAssetId1 as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Legacy Asset ID 2.0</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.legacyAssetId2 as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Legacy File Name</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.legacyFileName as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Source Upload Date</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.sourceUploadDate as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Source Uploader</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.sourceUploader as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Job ID</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.jobId as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Project ID</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.projectId as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Legacy Source System</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.legacySourceSystem as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Intended Business Unit or Market</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.intendedBusinessUnitOrMarket as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsSystemInfoLegacy;
