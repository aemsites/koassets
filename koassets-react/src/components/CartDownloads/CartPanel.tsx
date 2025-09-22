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
    cartItems: CartPanelProps['cartItems'];
    setCartItems: CartPanelProps['setCartItems'];
    onRemoveItem: CartPanelProps['onRemoveItem'];
    onClose: CartPanelProps['onClose'];
}

const CartPanelContent: React.FC<CartPanelContentProps> = ({
    activeTab,
    setActiveStep,
    cartItems,
    setCartItems,
    onRemoveItem,
    onClose
}) => {
    return (
        <>
            {activeTab === 'assets' && (
                <CartPanelAssets
                    cartItems={cartItems}
                    setCartItems={setCartItems}
                    onRemoveItem={onRemoveItem}
                    onClose={onClose}
                    onActiveStepChange={setActiveStep!}
                />
            )}

            {activeTab === 'templates' && (
                <CartPanelTemplates cartItems={cartItems} />
            )}
        </>
    );
};

const CartPanel: React.FC<CartPanelProps> = ({
    isOpen,
    onClose,
    cartItems,
    setCartItems,
    onRemoveItem
}) => {
    const tabs = [
        { id: 'assets', label: 'Assets', count: cartItems.length },
        { id: 'templates', label: 'Templates', count: 0 }
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
                cartItems={cartItems}
                setCartItems={setCartItems}
                onRemoveItem={onRemoveItem}
                onClose={onClose}
            />
        </BasePanel>
    );
};

export default CartPanel; 