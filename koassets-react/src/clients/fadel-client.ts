interface RightDetails {
    rightId: number;
    description: string;
    shortDescription: string;
    typeCode: string;
    code?: string;
    startDate?: string;
}

interface RightsAttributeOrg {
    rightsAttributeOrgId: number;
    rightsAttributeId: number;
    orgId: number;
    orgName: string;
}

export interface RightsAttribute {
    id: number;
    parentId: number;
    right: RightDetails;
    startDate?: string;
    childrenLst: RightsAttribute[];
    rightOrder: number;
    externalId?: string;
    enabled: boolean;
    system: boolean;
    orgName?: string;
    orgLst: RightsAttributeOrg[];
}

export enum AuthorizationStatus {
    AVAILABLE = 'available',
    NOT_AVAILABLE = 'not_available',
    AVAILABLE_EXCEPT = 'available_except'
}

export interface MediaRightsResponse {
    attribute: RightsAttribute[];
}

export interface MarketRightsResponse {
    attribute: RightsAttribute[];
}

export interface CheckRightsRequest {
    inDate: number; // epoch time (air date)
    outDate: number; // epoch time (pull date)
    selectedExternalAssets: string[]; // array of asset IDs
    selectedRights: {
        "20": number[]; // array of media rights IDs
        "30": number[]; // array of market rights IDs
    };
}

interface AssetOrganization {
    assetOrgId: number;
    orgId: number;
    orgName: string;
}

interface Asset {
    assetId: number;
    name: string;
    assetExtId: string;
    assetOrganizations: {
        [orgId: string]: AssetOrganization;
    };
}

export interface RestOfAssetsItem {
    asset: Asset;
    typeCode: string;
    typeName: string;
    available: boolean;
    notAvailable: boolean;
    availableExcept: boolean;
    availableCount: number;
    notAvailableCount: number;
    allSelectionCount: number;
    notAvailableAnswerListUri: string;
    thumbnailUri: string;
}

export interface CheckRightsResponse {
    status: number;
    restOfAssets: RestOfAssetsItem[];
    totalRecords: number;
}

export interface Agreement {
    assetRightExtId?: string; // The agreement number from FADEL API
    assetRightId?: number;
    dealId?: number;
    agreementId?: number;
    agreementNumber?: string;
    number?: string;
    id?: string;
    [key: string]: unknown; // Allow for additional properties
}

export interface AgreementDetail {
    agreementNumber?: string;
    description?: string; // The rights profile description from FADEL
    rightsProfileTitle?: string; // Alias for description
    dealId?: number;
    dealType?: string;
    status?: string;
    [key: string]: unknown; // Allow for additional properties
}

// Utility function to create a map of externalId to right.description from MarketRightsResponse
export function createMarketRightsMap(marketRightsResponse: MarketRightsResponse): Record<string, string> {
    const marketRightsMap: Record<string, string> = {};

    const traverseRightsAttribute = (rightsAttribute: RightsAttribute) => {
        // If this item has an externalId, add it to the map
        if (rightsAttribute.externalId) {
            marketRightsMap[rightsAttribute.externalId] = rightsAttribute.right.description;
        }

        // Recursively traverse childrenLst
        rightsAttribute.childrenLst.forEach(child => {
            traverseRightsAttribute(child);
        });
    };

    // Traverse all attributes in the response
    marketRightsResponse.attribute.forEach(attr => {
        traverseRightsAttribute(attr);
    });

    return marketRightsMap;
}

// Utility function to create a map of externalId to right.description from MediaRightsResponse
export function createMediaRightsMap(mediaRightsResponse: MediaRightsResponse): Record<string, string> {
    const mediaRightsMap: Record<string, string> = {};

    const traverseRightsAttribute = (rightsAttribute: RightsAttribute) => {
        // If this item has an externalId, add it to the map
        if (rightsAttribute.externalId) {
            mediaRightsMap[rightsAttribute.externalId] = rightsAttribute.right.description;
        }

        // Recursively traverse childrenLst
        rightsAttribute.childrenLst.forEach(child => {
            traverseRightsAttribute(child);
        });
    };

    // Traverse all attributes in the response
    mediaRightsResponse.attribute.forEach(attr => {
        traverseRightsAttribute(attr);
    });

    return mediaRightsMap;
}

export class FadelClient {
    private static baseUrl: string = `${window.location.origin}/api/fadel`;
    private static instance: FadelClient | null = null;

    constructor() {
    }

    public static getInstance(): FadelClient {
        if (!FadelClient.instance) {
            FadelClient.instance = new FadelClient();
        }
        return FadelClient.instance;
    }


