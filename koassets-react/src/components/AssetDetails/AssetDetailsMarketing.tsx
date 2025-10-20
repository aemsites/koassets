import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';
import { getAssetFieldDisplayFacetName } from '../../utils/displayUtils';

interface AssetDetailsMarketingProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsMarketing: React.FC<AssetDetailsMarketingProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">Marketing Overview</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Campaign Name</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.campaignName ? getAssetFieldDisplayFacetName('campaignName', selectedImage.campaignName as string) : ''}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Experience ID</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.experienceId as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Campaign Activation Remark</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.campaignActivationRemark as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Campaign Sub-Activation Remark</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.campaignSubActivationRemark as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Brand</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.brand as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Sub-brand</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.subBrand as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Beverage Type</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.beverageType as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label tccc-metadata-label">Agency Name</h4>
                            <span className="asset-details-main-metadata-value tccc-metadata-value">{selectedImage?.agencyName ? getAssetFieldDisplayFacetName('agencyName', selectedImage.agencyName as string) : ''}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsMarketing;
