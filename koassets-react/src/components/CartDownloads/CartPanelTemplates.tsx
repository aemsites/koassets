import React from 'react';
import type { CartTemplateItem } from '../../types';
import './CartPanelTemplates.css';
import EmptyCartDownloadContent from './EmptyCartDownloadContent';

interface CartPanelTemplatesProps {
    cartTemplateItems: CartTemplateItem[];
}

const CartPanelTemplates: React.FC<CartPanelTemplatesProps> = ({
    cartTemplateItems
}) => {
    return (
        <div className="cart-panel-templates-wrapper">
            {cartTemplateItems.length === 0 ? (
                <EmptyCartDownloadContent msg="No templates in your cart" />
            ) : (
                <div className="cart-templates-list">
                    <h3>Template Items ({cartTemplateItems.length})</h3>
                    {/* Template-specific content would go here */}
                    <EmptyCartDownloadContent msg="Template items not yet implemented" />
                </div>
            )}
        </div>
    );
};

export default CartPanelTemplates; 