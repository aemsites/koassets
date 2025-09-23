import React, { useEffect } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { CartAssetItem, DownloadArchiveItem } from '../types';
import AdobeSignInButton from './AdobeSignInButton.jsx';
import './HeaderBar.css';

// Extend window interface for cart and download badge functions
declare global {
    interface Window {
        updateCartBadge?: (numItems: number) => void;
        updateDownloadBadge?: (numItems: number) => void;
    }
}

// Simplified HeaderBar props interface
interface HeaderBarPropsSimplified {
    cartAssetItems: CartAssetItem[];
    downloadAssetItems: DownloadArchiveItem[];
    handleAuthenticated: (token: string) => void;
    handleSignOut: () => void;
}

const HeaderBar: React.FC<HeaderBarPropsSimplified> = ({
    cartAssetItems, // Keep for window.updateCartBadge
    downloadAssetItems, // Keep for window.updateDownloadBadge
    handleAuthenticated,
    handleSignOut
}) => {
    // Get external params from context
    const { externalParams } = useAppConfig();
    const isBlockIntegration = externalParams?.isBlockIntegration;

    useEffect(() => {
        if (window.updateCartBadge && typeof window.updateCartBadge === 'function') {
            window.updateCartBadge(cartAssetItems.length);
        }
    }, [cartAssetItems.length]);

    useEffect(() => {
        if (window.updateDownloadBadge && typeof window.updateDownloadBadge === 'function') {
            window.updateDownloadBadge(downloadAssetItems.length);
        }
    }, [downloadAssetItems.length]);

    const handleLogoClick = () => {
        window.location.assign('/');
    };

    return (
        <div className="app-header">
            {!isBlockIntegration && (
                <img
                    className="app-logo"
                    src={`${import.meta.env.BASE_URL}ko-assets-logo.png`}
                    alt="KO Assets Logo"
                    onClick={handleLogoClick}
                />
            )}

            {/* Header right controls: Sign In only (cart moved to MainApp) */}
            <div className="header-controls">
                <div className="auth-container">
                    <AdobeSignInButton
                        onAuthenticated={handleAuthenticated}
                        onSignOut={handleSignOut}
                    />
                </div>
            </div>
        </div>
    );
};

export default HeaderBar; 