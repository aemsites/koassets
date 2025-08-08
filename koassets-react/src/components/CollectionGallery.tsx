import React from 'react';
import type { Collection, CollectionGalleryProps } from '../types';
import './CollectionGallery.css';

// Display list of collections
const CollectionGallery: React.FC<CollectionGalleryProps> = ({ title, collections, loading, onSelectCollection }) => {
    const handleKeyPress = (e: React.KeyboardEvent, collection: Collection) => {
        if (e.key === 'Enter') {
            onSelectCollection?.(collection);
        }
    };

    return (
        <div className="collection-gallery">
            <h2 className="gallery-title">{title}</h2>

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>Loading collections...</p>
                </div>
            ) : collections.length === 0 ? (
                <div className="no-collections">
                    <p>No collections to display</p>
                </div>
            ) : (
                <div className="collection-grid">
                    {collections.map((collection) => (
                        <div
                            key={collection.collectionId}
                            className="collection-card clickable"
                            onClick={() => onSelectCollection?.(collection)}
                            tabIndex={0}
                            role="button"
                            onKeyPress={(e) => handleKeyPress(e, collection)}
                        >
                            <div className="collection-card-inner">
                                <div className="collection-image-container">
                                    {collection.thumbnail ? (
                                        <img
                                            src={collection.thumbnail}
                                            alt={collection.collectionMetadata.title}
                                            className="collection-image"
                                        />
                                    ) : (
                                        <div className="collection-image-placeholder">
                                            <span>No thumbnail</span>
                                        </div>
                                    )}
                                </div>
                                <div className="collection-details">
                                    <h3 className="collection-title">
                                        {collection.collectionMetadata.title}
                                    </h3>
                                    {collection.collectionMetadata.description && (
                                        <p className="collection-description">
                                            {collection.collectionMetadata.description}
                                        </p>
                                    )}
                                    <p className="collection-id">ID: {collection.collectionId}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CollectionGallery; 