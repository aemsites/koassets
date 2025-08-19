import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsTechnicalInfoProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsTechnicalInfo: React.FC<AssetDetailsTechnicalInfoProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">Technical Info</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">File Size</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.formatedSize as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">ID</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.assetId as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Resolution</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.resolution as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Image Height</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.imageHeight as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Image Width</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.imageWidth as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Duration</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.duration as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Broadcast Format</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.broadcastFormat as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Titling</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.titling as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Ratio</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.ratio as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Orientation</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.orientation as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsTechnicalInfo;
