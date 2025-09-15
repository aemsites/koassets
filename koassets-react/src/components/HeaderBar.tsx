import React, { useEffect } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { CartItem } from '../types';
// import type { HeaderBarProps } from '../types'; // COMMENTED OUT
import AdobeSignInButton from './AdobeSignInButton.jsx';
// import CartPanel from './CartPanel'; // REMOVED - moved to MainApp
import './HeaderBar.css';

// Extend window interface for cart badge function
declare global {
    interface Window {
        updateCartBadge?: (numItems: number) => void;
    }
}

// Simplified HeaderBar props interface
interface HeaderBarPropsSimplified {
    cartItems: CartItem[];
    handleAuthenticated: (token: string) => void;
    handleSignOut: () => void;
}

const HeaderBar: React.FC<HeaderBarPropsSimplified> = ({
    cartItems, // Keep for window.updateCartBadge
    // setCartItems, // Removed - cart moved to MainApp
    // isCartOpen, // Removed - cart moved to MainApp  
    // setIsCartOpen, // Removed - cart moved to MainApp
    // handleRemoveFromCart, // Removed - cart moved to MainApp
    // handleApproveAssets, // Removed - cart moved to MainApp
    // handleDownloadAssets, // Removed - cart moved to MainApp
    handleAuthenticated,
    handleSignOut
}) => {
    // Get external params from context
    const { externalParams } = useAppConfig();
    const isBlockIntegration = externalParams?.isBlockIntegration;

    useEffect(() => {
        if (window.updateCartBadge && typeof window.updateCartBadge === 'function') {
            window.updateCartBadge(cartItems.length);
        }
    }, [cartItems.length]);

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