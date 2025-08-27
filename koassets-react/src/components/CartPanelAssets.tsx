import React, { useEffect, useState } from 'react';
import type {
    Asset,
    AuthorizedCartItem,
    CartPanelAssetsProps,
    WorkflowStep,
    WorkflowStepIcons,
    WorkflowStepStatuses
} from '../types';
import { removeBlobFromCache } from '../utils/blobCache';
import './CartPanelAssets.css';
import ThumbnailImage from './ThumbnailImage';



const CartPanelAssets: React.FC<CartPanelAssetsProps> = ({
    cartItems,
    setCartItems,
    onRemoveItem,
    onClose,
    dynamicMediaClient
}) => {
    const [activeStep, setActiveStep] = useState<WorkflowStep>('cart');
    const [stepStatus, setStepStatus] = useState<WorkflowStepStatuses>({
        cart: 'init',           // 'init', 'pending', 'success', 'failure'
        'request-download': 'init',
        'rights-check': 'init',
        'download': 'init'
    });
    const [stepIcon, setStepIcon] = useState<WorkflowStepIcons>({
        cart: '',
        'request-download': '',
        'rights-check': '',
        'download': ''
    });

    // Monitor stepStatus changes and handle each status for all steps
    useEffect(() => {
        Object.entries(stepStatus).forEach(([step, status]) => {
            console.log(`Step "${step}" status changed to: ${status}`);

            switch (step as WorkflowStep) {
                case 'cart':
                    switch (status) {
                        case 'init':
                            console.log('Cart initialized - ready for items');
                            setStepIcon(prev => ({
                                ...prev,
                                cart: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-init.svg`} alt="Cart" />
                            }));
                            break;
                        case 'pending':
                            console.log('Cart processing...');
                            setStepIcon(prev => ({
                                ...prev,
                                cart: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-pending.svg`} alt="Cart Pending" />
                            }));
                            break;
                        case 'success':
                            console.log('Cart ready for download request');
                            setStepIcon(prev => ({
                                ...prev,
                                cart: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-success.svg`} alt="Cart Success" />
                            }));
                            break;
                        case 'failure':
                            console.log('Cart failed - items may be invalid or unavailable');
                            setStepIcon(prev => ({
                                ...prev,
                                cart: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-failure.svg`} alt="Cart Failure" />
                            }));
                            break;
                    }
                    break;

                case 'request-download':
                    switch (status) {
                        case 'init':
                            console.log('Download request not started');
                            setStepIcon(prev => ({
                                ...prev,
                                'request-download': <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-init.svg`} alt="Request Download" />
                            }));
                            break;
                        case 'pending':
                            console.log('Processing download request...');
                            setStepIcon(prev => ({
                                ...prev,
                                'request-download': <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-pending.svg`} alt="Request Download Pending" />
                            }));
                            break;
                        case 'success':
                            console.log('Download request approved - proceeding to rights check');
                            setStepIcon(prev => ({
                                ...prev,
                                'request-download': <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-success.svg`} alt="Request Download Success" />
                            }));
                            break;
                        case 'failure':
                            console.log('Download request failed - user can retry');
                            setStepIcon(prev => ({
                                ...prev,
                                'request-download': <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-failure.svg`} alt="Request Download Failure" />
                            }));
                            break;
                    }
                    break;

                case 'rights-check':
                    switch (status) {
                        case 'init':
                            console.log('Rights check not started');
                            setStepIcon(prev => ({
                                ...prev,
                                'rights-check': <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-init.svg`} alt="Rights Check" />
                            }));
                            break;
                        case 'pending':
                            console.log('Checking rights and permissions...');
                            setStepIcon(prev => ({
                                ...prev,
                                'rights-check': <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-pending.svg`} alt="Rights Check Pending" />
                            }));
                            break;
                        case 'success':
                            console.log('Rights check passed - proceeding to download');
                            setStepIcon(prev => ({
                                ...prev,
                                'rights-check': <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case 'failure':
                            console.log('Rights check failed - insufficient permissions');
                            setStepIcon(prev => ({
                                ...prev,
                                'rights-check': <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case 'download':
                    switch (status) {
                        case 'init':
                            console.log('Download not started');
                            setStepIcon(prev => ({
                                ...prev,
                                'download': <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-init.svg`} alt="Download" />
                            }));
                            break;
                        case 'pending':
                            console.log('Downloading assets...');
                            setStepIcon(prev => ({
                                ...prev,
                                'download': <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-pending.svg`} alt="Download Pending" />
                            }));
                            break;
                        case 'success':
                            console.log('Download completed successfully!');
                            // Could trigger success notification or auto-close
                            setStepIcon(prev => ({
                                ...prev,
                                'download': <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-success.svg`} alt="Download Success" />
                            }));
                            break;
                        case 'failure':
                            console.log('Download failed - connection or server error');
                            setStepIcon(prev => ({
                                ...prev,
                                'download': <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-failure.svg`} alt="Download Failure" />
                            }));
                            break;
                    }
                    break;
            }
        });
    }, [stepStatus]);

    const handleClearCart = (): void => {
        // Remove cached blobs for each cart item
        cartItems.forEach(item => {
            if (item.assetId) {
                removeBlobFromCache(item.assetId);
            }
        });

        setCartItems([]);
    };

    // const handleShareCart = (): void => {
    //     // TODO: Implement share cart functionality
    //     console.log('Share cart clicked');
    // };

    // const handleAddToCollection = (): void => {
    //     // TODO: Implement add to collection functionality
    //     console.log('Add to collection clicked');
    // };

    // const handleRequestDownload = (): void => {
    //     // setStepStatus(prev => ({ ...prev, cart: 'success' }));
    //     // setActiveStep('request-download');
    //     // setStepStatus(prev => ({ ...prev, 'request-download': 'pending' }));
    //     console.log('Request download clicked - moved to request-download step');
    // };

    const handleRightsCheck = async (): Promise<void> => {
        setStepStatus(prev => ({ ...prev, 'request-download': 'success' }));
        setActiveStep('rights-check');
        setStepStatus(prev => ({ ...prev, 'rights-check': 'pending' }));
        console.log('Rights check clicked - moved to rights-check step');
    };

    const handleFinalDownload = async (): Promise<void> => {
        // Show loading state
        setStepStatus(prev => ({ ...prev, 'rights-check': 'pending' }));

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate processing - you can add logic to determine success/failure
        const isSuccessful = Math.random() > 0.2; // 80% success rate for demo

        setStepStatus(prev => ({
            ...prev,
            'rights-check': isSuccessful ? 'success' : 'failure'
        }));

        if (isSuccessful) {
            setActiveStep('download');
            console.log('Final download initiated - rights check successful');
        } else {
            console.log('Final download failed - rights check failed');
            // Stay on current step but mark as failed
        }
    };

    const handleCompleteDownload = async (): Promise<void> => {
        // Show loading state
        setStepStatus(prev => ({ ...prev, 'download': 'pending' }));

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate processing - you can add logic to determine success/failure
        const isSuccessful = Math.random() > 0.1; // 90% success rate for demo

        setStepStatus(prev => ({
            ...prev,
            'download': isSuccessful ? 'success' : 'failure'
        }));

        console.log(isSuccessful ? 'Download completed successfully' : 'Download failed');
    };

    const handleRetryStep = (step: WorkflowStep): void => {
        // Reset step status to pending and retry
        setStepStatus(prev => ({ ...prev, [step]: 'pending' }));
        console.log(`Retrying step: ${step}`);
    };

    // Helper function to render step icon - simply returns the stepIcon for that step
    const renderStepIcon = (step: WorkflowStep, defaultIcon?: string): React.JSX.Element | string => {
        return stepIcon[step] || defaultIcon || '';
    };

    // Helper function to get step class names
    const getStepClassName = (step: WorkflowStep, isCurrentStep: boolean): string => {
        const status = stepStatus[step];
        const baseClass = 'workflow-step';

        if (isCurrentStep) {
            return `${baseClass} active`;
        } else if (status === 'success') {
            return `${baseClass} completed success`;
        } else if (status === 'failure') {
            return `${baseClass} completed failure`;
        } else {
            return baseClass;
        }
    };

    return (
        <>
            {/* Workflow Progress */}
            <div className="workflow-progress">
                <div className={getStepClassName('cart', activeStep === 'cart')}>
                    <div className="step-icon">
                        {renderStepIcon('cart')}
                    </div>
                    <span className="step-label">Cart</span>
                </div>
                <div className="horizontal-line"></div>
                <div className={getStepClassName('request-download', activeStep === 'request-download')}>
                    <div className="step-icon">
                        {renderStepIcon('request-download')}
                    </div>
                    <span className="step-label">Request Download</span>
                </div>
                <div className="horizontal-line"></div>
                <div className={getStepClassName('rights-check', activeStep === 'rights-check')}>
                    <div className="step-icon">
                        {renderStepIcon('rights-check')}
                    </div>
                    <span className="step-label">Rights Check</span>
                </div>
                <div className="horizontal-line"></div>
                <div className={getStepClassName('download', activeStep === 'download')}>
                    <div className="step-icon">
                        {renderStepIcon('download')}
                    </div>
                    <span className="step-label">Download</span>
                </div>
            </div>

            {/* Status Messages */}
            <div className="workflow-status">
                {stepStatus['cart'] === 'failure' && (
                    <div className="status-message error">
                        ❌ Cart preparation failed. Please try again.
                    </div>
                )}
                {stepStatus['request-download'] === 'failure' && (
                    <div className="status-message error">
                        ❌ Download request failed. Please retry.
                    </div>
                )}
                {stepStatus['rights-check'] === 'failure' && (
                    <div className="status-message error">
                        ❌ Rights check failed. Please retry.
                    </div>
                )}
                {stepStatus['download'] === 'failure' && (
                    <div className="status-message error">
                        ❌ Download failed. Please retry.
                    </div>
                )}
            </div>

            {/* Cart Content */}
            <div className="cart-content">
                {cartItems.length === 0 ? (
                    <div className="empty-cart">
                        <div className="empty-cart-message">
                            <span>Your cart is empty</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="cart-items-count">
                            <span className="red-text">{cartItems.length} Item{cartItems.length !== 1 ? 's' : ''}</span> in your cart
                        </div>

                        {/* Table Header */}
                        <div className="cart-table-header">
                            <div className="col-thumbnail">THUMBNAIL</div>
                            <div className="col-title">TITLE</div>
                            <div className="col-rights">RIGHTS RESTRICTIONS</div>
                            <div className="col-action">ACTION</div>
                        </div>

                        {/* Cart Items */}
                        <div className="cart-items-table">
                            {cartItems.map((item: Asset) => {
                                const authorizedItem = item as AuthorizedCartItem;
                                return (
                                    <div key={item.assetId} className={`cart-item-row ${authorizedItem.authorized === false ? 'disabled' : ''}`}>
                                        <div className="col-thumbnail">
                                            <ThumbnailImage
                                                item={item}
                                                dynamicMediaClient={dynamicMediaClient ?? null}
                                            />
                                        </div>
                                        <div className="col-title">
                                            <div className="item-title">{item.title || item.name}</div>
                                            <br />
                                            <div className="item-type">TYPE: {item.formatLabel?.toUpperCase()}</div>
                                        </div>
                                        <div className="col-rights">
                                            <span className="rights-badge">Fully-managed rights (FMR)</span>
                                        </div>
                                        <div className="col-action">
                                            <button
                                                className="delete-button"
                                                onClick={() => onRemoveItem(item)}
                                                aria-label="Remove item"
                                            >
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Action Buttons */}
            <div className="cart-actions-footer">
                <button className="action-btn secondary" onClick={onClose}>
                    Close
                </button>
                <button className="action-btn secondary" onClick={handleClearCart}>
                    Clear Cart
                </button>
                <button className="action-btn secondary disabled" onClick={(e) => e.preventDefault()}>
                    Share Cart
                </button>
                <button className="action-btn secondary disabled" onClick={(e) => e.preventDefault()}>
                    Add To Collection
                </button>

                {/* Dynamic primary button based on step */}
                {activeStep === 'cart' && (
                    <button className="action-btn primary disabled" onClick={(e) => e.preventDefault()}>
                        Request Download
                    </button>
                )}
                {activeStep === 'request-download' && (
                    <>
                        <button className="action-btn primary" onClick={handleRightsCheck}>
                            Check Rights
                        </button>
                        {stepStatus['request-download'] === 'failure' && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep('request-download')}>
                                Retry Request
                            </button>
                        )}
                    </>
                )}
                {activeStep === 'rights-check' && (
                    <>
                        <button className="action-btn primary" onClick={handleFinalDownload}>
                            Download Assets
                        </button>
                        {stepStatus['rights-check'] === 'failure' && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep('rights-check')}>
                                Retry Rights Check
                            </button>
                        )}
                    </>
                )}
                {activeStep === 'download' && (
                    <>
                        {stepStatus['download'] === 'pending' && (
                            <button className="action-btn primary" onClick={handleCompleteDownload}>
                                Complete Download
                            </button>
                        )}
                        {stepStatus['download'] === 'success' && (
                            <button className="action-btn primary" disabled>
                                Download Complete ✓
                            </button>
                        )}
                        {stepStatus['download'] === 'failure' && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep('download')}>
                                Retry Download
                            </button>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default CartPanelAssets; 