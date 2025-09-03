// Asset-related types
import React from 'react';

export interface Rendition {
    name?: string;
    format?: string;
    size?: number;
    dimensions?: { width: number; height: number };
}

export interface Asset {
    agencyName?: string;
    ageDemographic?: string;
    alt?: string;
    assetId?: string;
    assetStatus?: string;
    beverageType?: string;
    brand?: string;
    isRestrictedBrand?: boolean;
    businessAffairsManager?: string;
    campaignActivationRemark?: string;
    campaignName?: string;
    campaignReach?: string;
    campaignSubActivationRemark?: string;
    category?: string;
    categoryAndType?: string;
    createBy?: string;
    createDate?: string | number;
    description?: string;
    derivedAssets?: string;
    experienceId?: string;
    expired?: string;
    expirationDate?: string | number;
    fadelId?: string;
    format?: string;
    formatType?: string;
    formatLabel?: string;
    japaneseDescription?: string;
    japaneseKeywords?: string;
    japaneseTitle?: string;
    intendedBottlerCountry?: string;
    intendedChannel?: string;
    intendedCustomers?: string;
    intendedBusinessUnitOrMarket?: string;
    jobId?: string;
    keywords?: string;
    language?: string;
    lastModified?: string | number;
    leadOperatingUnit?: string;
    legacyAssetId1?: string;
    legacyAssetId2?: string;
    legacyFileName?: string;
    legacySourceSystem?: string;
    layout?: string;
    longRangePlan?: string;
    longRangePlanTactic?: string;
    marketCovered?: string;
    masterOrAdaptation?: string;
    media?: string;
    migrationId?: string;
    modifyBy?: string;
    modifyDate?: string | number;
    name?: string;
    offTime?: string;
    onTime?: string;
    orientation?: string;
    originalCreateDate?: string;
    otherAssets?: string;
    packageDepicted?: string;
    packageOrContainerMaterial?: string;
    packageOrContainerSize?: string;
    packageOrContainerType?: string;
    projectId?: string;
    publishBy?: string;
    publishDate?: string | number;
    publishStatus?: string;
    ratio?: string;
    resolution?: string;
    rightsEndDate?: string | number;
    readyToUse?: string;
    rightsNotes?: string;
    rightsProfileTitle?: string;
    rightsStartDate?: string | number;
    rightsStatus?: string;
    riskTypeManagement?: string;
    secondaryPackaging?: string;
    size?: string;
    sourceAsset?: string;
    sourceId?: string;
    sourceUploadDate?: string;
    sourceUploader?: string;
    subBrand?: string;
    tcccContact?: string;
    tcccLeadAssociateLegacy?: string;
    tags?: string;
    titling?: string;
    title?: string;
    trackName?: string;
    underEmbargo?: string;
    url: string;
    usage?: string;
    workfrontId?: string;
    xcmKeywords?: string;
    imageHeight?: string;
    imageWidth?: string;
    duration?: string;
    broadcastFormat?: string;
    fadelJobId?: string;
    formatedSize?: string;
    brandsWAssetGuideline?: string;
    brandsWAssetHero?: string;
    campaignsWKeyAssets?: string;
    assetAssociatedWithBrand?: string;
    fundingBuOrMarket?: string;
    dateUploaded?: string;
    renditions?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    imagePresets?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    [key: string]: unknown; // For additional Algolia hit properties
}

// Cart-related types
export interface CartItem extends Asset {
    // Additional cart-specific properties can be added here
    isRestrictedBrand?: boolean;
}

// Component prop types
export interface CartIconProps {
    itemCount: number;
    onClick: () => void;
}

export interface AssetCardProps {
    image: Asset;
    handleCardDetailClick: (image: Asset, event: React.MouseEvent) => void;
    handlePreviewClick: (image: Asset, event: React.MouseEvent) => void;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    isSelected?: boolean;
    onCheckboxChange?: (id: string, checked: boolean) => void;
    showFullDetails?: boolean;
}

// Query and filter types
export const QUERY_TYPES = {
    ASSETS: 'Assets',
    COLLECTIONS: 'Collections',
} as const;

export type QueryType = typeof QUERY_TYPES[keyof typeof QUERY_TYPES];

// Step status types for cart processing
export enum StepStatus {
    INIT = 'init',
    CURRENT = 'current',
    SUCCESS = 'success',
    FAILURE = 'failure'
}

export interface StepStatuses {
    cart: StepStatus;
    'request-download': StepStatus;
    'download': StepStatus;
}

// Phase 1 Component Types

