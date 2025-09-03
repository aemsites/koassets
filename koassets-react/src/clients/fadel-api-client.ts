export interface FadelApiConfig {
    baseUrl: string;
    authUrl: string;
    authToken: string; // base64(username:password)
    customerName: string;
    version: string;
    domain: string;
}

interface TokenData {
    accessToken: string;
    expiresIn: number;
}

interface RightsRequestPayload {
    typeCode: string;
    attributeRightsType: {
        description: string;
    };
}

interface RightsAttribute {
    [key: string]: unknown;
}

interface RightsResponse {
    attribute?: RightsAttribute[];
}

export class FadelApiClient {
    protected baseUrl: string;
    private authUrl: string;
    private authToken: string;
    private customerName: string;
    private version: string;
    private domain: string;
    private accessToken: string | null;
    private tokenExpiry: number | null;

    constructor(config: FadelApiConfig) {
        this.baseUrl = config.baseUrl;
        this.authUrl = config.authUrl;
        this.authToken = config.authToken; // base64(username:password)
        this.customerName = config.customerName;
        this.version = config.version;
        this.domain = config.domain;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // Generate User-Agent string (same pattern as Java)
    getUserAgent(): string {
        const transactionId = this.generateTransactionId();
        return `${this.customerName}/${this.version}/${this.domain}/${transactionId}`;
    }

    generateTransactionId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Get access token (equivalent to FadelAuthenticationService)
    async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const response = await fetch(this.authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': this.getUserAgent()
                },
                body: JSON.stringify({
                    authRequestToken: this.authToken
                })
            });

            if (!response.ok) {
                throw new Error(`Authentication failed: ${response.status}`);
            }

            const tokenData: TokenData = await response.json();

            if (tokenData.accessToken) {
                this.accessToken = tokenData.accessToken;
                this.tokenExpiry = Date.now() + (tokenData.expiresIn * 1000); // Convert to ms
                return this.accessToken;
            } else {
                throw new Error('No access token in response');
            }
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }
}

export class FadelRightsService extends FadelApiClient {

    // Get Market/Countries List (Type Code "30")
    async getMarketRights(): Promise<RightsAttribute | null> {
        const TYPE_CODE_MARKET = "30";

        const requestPayload: RightsRequestPayload = {
            typeCode: TYPE_CODE_MARKET,
            attributeRightsType: {
                description: ""
            }
        };

        return await this.getAvailableTypes(requestPayload);
    }

    // Get Media Channels List (Type Code "20") 
    async getMediaRights(): Promise<RightsAttribute | null> {
        const TYPE_CODE_MEDIA = "20";

        const requestPayload: RightsRequestPayload = {
            typeCode: TYPE_CODE_MEDIA,
            attributeRightsType: {
                description: ""
            }
        };

        return await this.getAvailableTypes(requestPayload);
    }

    // Generic method to call Fadel getAvailableTypes API
    async getAvailableTypes(requestPayload: RightsRequestPayload): Promise<RightsAttribute | null> {
        try {
            const accessToken = await this.getAccessToken();

            // You'll need to determine the exact endpoint from your Fadel API docs
            const endpoint = `${this.baseUrl}/api/rights/types`;

            const response = await fetch(endpoint, {
                method: 'POST', // or GET with query params, depends on Fadel API
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'User-Agent': this.getUserAgent()
                },
                body: JSON.stringify(requestPayload)
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.status}`);
            }

            const data: RightsResponse = await response.json();

            // Process response similar to Java code
            if (data && data.attribute && data.attribute.length > 0) {
                return data.attribute[0]; // Return first attribute object
            } else {
                console.warn('Empty attribute in Fadel response');
                return null;
            }

        } catch (error) {
            console.error('Error fetching rights data:', error);
            return null;
        }
    }
}
