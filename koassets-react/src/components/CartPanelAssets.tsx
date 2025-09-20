import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthorizationStatus } from '../clients/fadel-client';
import { restrictedBrandsWarning, smrWarnings } from '../constants/warnings';
import { useAppConfig } from '../hooks/useAppConfig';
import type {
    Asset,
    CartPanelAssetsProps,
    RequestDownloadStepData,
    RequestRightsExtensionStepData,
    RightsCheckStepData,
    WorkflowStepData,
    WorkflowStepIcons,
    WorkflowStepStatuses
} from '../types';
import { FilteredItemsType, StepStatus, WorkflowStep } from '../types';
import { removeBlobFromCache } from '../utils/blobCache';
import './CartPanelAssets.css';
import CartRequestDownload from './CartRequestDownload';
import CartRequestRightsExtension from './CartRequestRightsExtension';
import CartRightsCheck from './CartRightsCheck';
import DownloadRenditionsContent from './DownloadRenditionsContent';
import ThumbnailImage from './ThumbnailImage';

// Component for rendering individual cart item row
interface CartItemRowProps {
    item: Asset;
    onRemoveItem: (item: Asset) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onRemoveItem }) => {
    return (
        <div className={`cart-item-row`}>
            <div className="col-thumbnail">
                <ThumbnailImage item={item} />
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
                    onClick={() => onRemoveItem(item)}
                    aria-label="Remove item"
                >
                </button>
            </div>
        </div>
    );
};

// Component for rendering cart actions footer
interface CartActionsFooterProps {
    activeStep: WorkflowStep;
    hasAllItemsReadyToUse: boolean;
    onClose: () => void;
    onClearCart: () => void;
    onOpenDownload: () => void;
    onOpenRequestDownload: () => void;
    onCloseDownload: () => void;
    cartItems: Asset[];
}

const CartActionsFooter: React.FC<CartActionsFooterProps> = ({
    activeStep,
    hasAllItemsReadyToUse,
    onClose,
    onClearCart,
    onOpenDownload,
    onOpenRequestDownload,
    onCloseDownload,
    cartItems
}) => {
    const handleAddToCollectionFromCart = (e: React.MouseEvent): void => {
        e.preventDefault();
        try {
            if (!cartItems || cartItems.length === 0) return;
            const detail = { assets: cartItems } as unknown as Record<string, unknown>;
            window.dispatchEvent(new CustomEvent('openCollectionModal', { detail }));
        } catch (err) {
            console.warn('Failed to open Add to Collection modal from cart:', err);
        }
    };
    return (
        <div className="cart-actions-footer">
            <button className="action-btn secondary-button" onClick={onClose}>
                Close
            </button>
            <button className="action-btn secondary-button" onClick={onClearCart}>
                Clear Cart
            </button>
            <button className="action-btn secondary-button disabled" onClick={(e) => e.preventDefault()}>
                Share Cart
            </button>
            <button
                className="action-btn secondary-button"
                onClick={handleAddToCollectionFromCart}
            >
                Add To Collection
            </button>

            {/* Dynamic primary button based on step */}
            {activeStep === WorkflowStep.CART && (
                hasAllItemsReadyToUse ? (
                    <button className="action-btn primary-button" onClick={onOpenDownload}>
                        Download Cart
                    </button>
                ) : (
                    <button className="action-btn primary-button" onClick={onOpenRequestDownload}>
                        Request Download
                    </button>
                )
            )}
            {/* when activeStep === RIGHTS_CHECK, it has its own buttons */}
            {activeStep === WorkflowStep.DOWNLOAD && (
                <>
                    <button className="action-btn primary-button" onClick={onCloseDownload}>
                        Complete Download
                    </button>
                </>
            )}
        </div>
    );
};

