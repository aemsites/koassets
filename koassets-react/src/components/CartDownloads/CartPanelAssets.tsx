import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthorizationStatus } from '../../clients/fadel-client';
import { restrictedBrandsWarning, smrWarnings } from '../../constants/warnings';
import { useAppConfig } from '../../hooks/useAppConfig';
import type {
    Asset,
    CartPanelAssetsProps,
    RequestDownloadStepData,
    RequestRightsExtensionStepData,
    RestrictedBrand,
    RightsCheckStepData,
    WorkflowStepData,
    WorkflowStepStatuses
} from '../../types';
import { FilteredItemsType, StepStatus, WorkflowStep } from '../../types';
import { removeBlobFromCache } from '../../utils/blobCache';
import DownloadRenditionsContent from '../DownloadRenditionsContent';
import ThumbnailImage from '../ThumbnailImage';
import './CartPanelAssets.css';
import CartRequestDownload from './CartRequestDownload';
import CartRequestRightsExtension from './CartRequestRightsExtension';
import CartRightsCheck from './CartRightsCheck';
import EmptyCartDownloadContent from './EmptyCartDownloadContent';
import { WorkflowProgress } from './WorkflowProgress';

// Component for rendering individual cart item row
interface CartAssetItemRowProps {
    item: Asset;
    onRemoveItem: (item: Asset) => void;
}

const CartAssetItemRow: React.FC<CartAssetItemRowProps> = ({ item, onRemoveItem }) => {
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
    cartAssetItems: Asset[];
}

