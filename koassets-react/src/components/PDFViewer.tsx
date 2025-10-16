import React, { useState, useEffect, useMemo } from 'react';
import type { Asset, Rendition } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { isPdfPreview } from '../constants/filetypes';
import Picture from './Picture';

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
    const [pdfFailed, setPdfFailed] = useState(false);

    // Calculate all values before any early returns with useMemo
    const isPdf = useMemo(() => isPdfPreview(selectedImage.format as string), [selectedImage.format]);

    const pdfRendition = useMemo(() => {
        if (!isPdf) return null;
        return renditions?.items
            ?.filter((item: Rendition) => isPdfPreview(item.format as string))
            ?.sort((a: Rendition, b: Rendition) => (a.size ?? 0) - (b.size ?? 0))?.[0] ?? null;
    }, [isPdf, renditions?.items]);

    const pdfUrl = useMemo(() => {
        if (!pdfRendition) return null;
        return dynamicMediaClient?.getPreviewPdfUrl(
            selectedImage.assetId as string,
            selectedImage.name as string,
            pdfRendition.name as string
        ) ?? null;
    }, [pdfRendition, dynamicMediaClient, selectedImage.assetId, selectedImage.name]);

    // Fetch HEAD of pdfUrl to validate it
    useEffect(() => {
        if (!pdfUrl) {
            return;
        }

        setPdfFailed(false);

        const validatePdfUrl = async () => {
            try {
                const response = await fetch(pdfUrl, { method: 'HEAD' });
                if (!response.ok) {
                    setPdfFailed(true);
                }
            } catch (error) {
                setPdfFailed(true);
            }
        };

        validatePdfUrl();
    }, [pdfUrl]);

    if (!isPdf || !pdfRendition) {
        return null;
    }

    // If PDF URL fetch failed or returned null/undefined, fall back to Picture
    if (!pdfUrl || pdfFailed) {
        return (
            <Picture
                key={selectedImage?.assetId}
                asset={selectedImage as Asset}
                width={1200}
                className="asset-details-main-image"
                eager={true}
                fetchPriority="high"
            />
        );
    }

    return (
        <object
            data={pdfUrl}
            width="100%"
            height="100%"
            aria-label={selectedImage.title}
        />
    );
};

export default PDFViewer; 