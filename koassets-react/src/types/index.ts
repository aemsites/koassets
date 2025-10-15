// Asset-related types
import React from 'react';
import { DateValue } from 'react-aria-components';

// Rights-related interfaces
export interface RightsData {
    id: number;
    rightId: number;
    name: string;
    enabled: boolean;
    children?: RightsData[];
}

export interface RightsFilters {
    rightsStartDate: DateValue;
    rightsEndDate: DateValue;
    markets: Set<RightsData>;
    mediaChannels: Set<RightsData>;
}

// Step form data interfaces for persistence
export interface RequestDownloadStepData {
    airDate?: import('@internationalized/date').CalendarDate | null;
    pullDate?: import('@internationalized/date').CalendarDate | null;
    markets: RightsData[];
    mediaChannels: RightsData[];
    selectedMarkets: Set<RightsData>;
    selectedMediaChannels: Set<RightsData>;
    marketSearchTerm: string;
    dateValidationError: string;
}


export interface RightsCheckStepData {
    downloadOptions: Record<string, {
        assetId: string;
        originalAsset: boolean;
        allRenditions: boolean;
    }>;
    agreesToTerms: boolean;
}

export interface RequestRightsExtensionStepData {
    restrictedAssets: Asset[];
    agencyType?: string;
    agencyName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    materialsNeeded?: string;
    materialsRequiredDate?: import('@internationalized/date').CalendarDate | null;
    formatsRequired?: string;
    usageRightsRequired?: {
        music: boolean;
        talent: boolean;
        photographer: boolean;
        voiceover: boolean;
        stockFootage: boolean;
    };
    adaptationIntention?: string;
    budgetForMarket?: string;
    exceptionOrNotes?: string;
    agreesToTerms?: boolean;
}

export interface WorkflowStepData {
    requestDownload?: RequestDownloadStepData;
    rightsCheck?: RightsCheckStepData;
    rightsExtension?: RequestRightsExtensionStepData;
}

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
    assetId: string;
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
    format?: string; // e.g. "application/pdf", "image/jpeg", "video/mp4"
    formatType?: string;
    formatLabel?: string;
    japaneseDescription?: string;
    japaneseKeywords?: string;
    japaneseTitle?: string;
    illustratorType?: string;
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
    authorized?: string;
    [key: string]: unknown; // For additional Algolia hit properties
}

// Cart-related types
export interface CartAssetItem extends Asset {
    // Additional cart-specific properties can be added here
    isRestrictedBrand?: boolean;
}

// Component prop types
export interface AssetCardProps {
    image: Asset;
    handleCardDetailClick: (image: Asset, event: React.MouseEvent) => void;
    handlePreviewClick: (image: Asset, event: React.MouseEvent) => void;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartAssetItems?: CartAssetItem[];
    isSelected?: boolean;
    onCheckboxChange?: (id: string, checked: boolean) => void;
    expandAllDetails?: boolean;
    index?: number; // Index in the list - used for LCP optimization
    onFacetCheckbox?: (key: string, facet: string) => void;
    onClearAllFacets?: () => void;
}

// Query and filter types
export const QUERY_TYPES = {
    ALL: 'All',
    ASSETS: 'Assets',
    PRODUCTS: 'Products',
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
    isCartPanelOpen: boolean;
    onCloseCartPanel: () => void;
    cartAssetItems: CartAssetItem[];
    setCartAssetItems: React.Dispatch<React.SetStateAction<CartAssetItem[]>>;
    cartTemplateItems: CartTemplateItem[];
    setCartTemplateItems: React.Dispatch<React.SetStateAction<CartTemplateItem[]>>;
    onRemoveItem: (item: CartAssetItem) => void;
}

// Download Panel types
export interface DownloadPanelProps {
    isDownloadPanelOpen: boolean;
    onCloseDownloadPanel: () => void;
}

// Asset Preview types
export interface AssetPreviewProps {
    showModal: boolean;
    selectedImage: Asset | null;
    closeModal: () => void;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartAssetItems?: CartAssetItem[];
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
    facetFilters: FacetCheckedState;
    numericFilters: string[];
    rightsFilters: RightsFilters;
    dateCreated: number;
    dateLastModified: number;
    dateLastUsed?: number;
    favorite: boolean;
    searchType?: string; // The search type path (e.g., '/search/all', '/search/assets', '/search/products')
}

export interface FacetValue {
    label: string;
    type: string;
    sortDirection?: string; // 'asc' or 'desc'
}

