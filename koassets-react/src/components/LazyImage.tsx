import React, { useEffect, useRef, useState } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { Asset } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import './LazyImage.css';

interface LazyImageProps {
    asset: Asset;
    width?: number;
    className?: string;
    alt?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const LazyImage: React.FC<LazyImageProps> = ({
    asset,
    width = 350,
    className = '',
    alt,
    onClick
}) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    const [imageUrl, setImageUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isError, setIsError] = useState<boolean>(false);
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const imgRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to detect when image comes into view
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Stop observing once visible
                }
            },
            {
                threshold: 0.1, // Trigger when 10% of the image is visible
                rootMargin: '50px' // Start loading 50px before image is visible
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Load image when it becomes visible
    useEffect(() => {
        if (!isVisible || !dynamicMediaClient || !asset.assetId || imageUrl) {
            return;
        }

        const loadImage = async () => {
            setIsLoading(true);
            setIsError(false);

            try {
                // Use the utility function which handles caching internally
                const blobUrl = await fetchOptimizedDeliveryBlob(
                    dynamicMediaClient,
                    asset,
                    width,
                    { fallbackUrl: undefined }
                );

                if (blobUrl) {
                    setImageUrl(blobUrl);
                } else {
                    setIsError(true);
                }

            } catch (error) {
                console.error(`Failed to lazy load image ${asset.assetId}:`, error);
                setIsError(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadImage();
    }, [isVisible, dynamicMediaClient, asset, width, imageUrl]);

    // Cleanup object URL when component unmounts or imageUrl changes
    useEffect(() => {
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    return (
        <div ref={imgRef} className={`lazy-image-container ${className}`} onClick={onClick}>
            {isLoading && (
                <div className="lazy-image-placeholder loading">
                    <div className="loading-spinner"></div>
                    <span>Loading...</span>
                </div>
            )}

            {imageUrl && !isError && (
                <div className="preview-image">
                    <img
                        src={imageUrl}
                        alt={alt || asset.alt || asset.name}
                        className={`lazy-image ${isLoading && 'loading'}`}
                        onError={(e) => { (e.target as HTMLImageElement)?.parentElement?.classList.add('missing'); }}
                    />
                </div>
            )}

            {!isVisible && !isLoading && !isError && (
                <div className="lazy-image-placeholder">
                    <span>📷</span>
                </div>
            )}
        </div>
    );
};

export default LazyImage;