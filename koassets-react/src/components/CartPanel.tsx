import React, { useEffect, useState } from 'react';
import type { CartPanelProps } from '../types';
import { WorkflowStep } from '../types';
import './CartPanel.css';
import CartPanelAssets from './CartPanelAssets';
import CartPanelTemplates from './CartPanelTemplates';

const CartPanel: React.FC<CartPanelProps> = ({
    isOpen,
    onClose,
    cartItems,
    setCartItems,
    onRemoveItem,
    onApproveAssets,
    onDownloadAssets
}) => {
    // These props are kept for interface compatibility but not used in this component
    void onApproveAssets;
    void onDownloadAssets;

    const [activeTab, setActiveTab] = useState<'assets' | 'templates'>('assets');
    const [activeStep, setActiveStep] = useState<WorkflowStep>(WorkflowStep.CART);

    // Click outside to close is disabled - users must use the X button or other explicit actions to close

    // Prevent body scroll when cart panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('cart-panel-open');
            document.documentElement.classList.add('cart-panel-open');
        } else {
            document.body.classList.remove('cart-panel-open');
            document.documentElement.classList.remove('cart-panel-open');
        }

        return () => {
            document.body.classList.remove('cart-panel-open');
            document.documentElement.classList.remove('cart-panel-open');
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="cart-panel-overlay portal-modal">
            <div className="cart-panel">
                {/* Header with close button */}
                <div className="cart-panel-header">
                    <h2>Cart</h2>
                    <button className="close-button" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {/* Tabs - only show when in CART step */}
                {activeStep === WorkflowStep.CART && (
                    <div className="cart-tabs">
                        <button
                            className={`cart-tab ${activeTab === 'assets' ? 'active' : ''}`}
                            onClick={() => setActiveTab('assets')}
                        >
                            Assets ({cartItems.length})
                        </button>
                        <button
                            className={`cart-tab ${activeTab === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Templates ({0})
                        </button>
                    </div>
                )}

                {activeTab === 'assets' && (
                    <CartPanelAssets
                        cartItems={cartItems}
                        setCartItems={setCartItems}
                        onRemoveItem={onRemoveItem}
                        onClose={onClose}
                        onActiveStepChange={setActiveStep}
                    />
                )}

                {activeTab === 'templates' && (
                    <CartPanelTemplates />
                )}
            </div>
        </div>
    );
};

export default CartPanel; 