import React from 'react';
import './CartPanelTemplates.css';

const CartPanelTemplates: React.FC = () => {
    return (
        <div className="cart-templates-content">
            <div className="empty-cart-templates">
                <div className="empty-cart-templates-message">
                    No templates in your cart
                </div>
            </div>
        </div>
    );
};

export default CartPanelTemplates; 