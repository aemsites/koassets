import React, { useEffect, useState } from 'react';
import { useAppConfig } from '../hooks/useAppConfig';
import type { Asset } from '../types';
import { fetchOptimizedDeliveryBlob } from '../utils/blobCache';
import './ThumbnailImage.css';

interface ThumbnailImageProps {
    item: Asset;
}

const ThumbnailImage: React.FC<ThumbnailImageProps> = ({ item }) => {
    // Get dynamicMediaClient from context
    const { dynamicMediaClient } = useAppConfig();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        const loadImage = async () => {
            if (!item.assetId || !dynamicMediaClient) {
                setLoading(false);
                setError(true);
                return;
            }

            try {
                // Use the utility function with caching for 350px cart images
                const blobUrl = await fetchOptimizedDeliveryBlob(
                    dynamicMediaClient,
                    item,
                    350,
                    {
                        cache: false,
                        cacheKey: `${item.assetId}-350`,
                        fallbackUrl: item.url
                    }
                );

                if (blobUrl) {
                    setImageUrl(blobUrl);
                    console.log(`Loaded cart image: ${item.assetId}`);
                } else {
                    setError(true);
                }
            } catch (error) {
                console.error(`Failed to load cart image ${item.assetId}:`, error);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        loadImage();
    }, [item, item.assetId, item.url, dynamicMediaClient]);

    // Separate effect for cleanup
    useEffect(() => {
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [imageUrl]);

    if (loading) {
        return (
            <div className="item-thumbnail">
                <div className="thumbnail-placeholder">Loading...</div>
            </div>
        );
    }

    if (error || !imageUrl) {
        return (
            <div className="item-thumbnail">
                <div className="thumbnail-placeholder">Preview not available</div>
            </div>
        );
    }

    return (
        <div className="item-thumbnail">
            <img src={imageUrl} alt={item.name || 'Asset'} />
        </div>
    );
};

export default ThumbnailImage;
