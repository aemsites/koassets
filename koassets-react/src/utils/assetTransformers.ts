import type { Asset, Metadata } from '../types';
import { formatDate, formatFileSize } from './formatters';
import { split } from './stringUtils';

// Safe extraction helpers for populateAssetFromHit
function safeStringField(dataJson: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const value = (dataJson as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value.toString();
    if (value && typeof value === 'object') return 'ERROR';
    return fallback;
}

function safeStringFromCandidates(dataJson: Record<string, unknown>, keys: string[], fallback: string = 'N/A'): string {
    let sawObject = false;
    for (const key of keys) {
        const candidate = safeStringField(dataJson, key, '');
        if (candidate === 'ERROR') {
            sawObject = true;
            continue;
        }
        if (candidate !== '') {
            return candidate;
        }
    }
    return sawObject ? 'ERROR' : fallback;
}

function safeNumberField(dataJson: Record<string, unknown>, key: string, fallback: number = 0): number {
    const value = (dataJson as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : fallback;
}

function safeDateField(dataJson: Record<string, unknown>, key: string): string {
    const value = (dataJson as Record<string, unknown>)[key];
    if (typeof value === 'number') {
        return formatDate(value);
    }
    if (typeof value === 'string') {
        // Numeric string (epoch in seconds or ms)
        if (/^\d+$/.test(value)) {
            return formatDate(parseInt(value, 10));
        }
        // ISO-like string -> parse to ms
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) {
            return formatDate(ms);
        }
    }
    return 'N/A';
}

// Normalize fields that may be arrays: if the primary key contains an array,
// join string entries with commas; otherwise, fall back to candidate keys using safeStringFromCandidates.
function extractJoinedIfArrayElseSafe(
    dataJson: Record<string, unknown>,
    primaryKey: string,
    candidateKeys?: string[],
    fallback: string = 'N/A'
): string {
    const raw = (dataJson as Record<string, unknown>)[primaryKey] as unknown;
    if (Array.isArray(raw)) {
        return (raw as unknown[])
            .filter((v) => typeof v === 'string' && v)
            .map((v) => (v as string).split('/'))
            .map((parts) => parts[parts.length - 1].trim())
            .join(', ');
    }
    const keys = candidateKeys && candidateKeys.length > 0 ? candidateKeys : [primaryKey];
    return safeStringFromCandidates(dataJson, keys, fallback);
}

// Extract "last token" values from objects of the form { TCCC: { #values: [...] } }
function extractFromTcccValues(dataJson: Record<string, unknown>, key: string): string {
    const raw = (dataJson as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const tcccObj = (raw as Record<string, unknown>)['TCCC'] as Record<string, unknown> | undefined;
        const values = tcccObj && (tcccObj['#values'] as unknown);
        if (Array.isArray(values)) {
            return values.join(', ');
        }
        return 'ERROR';
    }
    return 'N/A';
}

// Extract last tokens from xcm keywords object: uses _tagIDs strings, splitting by '/' or ':' and joining with commas
function extractFromTcccTagIDs(dataJson: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const raw = (dataJson as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;
        const allValues: string[] = [];

        // Go through each key in the object, skip '_tagIDs'
        for (const objKey in obj) {
            if (objKey !== '_tagIDs') {
                const keyData = obj[objKey];
                if (keyData && typeof keyData === 'object' && !Array.isArray(keyData)) {
                    const keyObj = keyData as Record<string, unknown>;
                    const values = keyObj['#values'];

                    if (Array.isArray(values)) {
                        allValues.push(...(values as string[]));
                    } else if (typeof values === 'string') {
                        allValues.push(values);
                    }
                }
            }
        }

        return allValues.length > 0 ? allValues.join(', ') : fallback;
    }
    return fallback;
}

/**
 * Transforms a search hit record into an Asset object
 * @param hit - The raw hit data from search results
 * @returns Asset object with populated properties
 */
export function populateAssetFromHit(hit: Record<string, unknown>): Asset {
    const name = safeStringFromCandidates(hit, ['tccc-fileName', 'repo-name']);
    const category = extractFromTcccValues(hit, 'tccc-assetCategoryAndType') || 'N/A';
    const marketCovered = extractFromTcccValues(hit, 'tccc-marketCovered') || 'N/A';
    const language = extractJoinedIfArrayElseSafe(hit, 'tccc-language');
    const longRangePlan = extractJoinedIfArrayElseSafe(hit, 'tccc-longRangePlan');
    const longRangePlanTactic = extractJoinedIfArrayElseSafe(hit, 'tccc-longRangePlanTactic');
    const campaignReach = extractJoinedIfArrayElseSafe(hit, 'tccc-campaignReach');
    const ageDemographic = extractJoinedIfArrayElseSafe(hit, 'tccc-ageDemographic');
    const brand = extractFromTcccValues(hit, 'tccc-brand') || 'N/A';
    const subBrand = extractJoinedIfArrayElseSafe(hit, 'tccc-subBrand');
    const beverageType = extractJoinedIfArrayElseSafe(hit, 'tccc-beverageType');
    const packageOrContainerType = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerType');
    const packageOrContainerMaterial = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerMaterial');
    const packageOrContainerSize = extractJoinedIfArrayElseSafe(hit, 'tccc-packageContainerSize');
    const secondaryPackaging = extractJoinedIfArrayElseSafe(hit, 'tccc-secondaryPackaging');

    // Intended Use fields
    const intendedBottlerCountry = extractJoinedIfArrayElseSafe(hit, 'tccc-intendedBottlerCountry');
    const intendedCustomers = extractJoinedIfArrayElseSafe(hit, 'tccc-intendedCustomers');
    const intendedChannel = extractFromTcccValues(hit, 'tccc-intendedChannel');

    // Scheduled (de)activation
    const onTime = safeDateField(hit, 'tccc-onTime'); //TODO: missing metadata
    const offTime = safeDateField(hit, 'tccc-offTime'); //TODO: missing metadata

    // Technical info
    const imageHeight = safeStringField(hit, 'tiff-ImageHeight'); //TODO: missing metadata
    const imageWidth = safeStringField(hit, 'tiff-ImageWidth');
    const duration = safeStringField(hit, 'tccc-videoDuration');
    const broadcastFormat = safeStringField(hit, 'tccc-videoBitRate');
    const titling = safeStringField(hit, 'tccc-titling');
    const ratio = safeStringField(hit, 'tccc-ratio');
    const orientation = safeStringField(hit, 'tiff-Orientation');

    // System Info Legacy
    const legacyAssetId1 = safeStringField(hit, 'tccc-legacyId1'); //TODO: missing metadata
    const legacyAssetId2 = safeStringField(hit, 'tccc-legacyId2');
    const legacyFileName = safeStringField(hit, 'tccc-legacyFileName');
    const sourceUploadDate = safeDateField(hit, 'tccc-sourceUploadDate'); //TODO: missing metadata
    const sourceUploader = safeStringField(hit, 'tccc-sourceUploader');
    const jobId = safeStringField(hit, 'tccc-jobID'); //TODO: missing metadata
    const projectId = safeStringField(hit, 'tccc-projectID');
    const legacySourceSystem = safeStringField(hit, 'tccc-legacySourceSystem');
    const intendedBusinessUnitOrMarket = extractFromTcccTagIDs(hit, 'tccc-intendedBusinessUnitOrMarket');

    // Production
    const leadOperatingUnit = extractJoinedIfArrayElseSafe(hit, 'tccc-leadOU');
    const tcccContact = safeStringField(hit, 'tccc-contact'); //TODO: missing metadata
    const tcccLeadAssociateLegacy = safeStringField(hit, 'tccc-leadAssociate');
    const fadelJobId = safeStringField(hit, 'tccc-fadelJobId'); //TODO: missing metadata

    // Legacy Fields (additional)
    const originalCreateDate = safeDateField(hit, 'repo-createDate');
    const dateUploaded = safeDateField(hit, 'tccc-dateUploaded'); //TODO: missing metadata
    const underEmbargo = safeStringField(hit, 'tccc-underEmbargo');
    const associatedWBrand = safeStringField(hit, 'tccc-associatedWBrand');
    const packageDepicted = safeStringField(hit, 'tccc-packageDepicted');
    const fundingBuOrMarket = extractJoinedIfArrayElseSafe(hit, 'tccc-fundingBU');
    const trackName = safeStringField(hit, 'tccc-trackName');
    const brandsWAssetGuideline = safeStringField(hit, 'tccc-brandsWAssetGuideline');
    const brandsWAssetHero = extractJoinedIfArrayElseSafe(hit, 'tccc-brandsWAssetHero');
    const campaignsWKeyAssets = extractJoinedIfArrayElseSafe(hit, 'tccc-campaignsWKeyAssets');
    const featuredAsset = safeStringField(hit, 'tccc-featuredAsset');
    const keyAsset = safeStringField(hit, 'tccc-keyAsset');
    const layout = safeStringField(hit, 'tccc-layout'); //TODO: missing metadata
    const contractAssetJobs = extractJoinedIfArrayElseSafe(hit, 'tccc-contractAssetJobs');

    return {
        agencyName: safeStringField(hit, 'tccc-agencyName'),
        ageDemographic: ageDemographic,
        alt: safeStringFromCandidates(hit, ['dc-title', 'repo-name']),
        assetAssociatedWithBrand: associatedWBrand,
        assetId: safeStringField(hit, 'assetId'),
        assetStatus: safeStringField(hit, 'tccc-assetStatus'),
        beverageType: beverageType,
        brand: brand,
        brandsWAssetGuideline: brandsWAssetGuideline,
        brandsWAssetHero: brandsWAssetHero,
        broadcastFormat: broadcastFormat,
        businessAffairsManager: safeStringField(hit, 'tccc-businessAffairsManager'),
        campaignActivationRemark: extractJoinedIfArrayElseSafe(hit, 'tccc-campaignActivationRemark'),
        campaignName: safeStringField(hit, 'tccc-campaignName'),
        campaignReach: campaignReach,
        campaignSubActivationRemark: extractJoinedIfArrayElseSafe(hit, 'tccc-campaignSubActivationRemark', ['tccc-campaignSubActivationRemark']),
        campaignsWKeyAssets: campaignsWKeyAssets,
        category: category,
        contractAssetJobs: contractAssetJobs,
        createBy: safeStringField(hit, 'repo-createdBy'),
        createDate: safeDateField(hit, 'repo-createDate'),
        dateUploaded: dateUploaded,
        description: safeStringFromCandidates(hit, ['tccc-description', 'dc-description']),
        derivedAssets: safeStringField(hit, 'tccc-derivedAssets'), //TODO: missing metadata
        duration: duration,
        experienceId: safeStringField(hit, 'tccc-campaignExperienceID'),
        expired: safeStringField(hit, 'is_pur-expirationDate'),
        expirationDate: safeDateField(hit, 'pur-expirationDate'),
        fadelId: safeStringField(hit, 'tccc-fadelAssetId'),
        fadelJobId: fadelJobId,
        featuredAsset: featuredAsset,
        format: safeStringField(hit, 'dc-format'),
        formatType: safeStringField(hit, 'dc-format-type'), // "Image" or "Video" or "Other"
        formatLabel: safeStringField(hit, 'dc-format-label'),
        formatedSize: formatFileSize(safeNumberField(hit, 'size')),
        fundingBuOrMarket: fundingBuOrMarket,
        illustratorType: safeStringField(hit, 'illustrator-Type'),
        imageHeight: imageHeight,
        imageWidth: imageWidth,
        intendedBottlerCountry: intendedBottlerCountry,
        intendedBusinessUnitOrMarket: intendedBusinessUnitOrMarket,
        intendedChannel: intendedChannel,
        intendedCustomers: intendedCustomers,
        japaneseDescription: safeStringFromCandidates(hit, ['tccc-description.ja'], 'N/A'),
        japaneseKeywords: extractJoinedIfArrayElseSafe(hit, 'tccc-keywords_ja'),
        japaneseTitle: safeStringFromCandidates(hit, ['dc-title_ja'], 'N/A'),
        jobId: jobId,
        keyAsset: keyAsset,
        keywords: extractJoinedIfArrayElseSafe(hit, 'tccc-keywords'),
        language: language,
        lastModified: safeDateField(hit, 'tccc-lastModified'),
        layout: layout,
        leadOperatingUnit: leadOperatingUnit,
        legacyAssetId1: legacyAssetId1,
        legacyAssetId2: legacyAssetId2,
        legacyFileName: legacyFileName,
        legacySourceSystem: legacySourceSystem,
        longRangePlan: longRangePlan,
        longRangePlanTactic: longRangePlanTactic,
        marketCovered: marketCovered,
        masterOrAdaptation: safeStringField(hit, 'tccc-masterOrAdaptation'),
        media: extractJoinedIfArrayElseSafe(hit, 'tccc-mediaCovered'),
        migrationId: safeStringField(hit, 'tccc-migrationID'),
        modifyBy: safeStringField(hit, 'tccc-lastModifiedBy'),
        modifyDate: safeDateField(hit, 'repo-modifyDate'),
        name: name,
        offTime: offTime,
        onTime: onTime,
        orientation: orientation,
        originalCreateDate: originalCreateDate,
        otherAssets: safeStringField(hit, 'tccc-otherAssets'), //TODO: missing metadata
        packageDepicted: packageDepicted,
        packageOrContainerMaterial: packageOrContainerMaterial,
        packageOrContainerSize: packageOrContainerSize,
        packageOrContainerType: packageOrContainerType,
        projectId: projectId,
        publishBy: safeStringField(hit, 'tccc-publishBy'), //TODO: missing metadata
        publishDate: safeDateField(hit, 'tccc-publishDate'), //TODO: missing metadata
        publishStatus: safeStringField(hit, 'tccc-publishStatus'), //TODO: missing metadata
        ratio: ratio,
        resolution: safeStringField(hit, 'tccc-resolution'), //TODO: missing metadata
        rightsEndDate: safeDateField(hit, 'tccc-rightsEndDate'),
        readyToUse: safeStringField(hit, 'tccc-readyToUse'),
        rightsNotes: safeStringField(hit, 'tccc-rightsNotes'), //TODO: missing metadata
        rightsProfileTitle: safeStringField(hit, 'tccc-rightsProfileTitle'),
        rightsStartDate: safeDateField(hit, 'tccc-rightsStartDate'),
        rightsStatus: safeStringField(hit, 'tccc-rightsStatus'),
        riskTypeManagement: safeStringField(hit, 'tccc-riskTypeMgmt'), // TODO: what's default value?
        secondaryPackaging: secondaryPackaging,
        sourceAsset: safeStringField(hit, 'tccc-sourceAsset'), //TODO: missing metadata
        sourceId: safeStringField(hit, 'tccc-sourceId'), //TODO: missing metadata
        sourceUploadDate: sourceUploadDate,
        sourceUploader: sourceUploader,
        subBrand: subBrand,
        tags: safeStringFromCandidates(hit, ['tccc-tags', 'tags']), //TODO: missing metadata
        tcccContact: tcccContact,
        tcccLeadAssociateLegacy: tcccLeadAssociateLegacy,
        titling: titling,
        title: safeStringField(hit, 'dc-title'),
        trackName: trackName,
        underEmbargo: underEmbargo,
        url: '', // Loaded lazily
        usage: safeStringField(hit, 'tccc-usage'), //TODO: missing metadata
        workfrontId: safeStringField(hit, 'tccc-workfrontID'),
        xcmKeywords: extractFromTcccTagIDs(hit, 'xcm-keywords', ''),
        ...hit
    } satisfies Asset;
}

// Helper functions for populateAssetFromMetadata
function safeMetadataStringField(
    repositoryMetadata: Record<string, unknown> | undefined,
    assetMetadata: Record<string, unknown> | undefined,
    key: string,
    fallback: string = 'N/A'
): string {
    // Try assetMetadata first, then repositoryMetadata
    const assetValue = assetMetadata?.[key];
    if (typeof assetValue === 'string') return assetValue;

    const repoValue = repositoryMetadata?.[key];
    if (typeof repoValue === 'string') return repoValue;

    return fallback;
}

function safeMetadataDateField(
    repositoryMetadata: Record<string, unknown> | undefined,
    assetMetadata: Record<string, unknown> | undefined,
    key: string
): string {
    const assetValue = assetMetadata?.[key];
    const repoValue = repositoryMetadata?.[key];

    const value = assetValue || repoValue;
    if (typeof value === 'string') {
        // ISO string -> parse to ms
        const ms = Date.parse(value);
        if (!Number.isNaN(ms)) {
            return formatDate(ms);
        }
    }
    return 'N/A';
}

/**
 * Extract values from an array of objects with 'value' property, splitting each value and taking the second part
 * @param jsonArray - Array of objects with 'value' property
 * @returns Joined string of processed values
 */
export function extractFromArrayValue(dataJson: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const jsonArray = dataJson[key];
    if (!Array.isArray(jsonArray)) return fallback;

    const processed = jsonArray
        .filter(item => item && typeof item === 'object' && 'value' in item)
        .map(item => {
            const valueObj = item as { value: string; };
            const splitResult = split(valueObj.value, ':', 2);
            return splitResult.length > 1 ? splitResult[1] : valueObj.value;
        })
        .filter(value => value && value.trim());

    return processed.length > 0 ? processed.join(', ') : fallback;
}

/**
 * Transforms metadata into an Asset object
 * @param metadata - The metadata object from Dynamic Media
 * @returns Asset object with populated properties from metadata
 */
export function populateAssetFromMetadata(metadata: Metadata): Asset {
    const { repositoryMetadata, assetMetadata } = metadata;

    // Convert metadata objects to generic records for helper functions
    const repoMeta = repositoryMetadata as Record<string, unknown>;
    const assetMeta = assetMetadata as Record<string, unknown>;

    // Basic asset information (matching populateAssetFromHit pattern)
    const name = safeMetadataStringField(repoMeta, assetMeta, 'repo:name');
    const category = extractFromArrayValue(assetMeta, 'tccc:assetCategoryAndType');
    const marketCovered = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:marketCovered');
    const language = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:language');
    const longRangePlan = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:longRangePlan');
    const longRangePlanTactic = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:longRangePlanTactic');
    const campaignReach = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:campaignReach');
    const ageDemographic = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:ageDemographic');
    const brand = extractFromArrayValue(assetMeta, 'tccc:brand');
    const subBrand = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:subBrand');
    const beverageType = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:beverageType');
    const packageOrContainerType = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:packageContainerType');
    const packageOrContainerMaterial = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:packageContainerMaterial');
    const packageOrContainerSize = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:packageContainerSize');
    const secondaryPackaging = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:secondaryPackaging');

    // Intended Use fields
    const intendedBottlerCountry = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:intendedBottlerCountry');
    const intendedCustomers = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:intendedCustomers');
    const intendedChannel = extractFromArrayValue(assetMeta, 'tccc:intendedChannel');

    // Scheduled (de)activation
    const onTime = safeMetadataDateField(repoMeta, assetMeta, 'tccc:onTime');
    const offTime = safeMetadataDateField(repoMeta, assetMeta, 'tccc:offTime');

    // Technical info
    const imageHeight = safeMetadataStringField(repoMeta, assetMeta, 'tiff:ImageHeight');
    const imageWidth = safeMetadataStringField(repoMeta, assetMeta, 'tiff:ImageWidth');
    const duration = safeMetadataStringField(repoMeta, assetMeta, 'tccc:videoDuration');
    const broadcastFormat = safeMetadataStringField(repoMeta, assetMeta, 'tccc:videoBitRate');
    const titling = safeMetadataStringField(repoMeta, assetMeta, 'tccc:titling');
    const ratio = safeMetadataStringField(repoMeta, assetMeta, 'tccc:ratio');
    const orientation = safeMetadataStringField(repoMeta, assetMeta, 'tiff:Orientation');

    // System Info Legacy
    const legacyAssetId1 = safeMetadataStringField(repoMeta, assetMeta, 'tccc:legacyId1');
    const legacyAssetId2 = safeMetadataStringField(repoMeta, assetMeta, 'tccc:legacyId2');
    const legacyFileName = safeMetadataStringField(repoMeta, assetMeta, 'tccc:legacyFileName');
    const sourceUploadDate = safeMetadataDateField(repoMeta, assetMeta, 'tccc:sourceUploadDate');
    const sourceUploader = safeMetadataStringField(repoMeta, assetMeta, 'tccc:sourceUploader');
    const jobId = safeMetadataStringField(repoMeta, assetMeta, 'tccc:jobID');
    const projectId = safeMetadataStringField(repoMeta, assetMeta, 'tccc:projectID');
    const legacySourceSystem = safeMetadataStringField(repoMeta, assetMeta, 'tccc:legacySourceSystem');
    const intendedBusinessUnitOrMarket = extractFromArrayValue(assetMeta, 'tccc:intendedBusinessUnitOrMarket');

    // Production
    const leadOperatingUnit = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:leadOU');
    const tcccContact = safeMetadataStringField(repoMeta, assetMeta, 'tccc:contact');
    const tcccLeadAssociateLegacy = safeMetadataStringField(repoMeta, assetMeta, 'tccc:leadAssociate');
    const fadelJobId = safeMetadataStringField(repoMeta, assetMeta, 'tccc:fadelJobId');

    // Legacy Fields (additional)
    const originalCreateDate = safeMetadataDateField(repoMeta, assetMeta, 'repo:createDate');
    const dateUploaded = safeMetadataDateField(repoMeta, assetMeta, 'tccc:dateUploaded');
    const underEmbargo = safeMetadataStringField(repoMeta, assetMeta, 'tccc:underEmbargo');
    const associatedWBrand = safeMetadataStringField(repoMeta, assetMeta, 'tccc:associatedWBrand');
    const packageDepicted = safeMetadataStringField(repoMeta, assetMeta, 'tccc:packageDepicted');
    const fundingBuOrMarket = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:fundingBU');
    const trackName = safeMetadataStringField(repoMeta, assetMeta, 'tccc:trackName');
    const brandsWAssetGuideline = safeMetadataStringField(repoMeta, assetMeta, 'tccc:brandsWAssetGuideline');
    const brandsWAssetHero = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:brandsWAssetHero');
    const campaignsWKeyAssets = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:campaignsWKeyAssets');
    const featuredAsset = safeMetadataStringField(repoMeta, assetMeta, 'tccc:featuredAsset');
    const keyAsset = safeMetadataStringField(repoMeta, assetMeta, 'tccc:keyAsset');
    const layout = safeMetadataStringField(repoMeta, assetMeta, 'tccc:layout');
    const contractAssetJobs = extractJoinedIfArrayElseSafe(assetMeta, 'tccc:contractAssetJobs');

    // File size formatting
    const formatedSize = repoMeta?.['repo:size'] ? formatFileSize(repoMeta['repo:size'] as number) : 'N/A';

    // Extract keywords from xcm:keywords if available
    const xcmKeywords = extractFromArrayValue(assetMeta, 'xcm:keywords');

    return {
        agencyName: safeMetadataStringField(repoMeta, assetMeta, 'tccc:agencyName'),
        ageDemographic: ageDemographic,
        alt: safeMetadataStringField(repoMeta, assetMeta, 'dc:title') || name,
        assetAssociatedWithBrand: associatedWBrand,
        assetStatus: safeMetadataStringField(repoMeta, assetMeta, 'tccc:assetStatus'),
        beverageType: beverageType,
        brand: brand,
        brandsWAssetGuideline: brandsWAssetGuideline,
        brandsWAssetHero: brandsWAssetHero,
        broadcastFormat: broadcastFormat,
        businessAffairsManager: safeMetadataStringField(repoMeta, assetMeta, 'tccc:businessAffairsManager'),
        campaignActivationRemark: extractJoinedIfArrayElseSafe(assetMeta, 'tccc:campaignActivationRemark'),
        campaignName: safeMetadataStringField(repoMeta, assetMeta, 'tccc:campaignName'),
        campaignReach: campaignReach,
        campaignSubActivationRemark: extractJoinedIfArrayElseSafe(assetMeta, 'tccc:campaignSubActivationRemark'),
        campaignsWKeyAssets: campaignsWKeyAssets,
        category: category,
        contractAssetJobs: contractAssetJobs,
        createBy: safeMetadataStringField(repoMeta, assetMeta, 'repo:createdBy'),
        createDate: safeMetadataDateField(repoMeta, assetMeta, 'repo:createDate'),
        dateUploaded: dateUploaded,
        description: safeMetadataStringField(repoMeta, assetMeta, 'tccc:description'),
        derivedAssets: safeMetadataStringField(repoMeta, assetMeta, 'tccc:derivedAssets'),
        duration: duration,
        experienceId: safeMetadataStringField(repoMeta, assetMeta, 'tccc:campaignExperienceID'),
        expired: safeMetadataStringField(repoMeta, assetMeta, 'is_pur:expirationDate'), // NOT EXIST
        expirationDate: safeMetadataDateField(repoMeta, assetMeta, 'pur:expirationDate'),
        fadelId: safeMetadataStringField(repoMeta, assetMeta, 'tccc:fadelAssetId'),
        fadelJobId: fadelJobId,
        featuredAsset: featuredAsset,
        format: safeMetadataStringField(repoMeta, assetMeta, 'dc:format'),
        formatType: safeMetadataStringField(repoMeta, assetMeta, 'dc:format:type'),
        formatLabel: safeMetadataStringField(repoMeta, assetMeta, 'dc:format:label'),
        formatedSize: formatedSize,
        fundingBuOrMarket: fundingBuOrMarket,
        illustratorType: safeMetadataStringField(repoMeta, assetMeta, 'illustrator:Type'),
        imageHeight: imageHeight,
        imageWidth: imageWidth,
        intendedBottlerCountry: intendedBottlerCountry,
        intendedBusinessUnitOrMarket: intendedBusinessUnitOrMarket,
        intendedChannel: intendedChannel,
        intendedCustomers: intendedCustomers,
        japaneseDescription: safeMetadataStringField(repoMeta, assetMeta, 'tccc:description.ja'),
        japaneseKeywords: extractJoinedIfArrayElseSafe(assetMeta, 'tccc:keywords_ja'),
        japaneseTitle: safeMetadataStringField(repoMeta, assetMeta, 'dc:title_ja'),
        jobId: jobId,
        keyAsset: keyAsset,
        keywords: extractJoinedIfArrayElseSafe(assetMeta, 'tccc:keywords'),
        language: language,
        lastModified: safeMetadataDateField(repoMeta, assetMeta, 'tccc:lastModified'),
        layout: layout,
        leadOperatingUnit: leadOperatingUnit,
        legacyAssetId1: legacyAssetId1,
        legacyAssetId2: legacyAssetId2,
        legacyFileName: legacyFileName,
        legacySourceSystem: legacySourceSystem,
        longRangePlan: longRangePlan,
        longRangePlanTactic: longRangePlanTactic,
        marketCovered: marketCovered,
        masterOrAdaptation: safeMetadataStringField(repoMeta, assetMeta, 'tccc:masterOrAdaptation'),
        media: extractJoinedIfArrayElseSafe(assetMeta, 'tccc:mediaCovered'),
        migrationId: safeMetadataStringField(repoMeta, assetMeta, 'tccc:migrationID'),
        modifyBy: safeMetadataStringField(repoMeta, assetMeta, 'tccc:lastModifiedBy'),
        modifyDate: safeMetadataDateField(repoMeta, assetMeta, 'repo:modifyDate'),
        name: name,
        offTime: offTime,
        onTime: onTime,
        orientation: orientation,
        originalCreateDate: originalCreateDate,
        otherAssets: safeMetadataStringField(repoMeta, assetMeta, 'tccc:otherAssets'),
        packageDepicted: packageDepicted,
        packageOrContainerMaterial: packageOrContainerMaterial,
        packageOrContainerSize: packageOrContainerSize,
        packageOrContainerType: packageOrContainerType,
        projectId: projectId,
        publishBy: safeMetadataStringField(repoMeta, assetMeta, 'tccc:publishBy'),
        publishDate: safeMetadataDateField(repoMeta, assetMeta, 'tccc:publishDate'),
        publishStatus: safeMetadataStringField(repoMeta, assetMeta, 'tccc:publishStatus'),
        ratio: ratio,
        resolution: safeMetadataStringField(repoMeta, assetMeta, 'tccc:resolution'),
        rightsEndDate: safeMetadataDateField(repoMeta, assetMeta, 'tccc:rightsEndDate'),
        readyToUse: safeMetadataStringField(repoMeta, assetMeta, 'tccc:readyToUse'),
        rightsNotes: safeMetadataStringField(repoMeta, assetMeta, 'tccc:rightsNotes'),
        rightsProfileTitle: safeMetadataStringField(repoMeta, assetMeta, 'tccc:rightsProfileTitle'),
        rightsStartDate: safeMetadataDateField(repoMeta, assetMeta, 'tccc:rightsStartDate'),
        rightsStatus: safeMetadataStringField(repoMeta, assetMeta, 'tccc:rightsStatus'),
        riskTypeManagement: safeMetadataStringField(repoMeta, assetMeta, 'tccc:riskTypeMgmt'),
        secondaryPackaging: secondaryPackaging,
        sourceAsset: safeMetadataStringField(repoMeta, assetMeta, 'tccc:sourceAsset'),
        sourceId: safeMetadataStringField(repoMeta, assetMeta, 'tccc:sourceId'),
        sourceUploadDate: sourceUploadDate,
        sourceUploader: sourceUploader,
        subBrand: subBrand,
        tags: safeMetadataStringField(repoMeta, assetMeta, 'tccc:tags'),
        tcccContact: tcccContact,
        tcccLeadAssociateLegacy: tcccLeadAssociateLegacy,
        titling: titling,
        title: safeMetadataStringField(repoMeta, assetMeta, 'dc:title'),
        trackName: trackName,
        underEmbargo: underEmbargo,
        url: '', // Loaded lazily
        usage: safeMetadataStringField(repoMeta, assetMeta, 'tccc:usage'),
        workfrontId: safeMetadataStringField(repoMeta, assetMeta, 'tccc:workfrontID'),
        xcmKeywords: xcmKeywords,
        // Include all original metadata for any additional fields needed
        ...metadata
    } satisfies Asset;
}
