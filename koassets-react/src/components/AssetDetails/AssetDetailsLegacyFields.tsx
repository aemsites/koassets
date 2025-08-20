import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsLegacyFieldsProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsLegacyFields: React.FC<AssetDetailsLegacyFieldsProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">Legacy Fields</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Original Create Date</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.originalCreateDate as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Date Uploaded</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.dateUploaded as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Under Embargo</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.underEmbargo as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Is this asset associated with a brand?</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.assetAssociatedWithBrand as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Is there a package depicted in this asset?</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.packageDepicted as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Funding BU or Market</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.fundingBuOrMarket as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Track Name</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.trackName as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Brands which have the asset as guideline</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.brandsWAssetGuideline as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Brands which have the asset as hero image</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.brandsWAssetHero as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Campaign where assets are key assets</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.campaignsWKeyAssets as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Featured Asset</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.featuredAsset as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Key Asset</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.keyAsset as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Layout</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.layout as string}</span>
                        </div>
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Jobs which have the asset as the contract asset</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.contractAssetJobs as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsLegacyFields;
