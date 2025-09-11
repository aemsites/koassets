interface AuthResponse {
    accessToken: string;
    expiresIn?: number;
}

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

interface MediaRightsResponse {
    attribute: RightsAttribute[];
}

interface MarketRightsResponse {
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

interface RestOfAssetsItem {
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

export class FadelClient {
    private baseUrl: string;
    private username: string;
    private password: string;
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;

    private static instance: FadelClient | null = null;

    constructor() {
        const baseUrl = localStorage.getItem('FADEL_BASE_URL') || '';
        const username = localStorage.getItem('FADEL_USERNAME') || '';
        const password = localStorage.getItem('FADEL_PASSWORD') || '';

        if (!baseUrl || !username || !password) {
            throw new Error('Missing required Fadel configuration: FADEL_BASE_URL, FADEL_USERNAME, FADEL_PASSWORD');
        }

        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
    }

    public static getInstance(): FadelClient {
        if (!FadelClient.instance) {
            FadelClient.instance = new FadelClient();
        }
        return FadelClient.instance;
    }

    private createAuthRequestToken(): string {
        const credentials = `${this.username}:${this.password}`;
        return btoa(credentials); // Base64 encode
    }

    async authenticate(): Promise<string> {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        const authUrl = `${this.baseUrl}/rc-api/authenticate`;
        const authRequestToken = this.createAuthRequestToken();

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    authRequestToken: authRequestToken
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
            }

            const authResponse: AuthResponse = await response.json();

            if (!authResponse.accessToken) {
                throw new Error('No access token received from authentication response');
            }

            this.accessToken = authResponse.accessToken;

            // Set token expiry (default to 1 hour if not provided)
            const expiresInMs = (authResponse.expiresIn || 3600) * 1000;
            this.tokenExpiry = Date.now() + expiresInMs;

            return this.accessToken;
        } catch (error) {
            console.error('Fadel authentication error:', error);
            throw error;
        }
    }

    async getAccessToken(): Promise<string> {
        return this.authenticate();
    }

    async fetchMediaRights(): Promise<MediaRightsResponse> {
        const accessToken = await this.getAccessToken();
        const url = `${this.baseUrl}/rc-api/rights/search/20`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: ""
                })
            });

            if (!response.ok) {
                throw new Error(`Media rights fetch failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching media rights:', error);
            throw error;
        }
    }

    async fetchMarketRights(): Promise<MarketRightsResponse> {
        const accessToken = await this.getAccessToken();
        const url = `${this.baseUrl}/rc-api/rights/search/30`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': accessToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: ""
                })
            });

            if (!response.ok) {
                throw new Error(`Market rights fetch failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching market rights:', error);
            throw error;
        }
    }

    async checkRights(request: CheckRightsRequest): Promise<CheckRightsResponse> {
        const accessToken = await this.getAccessToken();
        const url = `${this.baseUrl}/rc-api/clearance/assetclearance`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': accessToken,
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

}
