import { getBucket } from '../utils/config';

const IMS_ORG = '9075A2B154DE8AF80A4C98A7@AdobeOrg';
const CONTENT_HUB_SETTINGS = { "assetDetails": "", "assetCard": "", "facets": "", "search": "", "hydration": "", "branding": "", "customLinks": "", "generalConfig": "", "renditionConfig": "" };
const CONTENT_HUB_APP_ID = 'ContentHub';

// Extract the ID from VITE_BUCKET (format: delivery-p64403-e544653 -> 64403-544653)
const extractIdFromBucket = (bucket: string): string => {
    const match = bucket.match(/delivery-p(\d+)-e(\d+)/);
    if (!match) {
        throw new Error(`Invalid bucket format: ${bucket}. Expected format: delivery-p{number}-e{number}`);
    }
    return `${match[1]}-${match[2]}`;
};

const CONTENT_HUB_GROUP_ID = `contenthub_aem_metadata_config-${extractIdFromBucket(getBucket())}`;

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

    async getExcSettings({
        imsOrg = IMS_ORG,
        appId = CONTENT_HUB_APP_ID,
        groupId = CONTENT_HUB_GROUP_ID,
        settings = CONTENT_HUB_SETTINGS
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

    async getExcFacets({
        imsOrg = IMS_ORG,
        appId = CONTENT_HUB_APP_ID,
        groupId = CONTENT_HUB_GROUP_ID,
        settings = CONTENT_HUB_SETTINGS
    }: GetSettingsParams = {}): Promise<Record<string, unknown>> {
        const settingsData = await this.getExcSettings({ imsOrg, appId, groupId, settings });

        if (!settingsData) {
            return {};
        }

        // Extract keys from settings.facets.fields and replace ':' with '-'
        const settingsRecord = settingsData as Record<string, unknown>;
        const facetsData = settingsRecord?.facets as Record<string, unknown>;
        const facetFields = facetsData?.fields as Record<string, unknown>;

        if (facetFields) {
            const transformedFacets: Record<string, unknown> = {};
            Object.entries(facetFields).forEach(([key, value]) => {
                const transformedKey = key.replace(/:/g, '-');
                transformedFacets[transformedKey] = value;
            });
            return transformedFacets;
        }

        return {};
    }
}