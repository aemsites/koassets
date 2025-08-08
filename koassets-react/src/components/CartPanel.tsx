import React, { useEffect, useRef, useState } from 'react';
import type { CartPanelProps } from '../types';
import './CartPanel.css';
import CartPanelAssets from './CartPanelAssets.jsx';
import CartPanelTemplates from './CartPanelTemplates';

const CartPanel: React.FC<CartPanelProps> = ({
    isOpen,
    onClose,
    cartItems,
    setCartItems,
    onRemoveItem,
    onApproveAssets,
    onDownloadAssets,
    dynamicMediaClient
}) => {
    const [activeTab, setActiveTab] = useState<'assets' | 'templates'>('assets');
    const panelRef = useRef<HTMLDivElement>(null);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="cart-panel-overlay">
            <div className="cart-panel" ref={panelRef}>
                {/* Header with close button */}
                <div className="cart-panel-header">
                    <h2>Cart</h2>
                    <button className="close-button" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                {/* Tabs */}
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

                {activeTab === 'assets' && (
                    <CartPanelAssets
                        cartItems={cartItems}
                        setCartItems={setCartItems}
                        onRemoveItem={onRemoveItem}
                        onApproveAssets={onApproveAssets}
                        onDownloadAssets={onDownloadAssets}
                        onClose={onClose}
                        dynamicMediaClient={dynamicMediaClient}
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