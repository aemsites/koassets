// EXC Facets interfaces
export interface ExcFacetRootPath {
    label: string;
}

export interface ExcFacet {
    label: string;
    type: 'tags' | 'string' | 'date';
    displayOrder: number;
    rootPaths?: Record<string, ExcFacetRootPath>;
}

export interface ExcFacets {
    [facetId: string]: ExcFacet;
}

// Default facets configuration
export const DEFAULT_FACETS: ExcFacets = {
    "tccc-brand": {
        "label": "Brand",
        "type": "tags",
        "displayOrder": 1,
        "rootPaths": {
            "TCCC : Brand": {
                "label": "Brand"
            }
        }
    },
    "tccc-campaignName": {
        "label": "Campaign",
        "type": "string",
        "displayOrder": 2
    },
    "tccc-assetCategoryAndType": {
        "type": "tags",
        "label": "Asset Category & Asset Type Execution",
        "displayOrder": 3,
        "rootPaths": {
            "TCCC : Asset Category and Asset Type Execution": {
                "label": "Asset Category & Asset Type Execution"
            }
        }
    },
    "tccc-masterOrAdaptation": {
        "label": "Master or Adaptation",
        "type": "string",
        "displayOrder": 4
    },
    "tccc-readyToUse": {
        "label": "Rights Free",
        "type": "string",
        "displayOrder": 5
    },
    "tccc-intendedBusinessUnitOrMarket": {
        "label": "Intended Market",
        "type": "tags",
        "displayOrder": 6,
        "rootPaths": {
            "TCCC : Intended Market": {
                "label": "Intended Market"
            }
        }
    },
    "tccc-intendedChannel": {
        "label": "Intended Channel",
        "type": "string",
        "displayOrder": 7,
        "rootPaths": {
            "TCCC : Intended Channel": {
                "label": "Intended Channel"
            }
        }
    },
    "tccc-intendedBottlerCountry": {
        "label": "Bottler Content by Country",
        "type": "string",
        "displayOrder": 8
    },
    "tccc-packageContainerSize": {
        "label": "Package Size",
        "type": "string",
        "displayOrder": 9
    },
    "tccc-agencyName": {
        "label": "Agency Name",
        "type": "string",
        "displayOrder": 10
    },
    "repo-createDate": {
        "label": "Date created",
        "type": "date",
        "displayOrder": 11
    },
    "tccc-marketCovered": {
        "label": "Market Rights Covered",
        "type": "string",
        "displayOrder": 12
    },
    "tccc-mediaCovered": {
        "label": "Media Rights Covered",
        "type": "string",
        "displayOrder": 13
    }
};
