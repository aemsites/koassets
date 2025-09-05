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

export class FadelClient {
    private host: string;
    private username: string;
    private password: string;
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;

    constructor() {
        const host = import.meta.env.VITE_FADEL_HOST;
        const username = import.meta.env.VITE_FADEL_USERNAME;
        const password = import.meta.env.VITE_FADEL_PASSWORD;

        if (!host || !username || !password) {
            throw new Error('Missing required environment variables: VITE_FADEL_HOST, VITE_FADEL_USERNAME, VITE_FADEL_PASSWORD');
        }

        this.host = host;
        this.username = username;
        this.password = password;
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

        const authUrl = `https://${this.host}/rc-api/authenticate`;
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
        const url = `https://${this.host}/rc-api/rights/search/20`;

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
        const url = `https://${this.host}/rc-api/rights/search/30`;

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

}