export interface FacetsProps {
    searchResults?: SearchResults['results'] | null;
    search: (searchQuery?: string) => void;
    excFacets?: Record<string, FacetValue>;
    selectedNumericFilters?: string[];
    setSelectedNumericFilters: React.Dispatch<React.SetStateAction<string[]>>;
    query: string;
    setQuery: React.Dispatch<React.SetStateAction<string>>;
    searchDisabled: boolean;
    setSearchDisabled: (disabled: boolean) => void;
    setIsRightsSearch: (isRightsSearch: boolean) => void;
    rightsStartDate: DateValue | null;
    setRightsStartDate: React.Dispatch<React.SetStateAction<DateValue | null>>;
    rightsEndDate: DateValue | null;
    setRightsEndDate: React.Dispatch<React.SetStateAction<DateValue | null>>;
    selectedMarkets: Set<RightsData>;
    setSelectedMarkets: React.Dispatch<React.SetStateAction<Set<RightsData>>>;
    selectedMediaChannels: Set<RightsData>;
    setSelectedMediaChannels: React.Dispatch<React.SetStateAction<Set<RightsData>>>;
    facetCheckedState: FacetCheckedState;
    setFacetCheckedState: React.Dispatch<React.SetStateAction<FacetCheckedState>>;
    onFacetCheckbox: (key: string, facet: string) => void;
    onClearAllFacets?: (clearFunction: () => void) => void;
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
    hitsPerPage?: number;
    fadelParams?: [{
        baseUrl?: string;
        username?: string;
        password?: string;
    }];
    campaignNameValueMapping?: Record<string, string>;
    intendedBottlerCountryValueMapping?: Record<string, string>;
    packageContainerSizeValueMapping?: Record<string, string>;
    agencyNameValueMapping?: Record<string, string>;
}

// Image Gallery types
export interface ImageGalleryProps {
    images: Asset[];
    loading: boolean;
    onAddToCart?: (image: Asset) => void;
    onRemoveFromCart?: (image: Asset) => void;
    cartAssetItems?: CartAssetItem[];
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
    isRightsSearch?: boolean;
    onFacetCheckbox?: (key: string, facet: string) => void;
    onClearAllFacets?: () => void;
}

// Main App types (for the most complex component)
export interface MainAppState {
    images: Asset[];
    collections: Collection[];
    cartAssetItems: CartAssetItem[];
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
    REQUEST_RIGHTS_EXTENSION = 'request-rights-extension',
    DOWNLOAD = 'download',
    CLOSE_DOWNLOAD = 'close-download'
}

export enum FilteredItemsType {
    READY_TO_USE = 'ready-to-use'
}

export interface WorkflowStepStatuses {
    [WorkflowStep.CART]?: StepStatus;
    [WorkflowStep.REQUEST_DOWNLOAD]?: StepStatus;
    [WorkflowStep.RIGHTS_CHECK]?: StepStatus;
    [WorkflowStep.REQUEST_RIGHTS_EXTENSION]?: StepStatus;
    [WorkflowStep.DOWNLOAD]?: StepStatus;
    [WorkflowStep.CLOSE_DOWNLOAD]?: StepStatus;
}

export interface WorkflowStepIcons {
    [WorkflowStep.CART]?: React.JSX.Element | string;
    [WorkflowStep.REQUEST_DOWNLOAD]?: React.JSX.Element | string;
    [WorkflowStep.RIGHTS_CHECK]?: React.JSX.Element | string;
    [WorkflowStep.REQUEST_RIGHTS_EXTENSION]?: React.JSX.Element | string;
    [WorkflowStep.DOWNLOAD]?: React.JSX.Element | string;
    [WorkflowStep.CLOSE_DOWNLOAD]?: React.JSX.Element | string;
}

export interface CartPanelAssetsProps {
    cartAssetItems: CartAssetItem[];
    setCartAssetItems: React.Dispatch<React.SetStateAction<CartAssetItem[]>>;
    onRemoveItem: (item: CartAssetItem) => void;
    onCloseCartPanel: () => void;
    onActiveStepChange: (step: WorkflowStep) => void;
}

export interface CartRequestRightsExtensionProps {
    restrictedAssets: CartAssetItem[];
    intendedUse: RequestDownloadStepData;
    onCancel: () => void;
    onSendRightsExtensionRequest: (rightsExtensionData: RequestRightsExtensionStepData) => void;
    onBack: (stepData: RequestRightsExtensionStepData) => void;
    initialData?: RequestRightsExtensionStepData;
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
    expandAllDetails?: boolean;
    onExpandAllDetailsChange?: (showDetails: boolean) => void;
    viewType?: 'grid' | 'list';
    onViewTypeChange?: (viewType: 'grid' | 'list') => void;
    currentPage?: number;
    totalPages?: number;
    hasMorePages?: boolean;
    selectAuthorized?: boolean;
    onSelectAuthorized?: (isChecked: boolean) => void;
    isRightsSearch?: boolean;
}

// Download archive data structure for sessionStorage
export interface DownloadAssetItem {
    assetsRenditions: {
        assetId: string;
        assetName: string;
        renditions: string[];
    }[];
    archiveId: string;
}

// Cart Template Item interface
export interface CartTemplateItem {
    // Empty for now - will be filled with template-specific properties later
}

// Download Template Item interface
export interface DownloadTemplateItem {
    // Empty for now - will be filled with template-specific properties later
}

// Metadata types for populateAssetFromMetadata function
export interface KeywordValue {
    value: string;
    '@lang'?: string;
    'repo:ancestors': string[];
}

export interface RepositoryMetadata {
    'repo:name'?: string;
    'repo:scene7File'?: string;
    'dc:format'?: string;
    'repo:createDate'?: string;
    'repo:modifyDate'?: string;
    'repo:size'?: number;
}