    async fetchMediaRights(): Promise<MediaRightsResponse> {
        // Check if data exists in localStorage
        const cachedData = localStorage.getItem('fadel-media-rights');
        if (cachedData) {
            try {
                return JSON.parse(cachedData);
            } catch (error) {
                console.warn('Failed to parse cached media rights data:', error);
                // Continue to fetch fresh data
            }
        }

        const url = `${FadelClient.baseUrl}/rc-api/rights/search/20`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: ""
                })
            });

            if (!response.ok) {
                throw new Error(`Media rights fetch failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Store response in localStorage
            try {
                localStorage.setItem('fadel-media-rights', JSON.stringify(data));
            } catch (error) {
                console.warn('Failed to cache media rights data:', error);
            }

            return data;
        } catch (error) {
            console.error('Error fetching media rights:', error);
            throw error;
        }
    }

    async fetchMarketRights(): Promise<MarketRightsResponse> {
        // Check if data exists in localStorage
        const cachedData = localStorage.getItem('fadel-market-rights');
        if (cachedData) {
            try {
                return JSON.parse(cachedData);
            } catch (error) {
                console.warn('Failed to parse cached market rights data:', error);
                // Continue to fetch fresh data
            }
        }

        const url = `${FadelClient.baseUrl}/rc-api/rights/search/30`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: ""
                })
            });

            if (!response.ok) {
                throw new Error(`Market rights fetch failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Store response in localStorage
            try {
                localStorage.setItem('fadel-market-rights', JSON.stringify(data));
            } catch (error) {
                console.warn('Failed to cache market rights data:', error);
            }

            return data;
        } catch (error) {
            console.error('Error fetching market rights:', error);
            throw error;
        }
    }

    async checkRights(request: CheckRightsRequest): Promise<CheckRightsResponse> {
        const url = `${FadelClient.baseUrl}/rc-api/clearance/assetclearance`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Rights check failed: ${response.status} ${response.statusText}`);
            }

            // Handle 204 No Content response
            if (response.status === 204) {
                return {
                    status: 204,
                    restOfAssets: [],
                    totalRecords: 0
                };
            }

            // Parse JSON response with proper typing
            const data = await response.json();
            return {
                status: response.status,
                ...data
            };
        } catch (error) {
            console.error('Error checking rights:', error);
            throw error;
        }
    }

    /**
     * Get asset data with rights from FADEL API and extract unique agreements
     * @param assetId - Asset UUID (without prefix)
     * @returns Array of unique agreements
     */
    private async getAssetAgreementList(assetId: string): Promise<Agreement[]> {
        const url = `${FadelClient.baseUrl}/rc-api/assets/externalassets/${assetId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Asset data fetch failed: ${response.status} ${response.statusText}`);
        }

        if (response.status === 204) {
            return [];
        }

        const data = await response.json();

        if (!data?.assetRightLst || !Array.isArray(data.assetRightLst)) {
            return [];
        }

        // Extract unique agreement numbers from rights list
        const agreements: Agreement[] = [];
        const seen = new Set<string>();

        for (const right of data.assetRightLst) {
            const agreementNumber = right.assetRightExtId;
            if (agreementNumber && !seen.has(agreementNumber)) {
                seen.add(agreementNumber);
                agreements.push({ agreementNumber, assetRightExtId: agreementNumber, ...right });
            }
        }

        return agreements;
    }

    /**
     * Get agreement details by agreement number
     * @param agreementNumber - Agreement number
     * @returns Agreement details including rights profile information
     */
    private async getAgreementDetails(agreementNumber: string): Promise<AgreementDetail | null> {
        const url = `${FadelClient.baseUrl}/rc-api/agreements/number/${agreementNumber}?loadAttachmentFile=false&loadAttachments=false`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Agreement details fetch failed: ${response.status} ${response.statusText}`);
        }

        return response.status === 204 ? null : response.json();
    }

    /**
     * Strip the 'urn:aaid:aem:' prefix from asset IDs
     * @param assetId - Full asset ID (e.g., 'urn:aaid:aem:473286fc-9298-488b-8c74-8df071739149')
     * @returns Stripped UUID (e.g., '473286fc-9298-488b-8c74-8df071739149')
     */
    private stripAssetIdPrefix(assetId: string): string {
        if (!assetId) return '';
        return assetId.replace('urn:aaid:aem:', '');
    }

    /**
     * Get rights profile data for an asset
     * Fetches asset agreements and their details in parallel
     * @param assetId - Asset ID (can include 'urn:aaid:aem:' prefix)
     * @returns Array of agreement details with rights profile information
     */
    async getAssetRightsProfile(assetId: string): Promise<AgreementDetail[]> {
        try {
            const strippedAssetId = this.stripAssetIdPrefix(assetId);
            const agreements = await this.getAssetAgreementList(strippedAssetId);

            if (!agreements.length) {
                return [];
            }

            // Fetch all agreement details in parallel
            const detailsPromises = agreements
                .map(agreement => agreement.assetRightExtId)
                .filter((num): num is string => !!num)
                .map(num => this.getAgreementDetails(num).catch(() => null));

            const details = await Promise.all(detailsPromises);
            return details.filter((detail): detail is AgreementDetail => detail !== null);
        } catch (error) {
            console.error('Error fetching asset rights profile:', error);
            throw error;
        }
    }

}
