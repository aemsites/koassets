// Asset-related types
import type { DynamicMediaClient } from '../dynamicmedia-client';

export interface AssetMetadata {
    description?: string;
    subject?: string | string[];
    [key: string]: any;
}

export interface Asset {
    assetId?: string;
    name?: string;
    alt?: string;
    url: string;
    size?: number;
    format?: string;
    mimeType?: string;
    loading?: boolean;
    error?: boolean;
    metadata?: AssetMetadata;
    path?: string;
    tags?: string[];
    creator?: string;
    [key: string]: any; // For additional Algolia hit properties
}

// Cart-related types
export interface CartItem extends Asset {
    // Additional cart-specific properties can be added here
}

// Component prop types
export interface CartIconProps {
    itemCount: number;
    onClick: () => void;
}

export interface AssetCardProps {
    image: Asset;
    handleCardClick: (image: Asset, event: React.MouseEvent) => void;
    handlePreviewClick: (image: Asset, event: React.MouseEvent) => void;
    formatFileSize: (size?: number) => string;
    getFileExtension: (filename?: string) => string;
    formatCategory: (subject?: string | string[]) => string;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    isSelected?: boolean;
    onCheckboxChange?: (id: string, checked: boolean) => void;
    dynamicMediaClient?: DynamicMediaClient | null;
    showFullDetails?: boolean;
}

// Query and filter types
export const QUERY_TYPES = {
    ASSETS: 'Assets',
    COLLECTIONS: 'Collections',
} as const;

export type QueryType = typeof QUERY_TYPES[keyof typeof QUERY_TYPES];

// Step status types for cart processing
export type StepStatus = 'init' | 'pending' | 'success' | 'failure';

export interface StepStatuses {
    cart: StepStatus;
    'request-download': StepStatus;
    'rights-check': StepStatus;
    'download': StepStatus;
}

// Phase 1 Component Types

// Query-related types
export interface QueryMessage {
    type: string;
    sender?: string;
    text: string;
}

export interface LoadingStates {
    chat?: boolean;
    [key: string]: boolean | undefined;
}

// Component prop interfaces
export interface QueryProps {
    query: QueryMessage;
}

export interface QueryListProps {
    querys: QueryMessage[];
    loading: LoadingStates;
}

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

export interface CollectionGalleryProps {
    title: string;
    collections: Collection[];
    loading: boolean;
    onSelectCollection?: (collection: Collection) => void;
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
    dynamicMediaClient?: DynamicMediaClient | null;
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
    handleAuthenticated: (userData: any) => void;
    handleSignOut: () => void;
    dynamicMediaClient?: DynamicMediaClient | null;
}

// Asset Preview types  
export interface AssetPreviewProps {
    showModal: boolean;
    selectedImage: Asset | null;
    closeModal: () => void;
    formatCategory: (subject?: string | string[]) => string;
    formatFileSize: (size?: number) => string;
    getFileExtension: (filename?: string) => string;
    handleAddToCart?: (image: Asset, event: React.MouseEvent) => void;
    handleRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    dynamicMediaClient?: DynamicMediaClient | null;
}

// Asset Details types (extends AssetPreview)
export interface AssetDetailsProps extends AssetPreviewProps {
    // No additional properties needed - dynamicMediaClient is now in base AssetPreviewProps
}

// Facet Filter types
export interface FacetCheckedState {
    [facetKey: string]: {
        [facetValue: string]: boolean;
    };
}

export interface FacetFilterProps {
    hits?: any[]; // TODO: Define proper Asset/Hit type
    selectedFacets: string[][];
    setSelectedFacets: (facets: string[][]) => void;
    search: () => void;
}

// Phase 3 Component Types

// Search/Query Result types
export interface SearchHits {
    nbHits?: number;
    [key: string]: any;
}

// Image Gallery types
export interface ImageGalleryProps {
    title: string;
    images: Asset[];
    loading: boolean;
    onAddToCart?: (image: Asset) => void;
    onRemoveFromCart?: (image: Asset) => void;
    cartItems?: CartItem[];
    dynamicMediaClient?: DynamicMediaClient | null;
    hits?: SearchResults | null;
    onToggleMobileFilter?: () => void;
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
}

// Main App types (for the most complex component)
export interface MainAppState {
    // TODO: Define comprehensive state interface
    images: Asset[];
    collections: Collection[];
    cartItems: CartItem[];
    loading: boolean;
    selectedFacets: string[][];
    // ... many more state properties
}

// Adobe Sign In types
export interface AdobeUser {
    id: string;
    name: string;
    email: string;
    [key: string]: any;
}

export interface AdobeSignInButtonProps {
    onAuthenticated: (token: string) => void;
    onSignOut: () => void;
}

// Cart Panel Assets types (complex workflow)
export type WorkflowStep = 'cart' | 'request-download' | 'rights-check' | 'download';

export interface WorkflowStepStatuses {
    cart: StepStatus;
    'request-download': StepStatus;
    'rights-check': StepStatus;
    'download': StepStatus;
}

export interface WorkflowStepIcons {
    cart: React.JSX.Element | string;
    'request-download': React.JSX.Element | string;
    'rights-check': React.JSX.Element | string;
    'download': React.JSX.Element | string;
}

export interface CartPanelAssetsProps {
    cartItems: CartItem[];
    setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
    onRemoveItem: (item: CartItem) => void;
    onApproveAssets: (items: CartItem[]) => void;
    onDownloadAssets: (items: CartItem[]) => void;
    onClose: () => void;
    dynamicMediaClient?: DynamicMediaClient | null;
}

// Extended CartItem for authorization workflow
export interface AuthorizedCartItem extends CartItem {
    authorized?: boolean;
    authorizedDate?: string;
    copyright?: any;
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
    facets: string[];
    facetFilters?: string[][];
    filters: string;
    highlightPostTag: string;
    highlightPreTag: string;
    hitsPerPage: number;
    maxValuesPerFacet?: number;
    page: number;
    query: string;
    tagFilters: string;
}

export interface AlgoliaSearchRequest {
    indexName: string;
    params: AlgoliaSearchParams;
}

export interface AlgoliaSearchQuery {
    requests: AlgoliaSearchRequest[];
}

export interface SearchResults {
    hits: Asset[];
    nbHits: number;
    [key: string]: any;
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
    onBulkAddToCart: () => void;
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