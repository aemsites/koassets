import { getExternalParams } from './config';

/**
 * Maps facet values to user-friendly display names using external parameter mappings
 * @param facetTechId - The technical ID of the facet (e.g., 'tccc-campaignName')
 * @param facetName - The raw facet name to be mapped
 * @returns The display name if a mapping exists, otherwise the original facet name
 */
export const getDisplayName = (facetTechId: string, facetName: string): string => {
    const externalParams = getExternalParams();
    
    if (facetTechId === 'tccc-campaignName') {
        return externalParams.campaignNameValueMapping?.[facetName] || facetName;
    } else if (facetTechId === 'tccc-intendedBottlerCountry') {
        return externalParams.intendedBottlerCountryValueMapping?.[facetName] || facetName;
    } else if (facetTechId === 'tccc-packageContainerSize') {
        return externalParams.packageContainerSizeValueMapping?.[facetName] || facetName;
    } else if (facetTechId === 'tccc-agencyName') {
        return externalParams.agencyNameValueMapping?.[facetName] || facetName;
    }
    
    return facetName;
};

/**
 * Gets a display name for a specific field from asset data
 * This is a convenience function for common asset fields
 * @param fieldType - The field type (e.g., 'campaignName', 'agencyName', etc.)
 * @param value - The field value to be mapped
 * @returns The display name if a mapping exists, otherwise the original value
 */
export const getAssetFieldDisplayName = (fieldType: string, value: string): string => {
    const facetTechId = `tccc-${fieldType}`;
    return getDisplayName(facetTechId, value);
};
