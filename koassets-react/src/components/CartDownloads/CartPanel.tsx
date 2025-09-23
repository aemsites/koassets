import React from 'react';
import type { CartPanelProps } from '../../types';
import { WorkflowStep } from '../../types';
import BasePanel from './BasePanel';
import './BasePanel.css'; // Base panel styles 
import './CartPanel.css'; // Cart-specific styles
import CartPanelAssets from './CartPanelAssets';
import CartPanelTemplates from './CartPanelTemplates';

interface CartPanelContentProps {
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
    activeStep?: WorkflowStep;
    setActiveStep?: (step: WorkflowStep) => void;
    cartAssetItems: CartPanelProps['cartAssetItems'];
    setCartAssetItems: CartPanelProps['setCartAssetItems'];
    cartTemplateItems: CartPanelProps['cartTemplateItems'];
    setCartTemplateItems: CartPanelProps['setCartTemplateItems'];
    onRemoveItem: CartPanelProps['onRemoveItem'];
    onClose: CartPanelProps['onClose'];
}

const CartPanelContent: React.FC<CartPanelContentProps> = ({
    activeTab,
    setActiveStep,
    cartAssetItems,
    setCartAssetItems,
    cartTemplateItems,
    setCartTemplateItems, // Will be used for template management functionality
    onRemoveItem,
    onClose
}) => {
    // Explicitly mark setCartTemplateItems as intentionally unused for now
    void setCartTemplateItems;

    return (
        <>
            {activeTab === 'assets' && (
                <CartPanelAssets
                    cartItems={cartAssetItems}
                    setCartItems={setCartAssetItems}
                    onRemoveItem={onRemoveItem}
                    onClose={onClose}
                    onActiveStepChange={setActiveStep!}
                />
            )}

            {activeTab === 'templates' && (
                <CartPanelTemplates cartTemplateItems={cartTemplateItems} />
            )}
        </>
    );
};

const CartPanel: React.FC<CartPanelProps> = ({
    isOpen,
    onClose,
    cartAssetItems,
    setCartAssetItems,
    cartTemplateItems,
    setCartTemplateItems,
    onRemoveItem
}) => {
    const tabs = [
        { id: 'assets', label: 'Assets', count: cartAssetItems.length },
        { id: 'templates', label: 'Templates', count: cartTemplateItems.length }
    ];

    return (
        <BasePanel
            isOpen={isOpen}
            onClose={onClose}
            title="Cart"
            tabs={tabs}
            panelClassName="cart-panel"
        >
            <CartPanelContent
                cartAssetItems={cartAssetItems}
                setCartAssetItems={setCartAssetItems}
                cartTemplateItems={cartTemplateItems}
                setCartTemplateItems={setCartTemplateItems}
                onRemoveItem={onRemoveItem}
                onClose={onClose}
            />
        </BasePanel>
    );
};

export default CartPanel; 