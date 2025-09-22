import React from 'react';
import type { CartItem } from '../../types';
import './CartPanelTemplates.css';

interface CartPanelTemplatesProps {
    cartItems: CartItem[];
}

const CartPanelTemplates: React.FC<CartPanelTemplatesProps> = ({
    cartItems
}) => {
    return (
        <div className="cart-templates-content">
            {cartItems.length === 0 ? (
                <div className="empty-cart-templates">
                    <div className="empty-cart-templates-message">
                        No templates in your cart
                    </div>
                </div>
            ) : (
                <div className="cart-templates-list">
                    <h3>Template Items ({cartItems.length})</h3>
                    {/* Template-specific content would go here */}
                    <div className="empty-cart-templates">
                        <div className="empty-cart-templates-message">
                            Template items not yet implemented
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CartPanelTemplates; 