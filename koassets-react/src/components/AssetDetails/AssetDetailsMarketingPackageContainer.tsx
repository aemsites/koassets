import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsMarketingPackageContainerProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsMarketingPackageContainer: React.FC<AssetDetailsMarketingPackageContainerProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">Marketing Package and Container Info</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Package or Container Type</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.packageOrContainerType as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Package or Container Material</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.packageOrContainerMaterial as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Package or Container Size</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.packageOrContainerSize as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Secondary Packaging</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.secondaryPackaging as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsMarketingPackageContainer;