// Component for rendering workflow progress steps
interface WorkflowProgressProps {
    activeStep: WorkflowStep;
    hasAllItemsReadyToUse: boolean;
    getStepClassName: (step: WorkflowStep, isActive: boolean) => string;
    renderStepIcon: (step: WorkflowStep) => React.ReactNode;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
    activeStep,
    hasAllItemsReadyToUse,
    getStepClassName,
    renderStepIcon
}) => {
    return (
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
                    {activeStep === WorkflowStep.REQUEST_RIGHTS_EXTENSION && (
                        <>
                            <div className={getStepClassName(WorkflowStep.REQUEST_RIGHTS_EXTENSION, activeStep === WorkflowStep.REQUEST_RIGHTS_EXTENSION)}>
                                <div className="step-icon">
                                    {renderStepIcon(WorkflowStep.REQUEST_RIGHTS_EXTENSION)}
                                </div>
                                <span className="step-label">Request Rights Extension</span>
                            </div>
                            <div className="horizontal-line"></div>
                        </>
                    )}
                </>
            )}
            <div className={getStepClassName(WorkflowStep.DOWNLOAD, activeStep === WorkflowStep.DOWNLOAD)}>
                <div className="step-icon">
                    {renderStepIcon(WorkflowStep.DOWNLOAD)}
                </div>
                <span className="step-label">Download</span>
            </div>
        </div>
    );
};

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
        [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: StepStatus.INIT,
        [WorkflowStep.DOWNLOAD]: StepStatus.INIT,
        [WorkflowStep.CLOSE_DOWNLOAD]: StepStatus.INIT
    });
    const [stepIcon, setStepIcon] = useState<WorkflowStepIcons>({
        [WorkflowStep.CART]: '',
        [WorkflowStep.REQUEST_DOWNLOAD]: '',
        [WorkflowStep.RIGHTS_CHECK]: '',
        [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: '',
        [WorkflowStep.DOWNLOAD]: '',
        [WorkflowStep.CLOSE_DOWNLOAD]: ''
    });
    const [filteredItems, setFilteredItems] = useState<{ [key in FilteredItemsType]: Asset[] }>({} as { [key in FilteredItemsType]: Asset[] });
    const [showDownloadContent, setShowDownloadContent] = useState(false);

    // State for storing step form data
    const [stepData, setStepData] = useState<WorkflowStepData>({});

    // State for rights extension form data (managed by parent)
    const [rightsExtensionFormData, setRightsExtensionFormData] = useState<RequestRightsExtensionStepData>({
        restrictedAssets: [],
        agencyType: 'TCCC Associate',
        agencyName: '', // required
        contactName: '', // required
        contactEmail: '', // required
        contactPhone: '',
        materialsRequiredDate: null,
        formatsRequired: '',
        usageRightsRequired: {
            music: false,
            talent: false,
            photographer: false,
            voiceover: false,
            stockFootage: false
        },
        adaptationIntention: '', // required
        budgetForMarket: '', // required
        exceptionOrNotes: '',
        agreesToTerms: false
    });

    // State for rights check form data (managed by parent)
    const [rightsCheckFormData, setRightsCheckFormData] = useState<RightsCheckStepData>({
        downloadOptions: {},
        agreesToTerms: false
    });

    // Notify parent when activeStep changes
    useEffect(() => {
        onActiveStepChange(activeStep);
    }, [activeStep, onActiveStepChange]);

    // Monitor stepStatus changes and handle each status for all steps
    useEffect(() => {
        Object.entries(stepStatus).forEach(([step, status]) => {
            console.debug(`Step "${step}" status changed to: ${status}`);

            switch (step as WorkflowStep) {
                case WorkflowStep.CART:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-stepper-icon.svg`} alt="Cart" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-stepper-icon.svg`} alt="Cart Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-icon-success.svg`} alt="Cart Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.CART]: <img src={`/icons/cart-icon-failure.svg`} alt="Cart Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.REQUEST_DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/download-asset-grey.svg`} alt="Request Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/donwload-cart-step-red.svg`} alt="Request Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/cart-icon-success.svg`} alt="Request Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_DOWNLOAD]: <img src={`/icons/cart-icon-failure.svg`} alt="Request Download Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.RIGHTS_CHECK:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/rights-check-grey.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/rights-check-red.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/cart-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.RIGHTS_CHECK]: <img src={`/icons/cart-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.REQUEST_RIGHTS_EXTENSION:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/request-rights-red.svg`} alt="Rights Check" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/request-rights-red.svg`} alt="Rights Check Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/cart-icon-success.svg`} alt="Rights Check Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: <img src={`/icons/cart-icon-failure.svg`} alt="Rights Check Failure" />
                            }));
                            break;
                    }
                    break;

                case WorkflowStep.DOWNLOAD:
                    switch (status) {
                        case StepStatus.INIT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/download-icon.svg`} alt="Download" />
                            }));
                            break;
                        case StepStatus.CURRENT:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/donwload-cart-step-red.svg`} alt="Download Current" />
                            }));
                            break;
                        case StepStatus.SUCCESS:
                            // Could trigger success notification or auto-close
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/cart-icon-success.svg`} alt="Download Success" />
                            }));
                            break;
                        case StepStatus.FAILURE:
                            setStepIcon(prev => ({
                                ...prev,
                                [WorkflowStep.DOWNLOAD]: <img src={`/icons/cart-icon-failure.svg`} alt="Download Failure" />
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
            [FilteredItemsType.READY_TO_USE]: cartItems.filter(item => item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE)
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

    const handleOpenRequestDownload = useCallback((): void => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.CART]: StepStatus.SUCCESS }));
        setActiveStep(WorkflowStep.REQUEST_DOWNLOAD);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.CURRENT }));
    }, []);

    // Handler for opening rights check with intended use data
    const handleOpenRightsCheck = useCallback((requestDownloadData: RequestDownloadStepData): void => {
        console.log('Opening rights check with request download data:', requestDownloadData);

        // Initialize the rights check form data with default values
        setRightsCheckFormData({
            downloadOptions: {},
            agreesToTerms: false
        });

        // Store the request download step data (which now includes intended use data)
        setStepData(prev => ({
            ...prev,
            requestDownload: requestDownloadData
        }));

        // Mark REQUEST_DOWNLOAD step as successful
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.SUCCESS }));

        // Move to RIGHTS_CHECK step
        setActiveStep(WorkflowStep.RIGHTS_CHECK);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));
    }, []);

    // Handler for requesting rights extension
    const handleOpenRequestRightsExtension = useCallback((restrictedAssets: Asset[], requestDownloadData: RequestDownloadStepData): void => {
        // Store the current rights check form data before moving to rights extension
        setStepData(prev => ({
            ...prev,
            rightsCheck: rightsCheckFormData,
            requestDownload: requestDownloadData
        }));

        // Initialize the rights extension form data with restricted assets
        setRightsExtensionFormData(prev => ({
            ...prev,
            restrictedAssets
        }));

        // Store the rights extension step data with restricted assets
        setStepData(prev => ({
            ...prev,
            rightsExtension: {
                restrictedAssets
            }
        }));

        // Mark RIGHTS_CHECK step as successful
        setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.SUCCESS }));

        // Move to REQUEST_RIGHTS_EXTENSION step
        setActiveStep(WorkflowStep.REQUEST_RIGHTS_EXTENSION);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: StepStatus.CURRENT }));
    }, [rightsCheckFormData]);

    // Handler for sending rights extension request
    const handleSendRightsExtensionRequest = useCallback((rightsExtensionData: RequestRightsExtensionStepData): void => {
        // Update the form data state
        setRightsExtensionFormData(rightsExtensionData);

        // Store the rights extension data
        setStepData(prev => ({
            ...prev,
            rightsExtension: rightsExtensionData
        }));

        // TODO: Implement API call to submit rights extension request
        console.log('Rights extension request sent:', rightsExtensionData);

        // Remove restricted assets from cart
        if (rightsExtensionData.restrictedAssets && rightsExtensionData.restrictedAssets.length > 0) {
            const restrictedAssetIds = rightsExtensionData.restrictedAssets.map(asset => asset.assetId);
            const authorizedItems = cartItems.filter(item => !restrictedAssetIds.includes(item.assetId));

            setCartItems(authorizedItems);

            // If there are still items in cart after removal, go back to RIGHTS_CHECK
            if (authorizedItems.length > 0) {
                setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: StepStatus.SUCCESS }));
                setActiveStep(WorkflowStep.RIGHTS_CHECK);
                setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));
            }
            // If no items left, the auto-close useEffect will handle closing the cart
        }
    }, [cartItems, setCartItems]);

    const handleOpenDownload = useCallback(async (): Promise<void> => {
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

    const handleCloseDownload = useCallback(async (): Promise<void> => {
        setStepStatus(prev => ({ ...prev, [WorkflowStep.CLOSE_DOWNLOAD]: StepStatus.CURRENT }));
        setActiveStep(WorkflowStep.CLOSE_DOWNLOAD);
        onClose();
    }, [onClose]);



    // Handler for canceling from request download step
    const handleCancelRequestDownload = useCallback((): void => {
        // Go back to CART step
        setActiveStep(WorkflowStep.CART);
        setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.INIT }));
    }, []);

    const handleCloseDownloadContent = useCallback(() => {
        setShowDownloadContent(false);
    }, []);

    const handleDownloadCompleted = useCallback((success: boolean, successfulAssets?: Asset[]) => {
        if (success) {
            setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.SUCCESS }));
            console.log('Download completed successfully for assets:', successfulAssets);

            // Remove successfully downloaded assets from cart
            if (successfulAssets && successfulAssets.length > 0) {
                const successfulAssetIds = successfulAssets.map(asset => asset.assetId);
                const newCartItems = cartItems.filter(item => !successfulAssetIds.includes(item.assetId));
                setCartItems(newCartItems);
            }
        } else {
            setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.FAILURE }));
        }
    }, [setCartItems, cartItems]);

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
        return cartItems.every(item => item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE);
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

    // Close cart when all items are removed
    useEffect(() => {
        if (cartItems.length === 0) {
            onClose();
        }
    }, [cartItems.length, onClose]);

    if (cartItemsCount === 0) {
        return (
            <div className="cart-content">
                {emptyCartMessage}
            </div>
        );
    }

    return (
        <div className="cart-panel-assets-wrapper">
            {/* Workflow Steps Icons */}
            <WorkflowProgress
                activeStep={activeStep}
                hasAllItemsReadyToUse={hasAllItemsReadyToUse}
                getStepClassName={getStepClassName}
                renderStepIcon={renderStepIcon}
            />

            {/* Direct Download */}
            {activeStep === WorkflowStep.DOWNLOAD && showDownloadContent && downloadAssetsData.length > 0 ? (
                <DownloadRenditionsContent
                    assets={downloadAssetsData}
                    onClose={handleCloseDownloadContent}
                    onDownloadCompleted={handleDownloadCompleted}
                />
            ) : activeStep === WorkflowStep.REQUEST_DOWNLOAD ? (
                <CartRequestDownload
                    cartItems={cartItems}
                    onCancel={handleCancelRequestDownload}
                    onOpenRightsCheck={handleOpenRightsCheck}
                    onBack={(stepData: RequestDownloadStepData) => {
                        // Store the current step data before going back
                        setStepData(prev => ({
                            ...prev,
                            requestDownload: stepData
                        }));

                        setActiveStep(WorkflowStep.CART);
                        setStepStatus(prev => ({
                            ...prev,
                            [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.INIT,
                            [WorkflowStep.CART]: StepStatus.CURRENT
                        }));
                    }}
                    initialData={stepData.requestDownload}
                />
            ) : activeStep === WorkflowStep.RIGHTS_CHECK ? (
                <CartRightsCheck
                    cartItems={cartItems}
                    setCartItems={setCartItems}
                    intendedUse={stepData.requestDownload || {
                        airDate: null,
                        pullDate: null,
                        markets: [],
                        mediaChannels: [],
                        selectedMarkets: new Set(),
                        selectedMediaChannels: new Set(),
                        marketSearchTerm: '',
                        dateValidationError: ''
                    }}
                    onCancel={onClose}
                    onOpenRequestRightsExtension={handleOpenRequestRightsExtension}
                    onBack={(stepData: RightsCheckStepData) => {
                        // Update the form data state
                        setRightsCheckFormData(stepData);

                        // Store the current step data before going back
                        setStepData(prev => ({
                            ...prev,
                            rightsCheck: stepData
                        }));

                        setActiveStep(WorkflowStep.REQUEST_DOWNLOAD);
                        setStepStatus(prev => ({
                            ...prev,
                            [WorkflowStep.RIGHTS_CHECK]: StepStatus.INIT,
                            [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus.CURRENT
                        }));
                    }}
                    initialData={rightsCheckFormData}
                    onDownloadCompleted={handleDownloadCompleted}
                />
            ) : activeStep === WorkflowStep.REQUEST_RIGHTS_EXTENSION ? (
                <CartRequestRightsExtension
                    restrictedAssets={rightsExtensionFormData.restrictedAssets || []}
                    intendedUse={stepData.requestDownload || {
                        airDate: null,
                        pullDate: null,
                        markets: [],
                        mediaChannels: [],
                        selectedMarkets: new Set(),
                        selectedMediaChannels: new Set(),
                        marketSearchTerm: '',
                        dateValidationError: ''
                    }}
                    onCancel={onClose}
                    onSendRightsExtensionRequest={handleSendRightsExtensionRequest}
                    onBack={(stepData: RequestRightsExtensionStepData) => {
                        // Update the form data state
                        setRightsExtensionFormData(stepData);

                        // Store the current step data before going back
                        setStepData(prev => ({
                            ...prev,
                            rightsExtension: stepData
                        }));

                        setActiveStep(WorkflowStep.RIGHTS_CHECK);
                        setStepStatus(prev => ({
                            ...prev,
                            [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: StepStatus.INIT,
                            [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT
                        }));
                    }}
                    initialData={rightsExtensionFormData}
                />
            ) : (
                <>
                    <div className="cart-content">
                        {/* Cart Items Count */}
                        <div className="cart-items-count">
                            <span className="red-text">{cartItemsCountText}</span> in your cart
                        </div>

                        {/* Table Header */}
                        {tableHeader}

                        {/* Cart Items */}
                        <div className="cart-items-table">
                            {cartItems.map((item: Asset) => (
                                <CartItemRow
                                    key={item.assetId}
                                    item={item}
                                    onRemoveItem={handleRemoveItem}
                                />
                            ))}
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
                    <CartActionsFooter
                        activeStep={activeStep}
                        hasAllItemsReadyToUse={hasAllItemsReadyToUse}
                        onClose={onClose}
                        onClearCart={handleClearCart}
                        onOpenDownload={handleOpenDownload}
                        onOpenRequestDownload={handleOpenRequestDownload}
                        onCloseDownload={handleCloseDownload}
                        cartItems={cartItems}
                    />
                </>
            )}
        </div>
    );
};

export default CartPanelAssets; 