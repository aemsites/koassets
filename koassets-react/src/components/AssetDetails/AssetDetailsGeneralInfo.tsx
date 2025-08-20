import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsGeneralInfoProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsGeneralInfo: React.FC<AssetDetailsGeneralInfoProps> = ({ selectedImage, forceCollapse }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = () => setIsExpanded(!isExpanded);

    useEffect(() => {
        if (typeof forceCollapse === 'boolean') {
            setIsExpanded(!forceCollapse);
        }
    }, [forceCollapse]);

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">TCCC General Info</h3>
                <span className={`asset-details-arrow ${isExpanded ? 'expanded' : ''}`}></span>
            </div>

            {isExpanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Long Range Plan - Business Goal</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.longRangePlan as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Long Range Plan Tactic</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.longRangePlanTactic as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Campaign Reach</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.campaignReach as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Master or Adaptation</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.masterOrAdaptation as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Keywords</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.keywords as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Japanese Keywords</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.japaneseKeywords as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Age and Demographic</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.ageDemographic as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Source Asset</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.sourceAsset as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Derived Assets</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.derivedAssets as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Other Assets</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.otherAssets as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsGeneralInfo;
