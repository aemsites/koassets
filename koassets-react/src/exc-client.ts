const IMS_ORG = '9075A2B154DE8AF80A4C98A7@AdobeOrg';
const CREATIVE_CLOUD_SETTINGS = {"assetDetails":"","assetCard":"","facets":"","search":"","hydration":"","branding":"","customLinks":"","generalConfig":"","renditionConfig":""};
const AEM_ASSETS_APP_ID = 'ContentHub';
const AEM_ASSETS_GROUP_ID = 'contenthub_aem_metadata_config-64403-544653';

// Custom error class for HTTP errors
export class HttpError extends Error {
    public readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }
}

// Get base URL directly from environment variable
const BASE_URL = import.meta.env.VITE_EXC_BASE_URL;

export interface ExcClientConfig {
    accessToken: string;
}

export interface GetSettingsParams {
    imsOrg?: string;
    appId?: string;
    groupId?: string;
    settings?: Record<string, unknown>;
}

export interface GetSettingsResponse {
    settings: Record<string, unknown> | null;
}

export class ExcClient {
    private readonly accessToken: string;

    constructor(config: ExcClientConfig) {
        this.accessToken = config.accessToken.replace(/^Bearer /, '');
    }

    private getHeaders({
        imsOrg,
        contentType = 'application/json',
        addAuthTokens = true
    }: {
        imsOrg: string;
        contentType?: string;
        addAuthTokens?: boolean;
    }): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'x-gw-ims-org-id': imsOrg,
            'x-api-key': 'exc_app'
        };

        if (addAuthTokens) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        return headers;
    }

    async getSettings({
        imsOrg = IMS_ORG,
        appId = AEM_ASSETS_APP_ID,
        groupId = AEM_ASSETS_GROUP_ID,
        settings = CREATIVE_CLOUD_SETTINGS
    }: GetSettingsParams = {}): Promise<Record<string, unknown> | null> {
        const url = `${BASE_URL}/settings/v2/action/GET/level/org`;
        const headers = this.getHeaders({ imsOrg, contentType: 'application/json', addAuthTokens: true });

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                appId,
                groupId,
                settings
            })
        });

        if (!response.ok) {
            throw new HttpError(`Failed to fetch configuration for imsOrg ${imsOrg}`, response.status);
        }

        const res = await response.json();
        return res?.settings ?? null;
    }
} 