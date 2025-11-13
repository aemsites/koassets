import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PDFModal.css';

interface PDFModalProps {
    showModal: boolean;
    pdfUrl: string;
    title: string;
    onClose: () => void;
}

const PDFModal: React.FC<PDFModalProps> = ({ showModal, pdfUrl, title, onClose }) => {
    // Handle Escape key press
    useEffect(() => {
        if (!showModal) return;

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showModal, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!showModal) return null;

    // Create portal to render modal at document.body level
    return createPortal(
        <div className="pdf-viewer-modal" onClick={handleBackdropClick}>
            <div className="pdf-modal-content">
                {/* Modal Header */}
                <div className="pdf-modal-header">
                    <h2 className="pdf-modal-title">{title}</h2>
                    <button
                        className="pdf-modal-close"
                        onClick={onClose}
                        aria-label="Close PDF viewer"
                        type="button"
                    >
                        &times;
                    </button>
                </div>

                {/* Modal Body */}
                <div className="pdf-modal-body">
                    <object
                        data={pdfUrl}
                        type="application/pdf"
                        width="100%"
                        height="100%"
                        aria-label={title}
                    >
                        <p className="pdf-error">
                            Unable to display PDF. Please download to view.
                        </p>
                    </object>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PDFModal;