export interface AssetMetadata {
    'dam:activationTarget'?: string;
    'status'?: string;
    'dam:assetStatus'?: string;
    'xcm:keywords'?: KeywordValue[];
    'xcm:machineKeywords'?: KeywordValue[];
    'xmp:CreatorTool'?: string;
    'tccc:intendedBottlerCountry'?: string[];
    'tccc:intendedBusinessUnitOrMarket'?: KeywordValue[];
    'tccc:riskTypeMgmt_hidden'?: string;
    'tccc:rightsNotes'?: string;
    'tccc:intendedCustomers'?: string[];
    'dc:title'?: string;
    'xmp:CreateDate'?: string;
    'tccc:FolderId'?: string;
    'tccc:underEmbargo'?: string;
    'tccc:beverageType_hidden'?: string[];
    'tccc:intendedBusinessUnitOrMarket_hidden'?: string[];
    'xmpMM:OriginalDocumentID'?: string;
    'xmp:ModifyDate'?: string;
    'tccc:rightsStartDate'?: string;
    'tccc:intendedChannel'?: KeywordValue[];
    'tccc:fadelAssetId'?: string;
    'tccc:beverageType'?: string[];
    'tccc:riskTypeMgmt'?: string;
    'tccc:rightsStatus'?: string;
    'tccc:intendedCustomers_hidden'?: string[];
    'tccc:brand'?: KeywordValue[];
    'tccc:sharedDownstream'?: string;
    'tccc:legacyId2'?: string;
    'xmpTPg:PlateNames'?: string[];
    'tccc:yearCopyright'?: string;
    'tccc:assetStatus_hidden'?: string;
    'tccc:lastModifiedBy'?: string;
    'tccc:rightRecordTitle'?: string;
    'tccc:assetCategoryAndType'?: KeywordValue[];
    'tccc:agencyName_hidden'?: string;
    'tccc:assetCategoryAndType_hidden'?: string[];
    'tccc:intendedChannel_hidden'?: string[];
    'tccc:assignedAM'?: string;
    'tccc:agencyName'?: string;
    'tccc:autoPublish'?: boolean;
    'tccc:assetType'?: string;
    'tccc:packageDepicted'?: string;
    'tccc:masterOrAdaptation'?: string;
    'tccc:fundingBU'?: string[];
    'tccc:masterOrAdaptation_hidden'?: string;
    'tccc:description'?: string;
    'tccc:legacyFileName'?: string;
    'xmpMM:DocumentID'?: string;
    'tccc:rightsProfileType'?: string;
    'tccc:rightsProfileToContract'?: string;
    'xmpTPg:PlateNames_xmpArrayType'?: string;
    'tccc:digest'?: string;
    'tccc:readyToUse'?: string;
    'tccc:drmRestricted'?: string;
    'xmpMM:RenditionClass'?: string;
    'tccc:amReviewStatus'?: string;
    'tccc:marketCovered'?: string[];
    'tccc:language_hidden'?: string[];
    'tccc:language'?: string[];
    'tccc:associatedWBrand'?: string;
    'xmp:MetadataDate'?: string;
    'pdf:Producer'?: string;
    'tccc:migrationID'?: string;
    'tccc:mediaCovered'?: string[];
    'tccc:intendedBottlerCountry_hidden'?: string[];
    'xmpTPg:NPages'?: number;
    'dc:modified'?: string;
    'tccc:rightsStatus_hidden'?: string;
    'tccc:featuredAsset'?: string;
    'tccc:originalCreate'?: string;
    'illustrator:CreatorSubTool'?: string;
    'tccc:leadAssociate'?: string;
    'tccc:brand_hidden'?: string[];
    'tccc:assetStatus'?: string;
    'xmpTPg:HasVisibleOverprint'?: string;
    'tccc:lastModified'?: string;
    'xmpMM:InstanceID'?: string;
    'tccc:keyAsset'?: string;
    'illustrator:Type'?: string;
    'tccc:intendedMarket'?: string;
    'xmpTPg:HasVisibleTransparency'?: string;
    [key: string]: unknown; // For additional metadata fields
}

export interface Metadata {
    assetId: string;
    repositoryMetadata?: RepositoryMetadata;
    assetMetadata?: AssetMetadata;
}

// Global Window interface extensions - consolidated from multiple files
declare global {
    interface Window {
        // Configuration objects
        APP_CONFIG?: {
            BUCKET?: string;
        };
        KOAssetsConfig?: {
            externalParams?: ExternalParams;
        };

        // Cart management functions
        openCart?: () => void;
        closeCart?: () => void;
        toggleCart?: () => void;
        updateCartBadge?: (numItems: number) => void;

        // Download panel management functions  
        openDownloadPanel?: () => void;
        closeDownloadPanel?: () => void;
        toggleDownloadPanel?: () => void;
        updateDownloadBadge?: (numItems: number) => void;

        // Details view management functions
        openDetailsView?: (asset?: Asset, loadMetadata?: boolean) => void;
        closeDetailsView?: () => void;

        // Authentication
        user?: unknown; // Global user object for authentication
    }
}
