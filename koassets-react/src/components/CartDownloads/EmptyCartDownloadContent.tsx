import React from 'react';
import './EmptyCartDownloadContent.css';

interface EmptyCartDownloadContentProps {
    msg: string;
}

const EmptyCartDownloadContent: React.FC<EmptyCartDownloadContentProps> = ({ msg }) => {
    return (
        <div className="empty-content-wrapper">
            <div className="empty-state">
                <div className="empty-state-message">
                    <span>{msg}</span>
                </div>
            </div>
        </div>
    );
};

export default EmptyCartDownloadContent;
