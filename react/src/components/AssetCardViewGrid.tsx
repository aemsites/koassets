import React from 'react';
import type { AssetCardProps } from '../types';
import './AssetCardViewGrid.css';
import LazyImage from './LazyImage';

const AssetCardViewGrid: React.FC<AssetCardProps> = ({
    image,
    handleCardClick,
    handlePreviewClick,
    formatFileSize,
    getFileExtension,
    formatCategory,
    handleAddToCart,
    handleRemoveFromCart,
    cartItems = [],
    isSelected = false,
    onCheckboxChange,
    dynamicMediaClient,
    showFullDetails = true
}) => {
    // Check if this item is already in the cart
    const isInCart = cartItems.some(cartItem => cartItem.id === image.id);

    // Handle button click - either add or remove from cart
    const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();

        if (isInCart) {
            handleRemoveFromCart?.(image);
        } else {
            handleAddToCart?.(image, e);
        }
    };

    // Handle checkbox change
    const handleCheckboxClick = (e: React.ChangeEvent<HTMLInputElement>) => {
        onCheckboxChange?.(image.id, e.target.checked);
    };

    // Handle checkbox click to prevent propagation
    const handleCheckboxClickOnly = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click when clicking checkbox
    };

    return (
        <div className="asset-card-view-grid">
            <div
                className="asset-card-view-grid-inner"
                onClick={(e) => handleCardClick(image, e)}
                style={{ cursor: 'pointer' }}
            >
                <div className="image-wrapper">
                    {/* Checkbox in top left corner */}
                    <input
                        type="checkbox"
                        className="asset-checkbox"
                        checked={isSelected}
                        onChange={handleCheckboxClick}
                        onClick={handleCheckboxClickOnly}
                    />

                    <button
                        className="image-preview-button"
                        onClick={(e) => handlePreviewClick(image, e)}
                        title="View larger image"
                    >
                        <svg viewBox="0 0 256.001 256.001" xmlns="http://www.w3.org/2000/svg">
                            <path d="M159.997 116a12 12 0 0 1-12 12h-20v20a12 12 0 0 1-24 0v-20h-20a12 12 0 0 1 0-24h20V84a12 12 0 0 1 24 0v20h20a12 12 0 0 1 12 12Zm72.48 116.482a12 12 0 0 1-16.971 0l-40.679-40.678a96.105 96.105 0 1 1 16.972-16.97l40.678 40.678a12 12 0 0 1 0 16.97Zm-116.48-44.486a72 72 0 1 0-72-72 72.081 72.081 0 0 0 72 72Z" />
                        </svg>
                    </button>

                    <LazyImage
                        asset={image}
                        dynamicMediaClient={dynamicMediaClient || null}
                        width={350}
                        className="image-container"
                        alt={image.alt || image.name}
                    />
                </div>

                <div className="product-info-container">
                    <div className="product-info">
                        <div className="product-title-section">
                            <h3 className="product-title">{image.name || image.alt || 'Untitled Asset'}</h3>
                            {image.metadata?.description && (
                                <p className="product-description">{image.metadata.description}</p>
                            )}
                        </div>

                        {showFullDetails && (
                            <div className="product-meta-grid">
                                <div className="product-meta-item">
                                    <span className="product-meta-label">SIZE</span>
                                    <span className="product-meta-value">{formatFileSize(image.size)}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label">TYPE</span>
                                    <span className="product-meta-value">{image.format || 'Unknown'}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label">FILE EXT</span>
                                    <span className="product-meta-value">{getFileExtension(image.name || image.mimeType)}</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label">RIGHTS FREE</span>
                                    <span className="product-meta-value">YES</span>
                                </div>
                                <div className="product-meta-item">
                                    <span className="product-meta-label">CATEGORY</span>
                                    <span className="product-meta-value">{formatCategory(image.metadata?.subject)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="product-actions">
                        <button
                            className={`add-to-cart-btn${isInCart ? ' remove-from-cart' : ''}`}
                            onClick={handleButtonClick}
                        >
                            {isInCart ? 'Remove From Cart' : 'Add To Cart'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetCardViewGrid; 