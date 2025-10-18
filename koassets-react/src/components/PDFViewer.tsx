import React, { useState, useEffect, useMemo } from 'react';
import type { Asset, Rendition } from '../types';
import { useAppConfig } from '../hooks/useAppConfig';
import { isPdfPreview } from '../constants/filetypes';
import { AuthorizationStatus } from '../clients/fadel-client';
import './PDFViewer.css';

interface PDFViewerProps {
    selectedImage: Asset;
    renditions: {
        assetId?: string;
        items?: Rendition[];
        'repo:name'?: string;
    };
    fallbackComponent?: React.ReactNode;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ selectedImage, renditions, fallbackComponent }) => {
    const { dynamicMediaClient } = useAppConfig();
    const [pdfFailed, setPdfFailed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

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
            const maxRetries = 3;
            const baseDelay = 500; // ms
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await fetch(pdfUrl, { method: 'OPTIONS' });
                    
                    if (response.ok) {
                        return; // Success!
                    }
                    
                    
                    // Retry on 404 or 503 (not on other errors)
                    if (attempt < maxRetries && (response.status === 404 || response.status === 503)) {
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    setPdfFailed(true);
                    return;
                } catch (error) {
                    
                    if (attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    
                    setPdfFailed(true);
                    return;
                }
            }
            
            setPdfFailed(true);
        };

        validatePdfUrl();
    }, [pdfUrl]);

    // Fallback timeout for Safari - onLoad may not fire for object elements
    // This ensures spinner is hidden even if the browser doesn't fire onLoad
    useEffect(() => {
        if (!isLoading) {
            return;
        }

        const timeoutId = setTimeout(() => {
            setIsLoading(false);
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [isLoading]);

    if (!isPdf || !pdfRendition) {
        return null;
    }

    // If PDF URL fetch failed or returned null/undefined, fall back to Picture
    if (!pdfUrl || pdfFailed 
        || (selectedImage.readyToUse?.toLowerCase() !== 'yes' 
            && (selectedImage.authorized === undefined || selectedImage.authorized !== AuthorizationStatus.AVAILABLE))) {
        return fallbackComponent || null;
    }

    return (
        <div className="pdf-viewer-container">
            {isLoading && (
                <div className="pdf-spinner-overlay">
                    <div className="pdf-spinner" />
                </div>
            )}
            <object
                data={pdfUrl}
                width="100%"
                height="100%"
                aria-label={selectedImage.title}
                onLoad={() => {
                    setIsLoading(false);
                }}
            />
        </div>
    );
};

export default PDFViewer; 