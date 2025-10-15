import React from 'react';
import type { Asset, Rendition } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { isPdfPreview } from '../constants/filetypes';

interface PDFViewerProps {
    selectedImage: Asset;
    renditions: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
}

const PDFViewer: React.FC<PDFViewerProps> = ({ selectedImage, renditions }) => {
    const { dynamicMediaClient } = useAppConfig();

    if (!isPdfPreview(selectedImage.format as string)) {
        return null;
    }

    const pdfRendition = renditions?.items
        ?.filter((item: Rendition) => isPdfPreview(item.format as string))
        ?.sort((a: Rendition, b: Rendition) => (a.size ?? 0) - (b.size ?? 0))?.[0];

    if (!pdfRendition) {
        return null;
    }

    return (
        <object
            data={dynamicMediaClient?.getPreviewPdfUrl(
                selectedImage.assetId as string,
                selectedImage.name as string,
                pdfRendition.name as string
            )}
            width="100%"
            height="100%"
            aria-label={selectedImage.title}
        />
    );
};

export default PDFViewer; 