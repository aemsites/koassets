import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { restrictedBrandsWarning, smrWarnings } from '../constants/warnings';
import { useAppConfig } from '../hooks/useAppConfig';
import type {
    Asset,
    AuthorizedCartItem,
    CartPanelAssetsProps,
    WorkflowStepIcons,
    WorkflowStepStatuses
} from '../types';
import { StepStatus, WorkflowStep } from '../types';
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
    // Get app config from context - no prop drilling needed!
    const { externalParams } = useAppConfig();
    const { restrictedBrands } = externalParams;

    const [activeStep, setActiveStep] = useState<WorkflowStep>(WorkflowStep.CART);
    const [stepStatus, setStepStatus] = useState<WorkflowStepStatuses>({
        [WorkflowStep.CART]: StepStatus.INIT,
        [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.INIT,
        [WorkflowStep.RIGHTS_CHECK]: StepStatus.INIT,
        [WorkflowStep.DOWNLOAD]: StepStatus.INIT
    });
    const [stepIcon, setStepIcon] = useState<WorkflowStepIcons>({
        [WorkflowStep.CART]: '',
        [WorkflowStep.REQUEST_DOWNLOAD]: '',
        [WorkflowStep.RIGHTS_CHECK]: '',
        [WorkflowStep.DOWNLOAD]: ''
    });

    // Monitor stepStatus changes and handle each status for all steps
    useEffect(() => {
        Object.entries(stepStatus).forEach(([step, status]) => {
            console.log(`Step "${step}" status changed to: ${status}`);

            switch (step as WorkflowStep) {
                case WorkflowStep.CART:
                    switch (status) {
                        case StepStatus.INIT:
                            console.log('Cart initialized - ready for items');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-init.svg`} alt="Cart" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            console.log('Cart processing...');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-current.svg`} alt="Cart Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            console.log('Cart ready for download request');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Cart Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            console.log('Cart failed - items may be invalid or unavailable');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-failure.svg`} alt="Cart Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.REQUEST_DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            console.log('Download request not started');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-init.svg`} alt="Request Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            console.log('Processing download request...');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-current.svg`} alt="Request Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            console.log('Download request approved - proceeding to rights check');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Request Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            console.log('Download request failed - user can retry');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-failure.svg`} alt="Request Download Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.RIGHTS_CHECK:
                    switch (status) {
                        case StepStatus.INIT:
                            console.log('Rights check not started');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-init.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            console.log('Checking rights and permissions...');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-current.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            console.log('Rights check passed - proceeding to download');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            console.log('Rights check failed - insufficient permissions');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            console.log('Download not started');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-init.svg`} alt="Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            console.log('Downloading assets...');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-current.svg`} alt="Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            console.log('Download completed successfully!');
                            // Could trigger success notification or auto-close
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            console.log('Download failed - connection or server error');
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-failure.svg`} alt="Download Failure" />
                            }));
                            break;
                    }
                    break;
            }
        });
    }, [stepStatus]);

    const handleClearCart = useCallback((): void => {
        // Remove cached blobs for each cart item
        cartItems.forEach(item => {
            if (item.assetId) {
                removeBlobFromCache(item.assetId);
            }
        });

        setCartItems([]);
    }, [cartItems, setCartItems]);

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

    const handleRightsCheck = useCallback(async (): Promise<void> => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.SUCCESS }));
        setActiveStep(WorkflowStep.RIGHTS_CHECK);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));
        console.log('Rights check clicked - moved to rights-check step');
    }, []);

    const handleFinalDownload = useCallback(async (): Promise<void> => {
        // Show loading state
        setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate processing - you can add logic to determine success/failure
        const isSuccessful = Math.random() > 0.2; // 80% success rate for demo

        setStepStatus(prev => ({
            ...prev,
            [WorkflowStep.RIGHTS_CHECK]: isSuccessful ? StepStatus.SUCCESS : StepStatus.FAILURE
        }));

        if (isSuccessful) {
            setActiveStep(WorkflowStep.DOWNLOAD);
            console.log('Final download initiated - rights check successful');
        } else {
            console.log('Final download failed - rights check failed');
            // Stay on current step but mark as failed
        }
    }, []);

    const handleCompleteDownload = useCallback(async (): Promise<void> => {
        // Show loading state
        setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.CURRENT }));

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate processing - you can add logic to determine success/failure
        const isSuccessful = Math.random() > 0.1; // 90% success rate for demo

        setStepStatus(prev => ({
            ...prev,
            [WorkflowStep.DOWNLOAD]: isSuccessful ? StepStatus.SUCCESS : StepStatus.FAILURE
        }));

        console.log(isSuccessful ? 'Download completed successfully' : 'Download failed');
    }, []);

    const handleDirectDownload = useCallback(async (): Promise<void> => {
        // Skip intermediate steps and go directly to download
        setStepStatus(prev => ({ ...prev, [WorkflowStep.CART]: StepStatus.SUCCESS }));
        setActiveStep(WorkflowStep.DOWNLOAD);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.CURRENT }));
        console.log('Direct download initiated - skipping intermediate steps');
    }, []);

    const handleRetryStep = useCallback((step: WorkflowStep): void => {
        setStepStatus(prev => ({ ...prev, [step]: StepStatus.CURRENT }));
        console.log(`Retrying step: ${step}`);
    }, []);

    // Helper function to render step icon - simply returns the stepIcon for that step
    const renderStepIcon = useCallback((step: WorkflowStep, defaultIcon?: string): React.JSX.Element | string => {
        return stepIcon[step] || defaultIcon || '';
    }, [stepIcon]);

    // Helper function to get step class names
    const getStepClassName = useCallback((step: WorkflowStep, isCurrentStep: boolean): string => {
        const status = stepStatus[step];
        const baseClass = 'workflow-step';

        if (isCurrentStep) {
            return `${baseClass} active`;
        } else if (status === StepStatus.SUCCESS) {
            return `${baseClass} completed success`;
        } else if (status === StepStatus.FAILURE) {
            return `${baseClass} completed failure`;
        } else {
            return baseClass;
        }
    }, [stepStatus]);

    // Memoized computed values
    const cartItemsCount = useMemo(() => cartItems.length, [cartItems.length]);

    const cartItemsCountText = useMemo(() =>
        `${cartItemsCount} Item${cartItemsCount !== 1 ? 's' : ''}`,
        [cartItemsCount]
    );

    const tableHeader = useMemo(() => (
        <div className="cart-table-header">
            <div className="col-thumbnail">THUMBNAIL</div>
            <div className="col-title">TITLE</div>
            <div className="col-rights">RIGHTS RESTRICTIONS</div>
            <div className="col-action">ACTION</div>
        </div>
    ), []);

    const emptyCartMessage = useMemo(() => (
        <div className="empty-cart">
            <div className="empty-cart-message">
                <span>Your cart is empty</span>
            </div>
        </div>
    ), []);

    // Memoized cart item removal handler
    const handleRemoveItem = useCallback((item: Asset) => {
        onRemoveItem(item);
    }, [onRemoveItem]);

    // Check if any cart item has SMR risk type management
    const hasSMRItem = useMemo(() => {
        return cartItems.some(item => item?.riskTypeManagement === 'smr');
    }, [cartItems]);

    // Check if any cart item has isRestrictedBrand true
    const hasRestrictedBrandItem = useMemo(() => {
        return cartItems?.some(item => item.isRestrictedBrand) || false;
    }, [cartItems]);

    const hasAllItemsReadyToUse = useMemo(() => {
        return cartItems.every(item => item?.readyToUse?.toLowerCase() === 'yes');
    }, [cartItems]);

    // Populate each cart item with isRestrictedBrand property whenever cartItems changes
    useEffect(() => {
        if (!restrictedBrands || restrictedBrands.length === 0 || !cartItems || cartItems.length === 0) {
            return;
        }

        // Get all restricted brand values (case-insensitive)
        const restrictedBrandValues = restrictedBrands
            .map(rb => rb.value?.toLowerCase().trim())
            .filter(Boolean);

        if (restrictedBrandValues.length === 0) {
            return;
        }

        // Update each cart item with isRestrictedBrand property
        const updatedCartItems = cartItems.map(item => {
            let isRestrictedBrand = false;

            if (item.brand) {
                // Split by comma and check each brand (case-insensitive)
                const brands = item.brand.split(',').map(b => b.trim().toLowerCase());
                isRestrictedBrand = brands.some(brand =>
                    brand && restrictedBrandValues.includes(brand)
                );
            }

            return {
                ...item,
                isRestrictedBrand
            };
        });

        // Only update if there are actual changes to avoid infinite loops
        const hasChanges = updatedCartItems.some((item, index) =>
            item.isRestrictedBrand !== cartItems[index].isRestrictedBrand
        );

        if (hasChanges) {
            setCartItems(updatedCartItems);
        }
    }, [cartItems, restrictedBrands, setCartItems]);

    return (
        <>
            {/* Workflow Progress */}
            <div className="workflow-progress">
                <div className={getStepClassName(WorkflowStep.CART, activeStep === WorkflowStep.CART)}>
                    <div className="step-icon">
                        {renderStepIcon(WorkflowStep.CART)}
                    </div>
                    <span className="step-label">Cart</span>
                </div>
                <div className="horizontal-line"></div>
                {!hasAllItemsReadyToUse && (
                    <>
                        <div className={getStepClassName(WorkflowStep.REQUEST_DOWNLOAD, activeStep === WorkflowStep.REQUEST_DOWNLOAD)}>
                            <div className="step-icon">
                                {renderStepIcon(WorkflowStep.REQUEST_DOWNLOAD)}
                            </div>
                            <span className="step-label">Request Download</span>
                        </div>
                        <div className="horizontal-line"></div>
                        <div className={getStepClassName(WorkflowStep.RIGHTS_CHECK, activeStep === WorkflowStep.RIGHTS_CHECK)}>
                            <div className="step-icon">
                                {renderStepIcon(WorkflowStep.RIGHTS_CHECK)}
                            </div>
                            <span className="step-label">Rights Check</span>
                        </div>
                        <div className="horizontal-line"></div>
                    </>
                )}
                <div className={getStepClassName(WorkflowStep.DOWNLOAD, activeStep === WorkflowStep.DOWNLOAD)}>
                    <div className="step-icon">
                        {renderStepIcon(WorkflowStep.DOWNLOAD)}
                    </div>
                    <span className="step-label">Download</span>
                </div>
            </div>

            {/* Status Messages */}
            <div className="workflow-status">
                {stepStatus[WorkflowStep.CART] === StepStatus.FAILURE && (
                    <div className="status-message error">
                        ❌ Cart preparation failed. Please try again.
                    </div>
                )}
                {stepStatus[WorkflowStep.REQUEST_DOWNLOAD] === StepStatus.FAILURE && (
                    <div className="status-message error">
                        ❌ Download request failed. Please retry.
                    </div>
                )}
                {stepStatus[WorkflowStep.RIGHTS_CHECK] === StepStatus.FAILURE && (
                    <div className="status-message error">
                        ❌ Rights check failed. Please retry.
                    </div>
                )}
                {stepStatus[WorkflowStep.DOWNLOAD] === StepStatus.FAILURE && (
                    <div className="status-message error">
                        ❌ Download failed. Please retry.
                    </div>
                )}
            </div>

            {/* Cart Content */}
            <div className="cart-content">
                {cartItemsCount === 0 ? (
                    emptyCartMessage
                ) : (
                    <>
                        <div className="cart-items-count">
                            <span className="red-text">{cartItemsCountText}</span> in your cart
                        </div>

                        {/* Table Header */}
                        {tableHeader}

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
                                            <span className="rights-badge">
                                                {item?.riskTypeManagement === 'smr' ? 'Self-managed rights (SMR)' : 'Fully-managed rights (FMR)'}
                                            </span>
                                            <span className="rights-badge">
                                                {item.isRestrictedBrand ? 'Brand restricted by market' : ''}
                                            </span>
                                        </div>
                                        <div className="col-action">
                                            <button
                                                className="delete-button"
                                                onClick={() => handleRemoveItem(item)}
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

            {/* SMR Warnings - only show if any cart item has SMR risk type */}
            {hasSMRItem && (
                <div className="smr-warnings tccc-warnings">
                    <p>{smrWarnings}</p>
                </div>
            )}

            {/* Restricted Brands Warnings - only show if any cart item has a restricted brand */}
            {hasRestrictedBrandItem && (
                <div className="restricted-brands-warnings tccc-warnings">
                    <p>{restrictedBrandsWarning}</p>
                </div>
            )}

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
                {activeStep === WorkflowStep.CART && (
                    hasAllItemsReadyToUse ? (
                        <button className="action-btn primary" onClick={handleDirectDownload}>
                            Download Cart
                        </button>
                    ) : (
                        <button className="action-btn primary disabled" onClick={(e) => e.preventDefault()}>
                            Request Download
                        </button>
                    )
                )}
                {activeStep === WorkflowStep.REQUEST_DOWNLOAD && (
                    <>
                        <button className="action-btn primary" onClick={handleRightsCheck}>
                            Check Rights
                        </button>
                        {stepStatus[WorkflowStep.REQUEST_DOWNLOAD] === StepStatus.FAILURE && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep(WorkflowStep.REQUEST_DOWNLOAD)}>
                                Retry Request
                            </button>
                        )}
                    </>
                )}
                {activeStep === WorkflowStep.RIGHTS_CHECK && (
                    <>
                        <button className="action-btn primary" onClick={handleFinalDownload}>
                            Download Assets
                        </button>
                        {stepStatus[WorkflowStep.RIGHTS_CHECK] === StepStatus.FAILURE && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep(WorkflowStep.RIGHTS_CHECK)}>
                                Retry Rights Check
                            </button>
                        )}
                    </>
                )}
                {activeStep === WorkflowStep.DOWNLOAD && (
                    <>
                        {stepStatus[WorkflowStep.DOWNLOAD] === StepStatus.CURRENT && (
                            <button className="action-btn primary" onClick={handleCompleteDownload}>
                                Complete Download
                            </button>
                        )}
                        {stepStatus[WorkflowStep.DOWNLOAD] === StepStatus.SUCCESS && (
                            <button className="action-btn primary" disabled>
                                Download Complete ✓
                            </button>
                        )}
                        {stepStatus[WorkflowStep.DOWNLOAD] === StepStatus.FAILURE && (
                            <button className="action-btn secondary" onClick={() => handleRetryStep(WorkflowStep.DOWNLOAD)}>
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