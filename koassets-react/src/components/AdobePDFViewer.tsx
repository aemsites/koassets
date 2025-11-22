import React, { useCallback, useEffect, useRef, useState } from 'react';
import './AdobePDFViewer.css';

interface AdobePDFViewerProps {
    pdfUrl: string;
    fileName: string;
    showDownloadPDF?: boolean;
    showPrintPDF?: boolean;
    onClose?: () => void;
}

// Adobe DC View type definition
interface AdobeDCView {
    previewFile: (config: {
        content: { location: { url: string } };
        metaData: { fileName: string };
    }, viewerConfig: {
        embedMode: string;
        showDownloadPDF: boolean;
        showPrintPDF: boolean;
        showLeftHandPanel?: boolean;
    }) => void;
}

// Extended Document interface for fullscreen browser prefixes
interface DocumentWithFullscreen extends Document {
    webkitFullscreenElement?: Element;
    mozFullScreenElement?: Element;
    msFullscreenElement?: Element;
}

// Extend window type to include AdobeDC
declare global {
    interface Window {
        AdobeDC?: {
            View: new (config: { clientId: string; divId: string }) => AdobeDCView;
        };
    }
}

const AdobePDFViewer: React.FC<AdobePDFViewerProps> = ({
    pdfUrl,
    fileName,
    showDownloadPDF = false,
    showPrintPDF = false,
    onClose,
}) => {
    const [clientId, setClientId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const viewerRef = useRef<HTMLDivElement>(null);
    const adobeDCViewRef = useRef<AdobeDCView | null>(null);
    const isInFullscreen = useRef(false);
    const escapeHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

    // Track fullscreen state and refocus after exit
    useEffect(() => {
        const handleFullscreenChange = () => {
            const doc = document as DocumentWithFullscreen;
            const isFullscreen = !!(
                document.fullscreenElement ||
                doc.webkitFullscreenElement ||
                doc.mozFullScreenElement ||
                doc.msFullscreenElement
            );
            isInFullscreen.current = isFullscreen;

            // When exiting fullscreen, refocus to ensure keyboard events work
            if (!isFullscreen && viewerRef.current) {
                // Focus the viewer container to capture keyboard events
                setTimeout(() => {
                    if (viewerRef.current) {
                        viewerRef.current.focus();
                    }
                }, 100);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    // Handle ESC key to close
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onClose) {
                // If in fullscreen, let the browser handle ESC to exit fullscreen
                // Don't close the modal
                if (isInFullscreen.current) {
                    return;
                }

                // Not in fullscreen, so close the modal
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };

        escapeHandlerRef.current = handleEscape;

        // Use capture phase to intercept before parent modals
        document.addEventListener('keydown', handleEscape, true);
        return () => {
            if (escapeHandlerRef.current) {
                document.removeEventListener('keydown', escapeHandlerRef.current, true);
            }
        };
    }, [onClose]);

    // Set Adobe PDF Embed API Client ID for the worker domain
    useEffect(() => {
        setClientId('fb94816ccd554baf8d992217035ad8fc');
    }, []);

    // Initialize Adobe DC View
    const initializeAdobeViewer = useCallback(() => {
        if (!window.AdobeDC || !clientId) {
            setError('Adobe PDF viewer not available');
            setIsLoading(false);
            return;
        }

        try {
            const adobeDCView = new window.AdobeDC.View({
                clientId: clientId,
                divId: 'adobe-dc-view',
            });

            adobeDCViewRef.current = adobeDCView;

            adobeDCView.previewFile(
                {
                    content: { location: { url: pdfUrl } },
                    metaData: { fileName: fileName || 'document.pdf' },
                },
                {
                    embedMode: 'SIZED_CONTAINER',
                    showDownloadPDF: showDownloadPDF,
                    showPrintPDF: showPrintPDF,
                    showLeftHandPanel: false,
                }
            );

            setIsLoading(false);
        } catch (err) {
            console.error('Error initializing Adobe PDF viewer:', err);
            setError('Failed to initialize PDF viewer');
            setIsLoading(false);
        }
    }, [clientId, pdfUrl, fileName, showDownloadPDF, showPrintPDF]);

    // Load Adobe PDF Embed API script
    useEffect(() => {
        if (!clientId) return;

        // Check if script already exists
        const existingScript = document.querySelector('script[src="https://acrobatservices.adobe.com/view-sdk/viewer.js"]');
        
        if (existingScript) {
            // Script exists, check if Adobe DC is ready
            if (window.AdobeDC) {
                initializeAdobeViewer();
            } else {
                // Wait for it to load
                existingScript.addEventListener('load', () => {
                    initializeAdobeViewer();
                });
            }
            return;
        }

        // Create new script
        const script = document.createElement('script');
        script.src = 'https://acrobatservices.adobe.com/view-sdk/viewer.js';
        script.async = true;

        script.onload = () => {
            // Give it a moment to initialize
            setTimeout(() => {
                initializeAdobeViewer();
            }, 100);
        };

        script.onerror = () => {
            console.error('Failed to load Adobe PDF Embed API');
            setError('Failed to load PDF viewer');
            setIsLoading(false);
        };

        document.body.appendChild(script);

        return () => {
            // Don't remove script on unmount - it can be reused
        };
    }, [clientId, initializeAdobeViewer]);

    return (
        <div className="adobe-pdf-viewer-container">
            {onClose && (
                <button
                    className="adobe-pdf-close-button"
                    onClick={onClose}
                    aria-label="Close PDF viewer"
                >
                    ✕
                </button>
            )}

            {isLoading && (
                <div className="adobe-pdf-loading">
                    <div className="adobe-pdf-spinner" />
                    <p>Loading PDF...</p>
                </div>
            )}

            {error && (
                <div className="adobe-pdf-error">
                    <p>{error}</p>
                    {onClose && (
                        <button onClick={onClose} className="adobe-pdf-error-close">
                            Close
                        </button>
                    )}
                </div>
            )}

            <div
                id="adobe-dc-view"
                ref={viewerRef}
                className="adobe-pdf-viewer"
                style={{ display: isLoading || error ? 'none' : 'block' }}
                tabIndex={-1}
            />
        </div>
    );
};

export default AdobePDFViewer;

