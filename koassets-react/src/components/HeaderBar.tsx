import React, { useEffect } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { HeaderBarProps } from '../types';
import AdobeSignInButton from './AdobeSignInButton.jsx';
import CartPanel from './CartPanel';
import './HeaderBar.css';

// Extend window interface for cart badge function
declare global {
    interface Window {
        updateCartBadge?: (numItems: number) => void;
    }
}

const HeaderBar: React.FC<HeaderBarProps> = ({
    cartItems,
    setCartItems,
    isCartOpen,
    setIsCartOpen,
    handleRemoveFromCart,
    handleApproveAssets,
    handleDownloadAssets,
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

            {/* Header right controls: Cart and Sign In */}
            <div className="header-controls">
                <div className="cart-container">
                    <CartPanel
                        isOpen={isCartOpen}
                        onClose={() => setIsCartOpen(false)}
                        cartItems={cartItems}
                        setCartItems={setCartItems}
                        onRemoveItem={handleRemoveFromCart}
                        onApproveAssets={handleApproveAssets}
                        onDownloadAssets={handleDownloadAssets}
                    />
                </div>

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