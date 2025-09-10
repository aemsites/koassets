import type { Asset } from '../types';
import { formatDate, formatFileSize } from './formatters';

// Safe extraction helpers for populateAssetFromHit
function safeStringField(hit: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const value = (hit as Record<string, unknown>)[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value.toString();
    if (value && typeof value === 'object') return 'ERROR';
    return fallback;
}

function safeStringFromCandidates(hit: Record<string, unknown>, keys: string[], fallback: string = 'N/A'): string {
    let sawObject = false;
    for (const key of keys) {
        const candidate = safeStringField(hit, key, '');
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

function safeNumberField(hit: Record<string, unknown>, key: string, fallback: number = 0): number {
    const value = (hit as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : fallback;
}

function safeDateField(hit: Record<string, unknown>, key: string): string {
    const value = (hit as Record<string, unknown>)[key];
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
    hit: Record<string, unknown>,
    primaryKey: string,
    candidateKeys?: string[],
    fallback: string = 'N/A'
): string {
    const raw = (hit as Record<string, unknown>)[primaryKey] as unknown;
    if (Array.isArray(raw)) {
        return (raw as unknown[])
            .filter((v) => typeof v === 'string' && v)
            .map((v) => (v as string).split('/'))
            .map((parts) => parts[parts.length - 1].trim())
            .join(', ');
    }
    const keys = candidateKeys && candidateKeys.length > 0 ? candidateKeys : [primaryKey];
    return safeStringFromCandidates(hit, keys, fallback);
}

// Extract "last token" values from objects of the form { TCCC: { #values: [...] } }
function extractFromTcccValues(hit: Record<string, unknown>, key: string): string {
    const raw = (hit as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const tcccObj = (raw as Record<string, unknown>)['TCCC'] as Record<string, unknown> | undefined;
        const values = tcccObj && (tcccObj['#values'] as unknown);
        if (Array.isArray(values)) {
            const processed = (values as string[]).map((v) => {
                const parts = v.split(' / ');
                return parts[parts.length - 1].trim();
            });
            return processed.join(', ');
        }
        return 'ERROR';
    }
    return 'N/A';
}

// Extract last tokens from xcm keywords object: uses _tagIDs strings, splitting by '/' or ':' and joining with commas
function extractFromTcccTagIDs(hit: Record<string, unknown>, key: string, fallback: string = 'N/A'): string {
    const raw = (hit as Record<string, unknown>)[key] as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const tagIds = (raw as Record<string, unknown>)['_tagIDs'] as unknown;
        if (Array.isArray(tagIds)) {
            const tokens = (tagIds as unknown[])
                .filter((v) => typeof v === 'string' && v)
                .map((v) => {
                    const s = v as string;
                    const idx = Math.max(s.lastIndexOf('/'), s.lastIndexOf(':'));
                    return (idx >= 0 ? s.slice(idx + 1) : s).trim();
                });
            return tokens.join(', ');
        }
        return fallback;
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
        expired: safeStringField(hit, 'is_pur-expirationDate'), //TODO: missing metadata
        expirationDate: safeDateField(hit, 'pur-expirationDate'),
        fadelId: safeStringField(hit, 'tccc-fadelAssetId'),
        fadelJobId: fadelJobId,
        featuredAsset: featuredAsset,
        format: safeStringField(hit, 'dc-format'),
        formatType: safeStringField(hit, 'dc-format-type'), // "Image" or "Video" or "Other"
        formatLabel: safeStringField(hit, 'dc-format-label'),
        formatedSize: formatFileSize(safeNumberField(hit, 'size')),
        fundingBuOrMarket: fundingBuOrMarket,
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
