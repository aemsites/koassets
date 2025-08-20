import React, { useEffect, useState } from 'react';
import type { Asset } from '../../types';

interface AssetDetailsIntendedUseProps {
    selectedImage: Asset;
    forceCollapse?: boolean;
}

const AssetDetailsIntendedUse: React.FC<AssetDetailsIntendedUseProps> = ({ selectedImage, forceCollapse }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const toggleExpanded = (): void => setIsExpanded(!isExpanded);

    useEffect(() => {
        if (typeof forceCollapse === 'boolean') {
            setIsExpanded(!forceCollapse);
        }
    }, [forceCollapse]);

    return (
        <div className="asset-details-card">
            <div className="asset-details-header" onClick={toggleExpanded}>
                <h3 className="asset-details-title">Intended Use</h3>
                <span className={`asset-details-arrow ${isExpanded ? 'expanded' : ''}`}></span>
            </div>

            {isExpanded && (
                <div className="asset-details-content">
                    <div className="asset-details-grid">
                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Intended Bottler Country</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.intendedBottlerCountry as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Intended Customers</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.intendedCustomers as string}</span>
                        </div>

                        <div className="asset-details-group">
                            <h4 className="asset-details-main-metadata-label">Intended Channel</h4>
                            <span className="asset-details-main-metadata-value">{selectedImage?.intendedChannel as string}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetDetailsIntendedUse;
