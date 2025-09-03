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
import { FilteredItemsType, StepStatus, WorkflowStep } from '../types';
import { removeBlobFromCache } from '../utils/blobCache';
import './CartPanelAssets.css';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import ThumbnailImage from './ThumbnailImage';

const CartPanelAssets: React.FC<CartPanelAssetsProps> = ({
    cartItems,
    setCartItems,
    onRemoveItem,
    onClose,
    onActiveStepChange
}) => {
    // Get app config from context - no prop drilling needed!
    const { externalParams } = useAppConfig();
    const { restrictedBrands } = externalParams;

    const [activeStep, setActiveStep] = useState<WorkflowStep>(WorkflowStep.CART);
    const [stepStatus, setStepStatus] = useState<WorkflowStepStatuses>({
        [WorkflowStep.CART]: StepStatus.INIT,
        [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.INIT,
        [WorkflowStep.RIGHTS_CHECK]: StepStatus.INIT,
        [WorkflowStep.DOWNLOAD]: StepStatus.INIT,
        [WorkflowStep.COMPLETE_DOWNLOAD]: StepStatus.INIT
    });
    const [stepIcon, setStepIcon] = useState<WorkflowStepIcons>({
        [WorkflowStep.CART]: '',
        [WorkflowStep.REQUEST_DOWNLOAD]: '',
        [WorkflowStep.RIGHTS_CHECK]: '',
        [WorkflowStep.DOWNLOAD]: '',
        [WorkflowStep.COMPLETE_DOWNLOAD]: ''
    });
    const [filteredItems, setFilteredItems] = useState<{ [key in FilteredItemsType]: Asset[] }>({} as { [key in FilteredItemsType]: Asset[] });
    const [showDownloadContent, setShowDownloadContent] = useState(false);

    // Notify parent when activeStep changes
    useEffect(() => {
        onActiveStepChange(activeStep);
    }, [activeStep, onActiveStepChange]);

    // Monitor stepStatus changes and handle each status for all steps
    useEffect(() => {
        Object.entries(stepStatus).forEach(([step, status]) => {
            console.log(`Step "${step}" status changed to: ${status}`);

            switch (step as WorkflowStep) {
                case WorkflowStep.CART:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-init.svg`} alt="Cart" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/cart-stepper-icon-current.svg`} alt="Cart Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Cart Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
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
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-init.svg`} alt="Request Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/request-download-stepper-icon-current.svg`} alt="Request Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Request Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
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
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-init.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/rights-check-stepper-icon-current.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
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
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-init.svg`} alt="Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/download-stepper-icon-current.svg`} alt="Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            // Could trigger success notification or auto-close
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`${import.meta.env.BASE_URL}icons/stepper-icon-success.svg`} alt="Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
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

    // Update filteredItems when cartItems changes
    useEffect(() => {
        setFilteredItems(prev => ({
            ...prev,
            [FilteredItemsType.READY_TO_USE]: cartItems.filter(item => item?.readyToUse?.toLowerCase() === 'yes')
        }));
    }, [cartItems]);

    const handleClearCart = useCallback((): void => {
        // Remove cached blobs for each cart item
        cartItems.forEach(item => {
            if (item.assetId) {
                removeBlobFromCache(item.assetId);
            }
        });

        setCartItems([]);
    }, [cartItems, setCartItems]);

    const handleRequestDownload = useCallback((): void => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.CART]: StepStatus.SUCCESS }));
        setActiveStep(WorkflowStep.REQUEST_DOWNLOAD);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.CURRENT }));
    }, []);

    const handleRightsCheck = useCallback(async (): Promise<void> => {
        setActiveStep(WorkflowStep.RIGHTS_CHECK);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));
    }, []);

    const handleDownload = useCallback(async (): Promise<void> => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.CART]: stepStatus[WorkflowStep.CART] === StepStatus.INIT ? StepStatus.SUCCESS : stepStatus[WorkflowStep.CART] }));
        setActiveStep(WorkflowStep.DOWNLOAD);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.CURRENT }));

        // Get ready-to-use items for download
        const readyToUseItems = filteredItems[FilteredItemsType.READY_TO_USE] || [];
        console.log('Ready to use items for download:', readyToUseItems);

        // Show download content with ready-to-use items
        if (readyToUseItems.length > 0) {
            setShowDownloadContent(true);
        }
    }, [stepStatus, filteredItems]);

    const handleCompleteDownload = useCallback(async (): Promise<void> => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.COMPLETE_DOWNLOAD]: StepStatus.CURRENT }));
        setActiveStep(WorkflowStep.COMPLETE_DOWNLOAD);
        onClose();
    }, [onClose]);

    const handleCloseDownloadContent = useCallback(() => {
        setShowDownloadContent(false);
    }, []);

    const handleDownloadComplete = useCallback((success: boolean) => {
        if (success) {
            setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.SUCCESS }));
        } else {
            setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.FAILURE }));
        }
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

    // Memoized download assets data for DownloadRenditionsContent
    const downloadAssetsData = useMemo(() => {
        const readyToUseItems = filteredItems[FilteredItemsType.READY_TO_USE] || [];
        return readyToUseItems.map(asset => ({
            asset,
            renditionsLoading: false,
            renditionsError: null
        }));
    }, [filteredItems]);

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

    if (cartItemsCount === 0) {
        return (
            <div className="cart-content">
                {emptyCartMessage}
            </div>
        );
    }

    return (
        <>
            {/* Workflow Steps Icons */}
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
            {/*
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
            */}

            {/* Download Renditions Content */}
            {showDownloadContent && downloadAssetsData.length > 0 ? (
                <DownloadRenditionsContent
                    assets={downloadAssetsData}
                    onClose={handleCloseDownloadContent}
                    onDownloadComplete={handleDownloadComplete}
                />
            ) : (
                <>
                    <div className="cart-content">
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
                                            />
                                        </div>
                                        <div className="col-title">
                                            <div className="item-title">{item.title || item.name}</div>
                                            <br />
                                            <div className="item-type">TYPE: {item.formatLabel?.toUpperCase()}</div>
                                        </div>
                                        <div className="col-rights">
                                            <span className="rights-badge">
                                                {item?.riskTypeManagement?.toLowerCase() === 'smr' ? 'Self-managed rights (SMR)' :
                                                    item?.riskTypeManagement?.toLowerCase() === 'fmr' ? 'Fully-managed rights (FMR)' : 'N/A'}
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
                        <button className="action-btn secondary-button" onClick={onClose}>
                            Close
                        </button>
                        <button className="action-btn secondary-button" onClick={handleClearCart}>
                            Clear Cart
                        </button>
                        <button className="action-btn secondary-button disabled" onClick={(e) => e.preventDefault()}>
                            Share Cart
                        </button>
                        <button className="action-btn secondary-button disabled" onClick={(e) => e.preventDefault()}>
                            Add To Collection
                        </button>

                        {/* Dynamic primary button based on step */}
                        {activeStep === WorkflowStep.CART && (
                            hasAllItemsReadyToUse ? (
                                <button className="action-btn primary-button" onClick={handleDownload}>
                                    Download Cart
                                </button>
                            ) : (
                                <button className="action-btn primary-button disabled" onClick={handleRequestDownload}>
                                    Request Download
                                </button>
                            )
                        )}
                        {activeStep === WorkflowStep.REQUEST_DOWNLOAD && (
                            <>
                                <button className="action-btn primary-button" onClick={handleRightsCheck}>
                                    Check Rights
                                </button>
                            </>
                        )}
                        {activeStep === WorkflowStep.RIGHTS_CHECK && (
                            <>
                                <button className="action-btn primary-button" onClick={handleDownload}>
                                    Download Assets
                                </button>
                            </>
                        )}
                        {activeStep === WorkflowStep.DOWNLOAD && (
                            <>
                                <button className="action-btn primary-button" onClick={handleCompleteDownload}>
                                    Complete Download
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </>
    );
};

export default CartPanelAssets; 