const CartActionsFooter: React.FC<CartActionsFooterProps> = ({
    activeStep,
    hasAllItemsReadyToUse,
    onClose,
    onClearCart,
    onOpenDownload,
    onOpenRequestDownload,
    onCloseDownload,
    cartAssetItems
}) => {
    const handleAddToCollectionFromCart = (e: React.MouseEvent): void => {
        e.preventDefault();
        try {
            if (!cartAssetItems || cartAssetItems.length === 0) return;
            const detail = { assets: cartAssetItems } as unknown as Record<string, unknown>;
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


const CartPanelAssets: React.FC<CartPanelAssetsProps> = ({
    cartAssetItems,
    setCartAssetItems,
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


    // Update filteredItems when cartAssetItems changes
    useEffect(() => {
        setFilteredItems(prev => ({
            ...prev,
            [FilteredItemsType.READY_TO_USE]: cartAssetItems.filter(item => item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE)
        }));
    }, [cartAssetItems]);

    const handleClearCart = useCallback((): void => {
        // Remove cached blobs for each cart item
        cartAssetItems.forEach(item => {
            if (item.assetId) {
                removeBlobFromCache(item.assetId);
            }
        });

        setCartAssetItems([]);
    }, [cartAssetItems, setCartAssetItems]);

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
            const authorizedItems = cartAssetItems.filter(item => !restrictedAssetIds.includes(item.assetId));

            setCartAssetItems(authorizedItems);

            // If there are still items in cart after removal, go back to RIGHTS_CHECK
            if (authorizedItems.length > 0) {
                setStepStatus(prev => ({ ...prev, [WorkflowStep.REQUEST_RIGHTS_EXTENSION]: StepStatus.SUCCESS }));
                setActiveStep(WorkflowStep.RIGHTS_CHECK);
                setStepStatus(prev => ({ ...prev, [WorkflowStep.RIGHTS_CHECK]: StepStatus.CURRENT }));
            }
            // If no items left, the auto-close useEffect will handle closing the cart
        }
    }, [cartAssetItems, setCartAssetItems]);

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
            setActiveStep(WorkflowStep.CLOSE_DOWNLOAD);
            console.log('Download completed successfully for assets:', successfulAssets);

            // Remove successfully downloaded assets from cart
            if (successfulAssets && successfulAssets.length > 0) {
                const successfulAssetIds = successfulAssets.map(asset => asset.assetId);
                const newCartAssetItems = cartAssetItems.filter(item => !successfulAssetIds.includes(item.assetId));
                setCartAssetItems(newCartAssetItems);
            }
        } else {
            setStepStatus(prev => ({ ...prev, [WorkflowStep.DOWNLOAD]: StepStatus.FAILURE }));
        }
    }, [setCartAssetItems, cartAssetItems]);


    // Memoized computed values
    const cartAssetItemsCount = useMemo(() => cartAssetItems.length, [cartAssetItems.length]);

    const cartAssetItemsCountText = useMemo(() =>
        `${cartAssetItemsCount} Item${cartAssetItemsCount !== 1 ? 's' : ''}`,
        [cartAssetItemsCount]
    );

    const tableHeader = useMemo(() => (
        <div className="cart-table-header">
            <div className="col-thumbnail">THUMBNAIL</div>
            <div className="col-title">TITLE</div>
            <div className="col-rights">RIGHTS RESTRICTIONS</div>
            <div className="col-action">ACTION</div>
        </div>
    ), []);

    // Memoized cart item removal handler
    const handleRemoveItem = useCallback((item: Asset) => {
        onRemoveItem(item);
    }, [onRemoveItem]);

    // Check if any cart item has SMR risk type management
    const hasSMRItem = useMemo(() => {
        return cartAssetItems.some(item => item?.riskTypeManagement === 'smr');
    }, [cartAssetItems]);

    // Check if any cart item has isRestrictedBrand true
    const hasRestrictedBrandItem = useMemo(() => {
        return cartAssetItems?.some(item => item.isRestrictedBrand) || false;
    }, [cartAssetItems]);

    const hasAllItemsReadyToUse = useMemo(() => {
        return cartAssetItems.every(item => item?.readyToUse?.toLowerCase() === 'yes' || item?.authorized === AuthorizationStatus.AVAILABLE);
    }, [cartAssetItems]);

    // Memoized download assets data for DownloadRenditionsContent
    const downloadAssetsData = useMemo(() => {
        const readyToUseItems = filteredItems[FilteredItemsType.READY_TO_USE] || [];
        return readyToUseItems.map(asset => ({
            asset,
            renditionsLoading: false,
            renditionsError: null
        }));
    }, [filteredItems]);

    // Populate each cart item with isRestrictedBrand property whenever cartAssetItems changes
    useEffect(() => {
        if (!restrictedBrands || restrictedBrands.length === 0 || !cartAssetItems || cartAssetItems.length === 0) {
            return;
        }

        // Get all restricted brand values (case-insensitive)
        const restrictedBrandValues = restrictedBrands
            .map((rb: RestrictedBrand) => rb.value?.toLowerCase().trim())
            .filter(Boolean);

        if (restrictedBrandValues.length === 0) {
            return;
        }

        // Update each cart item with isRestrictedBrand property
        const updatedCartAssetItems = cartAssetItems.map(item => {
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
        const hasChanges = updatedCartAssetItems.some((item, index) =>
            item.isRestrictedBrand !== cartAssetItems[index].isRestrictedBrand
        );

        if (hasChanges) {
            setCartAssetItems(updatedCartAssetItems);
        }
    }, [cartAssetItems, restrictedBrands, setCartAssetItems]);

    // Close cart when all items are removed
    // useEffect(() => {
    //     if (cartAssetItems.length === 0) {
    //         onClose();
    //     }
    // }, [cartAssetItems.length, onClose]);

    if (cartAssetItemsCount === 0) {
        return <EmptyCartDownloadContent msg="Your cart is empty" />;
    }

    return (
        <div className="cart-panel-assets-wrapper">
            {/* Workflow Steps Icons */}
            <WorkflowProgress
                activeStep={activeStep}
                hasAllItemsReadyToUse={hasAllItemsReadyToUse}
                stepStatus={stepStatus}
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
                    cartAssetItems={cartAssetItems}
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
                    cartAssetItems={cartAssetItems}
                    setCartAssetItems={setCartAssetItems}
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
                            <span className="red-text">{cartAssetItemsCountText}</span> in your cart
                        </div>

                        {/* Table Header */}
                        {tableHeader}

                        {/* Cart Items */}
                        <div className="cart-items-table">
                            {cartAssetItems.map((item: Asset) => (
                                <CartAssetItemRow
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
                        cartAssetItems={cartAssetItems}
                    />
                </>
            )}
        </div>
    );
};

export default CartPanelAssets; 