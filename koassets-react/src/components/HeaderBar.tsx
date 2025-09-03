import React from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { HeaderBarProps } from '../types';
import AdobeSignInButton from './AdobeSignInButton.jsx';
import CartIcon from './CartIcon';
import CartPanel from './CartPanel';
import './HeaderBar.css';

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
                {/* Bucket and Access Token inputs */}
                {/* <div className="input-container">
                    <label htmlFor="bucket-input" className="input-label">
                        Bucket:
                    </label>
                    <input
                        id="bucket-input"
                        type="text"
                        value={bucket}
                        onChange={(e) => setBucket(e.target.value)}
                        placeholder="Enter bucket name"
                        className="header-input"
                    />
                </div>

                <div className="input-container">
                    <label htmlFor="token-input" className="input-label">
                        Token:
                    </label>
                    <input
                        id="token-input"
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="Enter access token"
                        className="header-input"
                    />
                </div> */}

                <div className="cart-container">
                    <CartIcon
                        itemCount={cartItems.length}
                        onClick={() => setIsCartOpen(!isCartOpen)}
                    />
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