export interface SearchBarProps {
    query: string;
    setQuery: (query: string) => void;
    sendQuery: (queryType: string) => void;
    selectedQueryType: string;
    setSelectedQueryType: (queryType: string) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

// Phase 2 Component Types

// Collection-related types
export interface CollectionMetadata {
    title: string;
    description?: string;
}

export interface Collection {
    collectionId: string;
    thumbnail?: string;
    collectionMetadata: CollectionMetadata;
}



// Cart Panel types
export interface CartPanelProps {
    isOpen: boolean;
    onClose: () => void;
    cartItems: CartItem[];
    setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
    onRemoveItem: (item: CartItem) => void;
    onApproveAssets: (items: CartItem[]) => void;
    onDownloadAssets: (items: CartItem[]) => void;
}

// Header Bar types
export interface HeaderBarProps {
    cartItems: CartItem[];
    setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
    handleRemoveFromCart: (item: CartItem) => void;
    handleApproveAssets: (items: CartItem[]) => void;
    handleDownloadAssets: (items: CartItem[]) => void;
    handleAuthenticated: (userData: string) => void;
    handleSignOut: () => void;
}

// Asset Preview types
export interface AssetPreviewProps {
    showModal: boolean;
    selectedImage: Asset | null;
    closeModal: () => void;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    renditions?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    fetchAssetRenditions?: (asset: Asset) => Promise<void>;
}

// Asset Details types (extends AssetPreview)
export interface AssetDetailsProps extends AssetPreviewProps {
    imagePresets?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    renditions?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    fetchAssetRenditions?: (asset: Asset) => Promise<void>;
}

export interface SavedSearch {
    id: string;
    name: string;
    searchTerm: string;
    facetFilters: string[][];
    numericFilters: string[];
    dateCreated: number;
    dateLastModified: number;
    dateLastUsed?: number;
    favorite: boolean;
}

export interface FacetsProps {
    searchResults?: SearchResults['results'] | null;
    selectedFacetFilters?: string[][];
    setSelectedFacetFilters: (facetFilters: string[][]) => void;
    search: (query?: string) => void;
    excFacets?: Record<string, unknown>;
    selectedNumericFilters?: string[];
    setSelectedNumericFilters: (filters: string[]) => void;
    query: string;
    setQuery: (query: string) => void;
}

// Phase 3 Component Types

// Search/Query Result types
export interface SearchHits {
    nbHits?: number;
    [key: string]: unknown;
}

import type { ExcFacets } from '../constants/facets';

// Restricted Brand interface
export interface RestrictedBrand {
    title: string;
    value: string;
}

// External Parameters interface
export interface ExternalParams {
    accordionTitle?: string;
    accordionContent?: string;
    excFacets?: ExcFacets;
    isBlockIntegration?: boolean;
    restrictedBrands?: RestrictedBrand[];
    presetFilters?: string[];
}

// Image Gallery types
export interface ImageGalleryProps {
    images: Asset[];
    loading: boolean;
    onAddToCart?: (image: Asset) => void;
    onRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    searchResult?: SearchResult | null;
    onToggleMobileFilter?: () => void;
    isMobileFilterOpen?: boolean;
    onBulkAddToCart: (selectedCardIds: Set<string>, images: Asset[]) => void;
    onSortByTopResults: () => void;
    onSortByDateCreated: () => void;
    onSortByLastModified: () => void;
    onSortBySize: () => void;
    onSortDirectionAscending: () => void;
    onSortDirectionDescending: () => void;
    selectedSortType: string;
    selectedSortDirection: string;
    onSortTypeChange: (sortType: string) => void;
    onSortDirectionChange: (direction: string) => void;
    onLoadMoreResults?: () => void;
    hasMorePages?: boolean;
    isLoadingMore?: boolean;
    imagePresets?: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    assetRenditionsCache?: {
        [assetId: string]: {
            assetId?: string;
            items?: Rendition[];
            'repo:name'?: string;
        }
    };
    fetchAssetRenditions?: (asset: Asset) => Promise<void>;
}

// Main App types (for the most complex component)
export interface MainAppState {
    images: Asset[];
    collections: Collection[];
    cartItems: CartItem[];
    loading: boolean;
    selectedFacets: string[][];
}

// Adobe Sign In types
export interface AdobeUser {
    id: string;
    name: string;
    email: string;
    [key: string]: unknown;
}

export interface AdobeSignInButtonProps {
    onAuthenticated: (token: string) => void;
    onSignOut: () => void;
}

// Cart Panel Assets types (complex workflow)
export enum WorkflowStep {
    CART = 'cart',
    REQUEST_DOWNLOAD = 'request-download',
    RIGHTS_CHECK = 'rights-check',
    DOWNLOAD = 'download',
    COMPLETE_DOWNLOAD = 'complete-download'
}

export enum FilteredItemsType {
    READY_TO_USE = 'ready-to-use'
}

export interface WorkflowStepStatuses {
    [WorkflowStep.CART]: StepStatus;
    [WorkflowStep.REQUEST_DOWNLOAD]: StepStatus;
    [WorkflowStep.RIGHTS_CHECK]: StepStatus;
    [WorkflowStep.DOWNLOAD]: StepStatus;
    [WorkflowStep.COMPLETE_DOWNLOAD]: StepStatus;
}

export interface WorkflowStepIcons {
    [WorkflowStep.CART]: React.JSX.Element | string;
    [WorkflowStep.REQUEST_DOWNLOAD]: React.JSX.Element | string;
    [WorkflowStep.RIGHTS_CHECK]: React.JSX.Element | string;
    [WorkflowStep.DOWNLOAD]: React.JSX.Element | string;
    [WorkflowStep.COMPLETE_DOWNLOAD]: React.JSX.Element | string;
}

export interface CartPanelAssetsProps {
    cartItems: CartItem[];
    setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
    onRemoveItem: (item: CartItem) => void;
    onApproveAssets: (items: CartItem[]) => void;
    onDownloadAssets: (items: CartItem[]) => void;
    onClose: () => void;
    onActiveStepChange: (step: WorkflowStep) => void;
}

// Extended CartItem for authorization workflow
export interface AuthorizedCartItem extends CartItem {
    authorized?: boolean;
    authorizedDate?: string;
    copyright?: unknown;
}

// MainApp types (most complex component)
export const CURRENT_VIEW = {
    images: 'images',
    collections: 'collections',
} as const;

export type CurrentView = typeof CURRENT_VIEW[keyof typeof CURRENT_VIEW];

export const LOADING = {
    dmImages: 'dmImages',
    collections: 'collections',
} as const;

export type LoadingType = typeof LOADING[keyof typeof LOADING];

export interface LoadingState {
    [LOADING.dmImages]: boolean;
    [LOADING.collections]: boolean;
}

export interface AlgoliaSearchParams {
    facets?: string[] | string;
    facetFilters?: string[][] | string;
    filters?: string;
    highlightPostTag?: string;
    highlightPreTag?: string;
    hitsPerPage?: number;
    maxValuesPerFacet?: number;
    page?: number;
    query?: string;
    tagFilters?: string;
    numericFilters?: string[];
    analytics?: boolean;
    clickAnalytics?: boolean;
}

export interface AlgoliaSearchRequest {
    indexName: string;
    params: AlgoliaSearchParams;
}

export interface AlgoliaSearchQuery {
    requests: AlgoliaSearchRequest[];
}

// Facet Filter types
export interface FacetCheckedState {
    [facetTechId: string]: {
        [facetName: string]: boolean;
    };
}

export interface SearchResult {
    hits: Asset[];
    nbHits: number;
    nbPages: number;
    facets?: {
        [facetTechId: string]: {
            [facetName: string]: number;
        };
    };
    [key: string]: unknown;
}

export interface SearchResults {
    results: SearchResult[];
}

// Action Dropdown types
export interface ActionDropdownProps {
    className?: string;
    items: string[];
    handlers: (() => void)[];
    show: boolean;
    label?: string;
    selectedItem?: string;
    onSelectedItemChange?: (item: string) => void;
}

export interface SearchPanelProps {
    totalCount: string;
    selectedCount: number;
    displayedCount: number;
    onSelectAll: (isChecked: boolean) => void;
    onToggleMobileFilter?: () => void;
    isMobileFilterOpen?: boolean;
    onBulkAddToCart: () => void;
    onBulkDownload: () => void;
    onBulkShare: () => void;
    onBulkAddToCollection: () => void;
    onSortByTopResults: () => void;
    onSortByDateCreated: () => void;
    onSortByLastModified: () => void;
    onSortBySize: () => void;
    onSortDirectionAscending: () => void;
    onSortDirectionDescending: () => void;
    selectedSortType: string;
    selectedSortDirection: string;
    onSortTypeChange: (sortType: string) => void;
    onSortDirectionChange: (direction: string) => void;
    showFullDetails?: boolean;
    onShowFullDetailsChange?: (showDetails: boolean) => void;
    viewType?: 'grid' | 'list';
    onViewTypeChange?: (viewType: 'grid' | 'list') => void;
    currentPage?: number;
    totalPages?: number;
    hasMorePages?: boolean;
}
