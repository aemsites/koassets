import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    const observerRef = useRef<IntersectionObserver | null>(null);

    // Callback ref to set up intersection observer when element is mounted
    const imgRefCallback = useCallback((node: HTMLDivElement | null) => {
        // Clean up previous observer
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (node && !isVisible) {
            // Create new observer
            observerRef.current = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setIsVisible(true);
                        observerRef.current?.disconnect();
                        observerRef.current = null;
                    }
                },
                {
                    threshold: 0.1, // Trigger when 10% of the image is visible
                    rootMargin: '50px' // Start loading 50px before image is visible
                }
            );

            observerRef.current.observe(node);
        }
    }, [isVisible]);

    // Cleanup observer on unmount
    useEffect(() => {
        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
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
        <div ref={imgRefCallback} className={`lazy-image-container ${className}`} onClick={onClick}>
            {(isLoading || !imageUrl) && (
                <div className="lazy-image-placeholder loading"
                    data-testid={`lazy-image-placeholder-loading-${isLoading}-${isVisible}-${imageUrl}`}
                >
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
        </div>
    );
};

export default LazyImage;