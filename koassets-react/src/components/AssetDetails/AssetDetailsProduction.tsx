import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsProductionProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsProduction: React.FC<AssetDetailsProductionProps> = ({ selectedImage, forceCollapse }) => {
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
                <h3 className="asset-details-title">Production</h3>
                <span className={`asset-details-arrow ${expanded ? 'expanded' : ''}`}></span>
            </div>

            {expanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Lead Operating Unit</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.leadOperatingUnit as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">TCCC Lead Associate (Legacy)</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.tcccLeadAssociateLegacy as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">TCCC Contact</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.tcccContact as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Fadel Job ID</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.fadelJobId as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsProduction;
