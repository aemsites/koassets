import type { Asset } from '../types';
import React from 'react';

interface PictureProps {
    asset: Asset;
    width: number;
    className?: string;
    fetchPriority?: 'auto' | 'high' | 'low';
    eager?: boolean;
    sizes?: string;  // Responsive sizes hint for browser
}

const Picture: React.FC<PictureProps> = ({
    asset,
    width,
    className = '',
    fetchPriority = 'auto',
    eager = false,
    sizes  // Default will be set based on context
}) => {
    const name = asset?.name || '';
    const fileName = encodeURIComponent(name?.replace(/\.[^/.]+$/, '') || 'thumbnail');

    // Generate responsive image sizes (1x, 2x for retina)
    // For best performance, request smaller sizes for display purposes
    const displayWidth = Math.min(width, 600);  // Cap at 600px (most use case)
    const sizes2x = Math.min(displayWidth * 2, 1200);  // 2x for retina, cap at 1200px

    // Default sizes based on typical layout if not provided
    const defaultSizes = width <= 350 
        ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 350px'  // Grid cards
        : width <= 700
        ? '(max-width: 768px) 100vw, 700px'  // List/detail view
        : '(max-width: 1200px) 100vw, 1200px';  // Full-width display

    const imageSizes = sizes || defaultSizes;

    return (
        <picture>
            <source 
                type="image/webp" 
                srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.webp?width=${displayWidth} 1x, /api/adobe/assets/${asset.assetId}/as/${fileName}.webp?width=${sizes2x} 2x`}
                sizes={imageSizes}
            />
            <source 
                type="image/jpg" 
                srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${displayWidth} 1x, /api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${sizes2x} 2x`}
                sizes={imageSizes}
            />
            <img
                key={asset.assetId}
                className={className}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={fetchPriority}
                src={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${displayWidth}`}
                alt={asset.alt || asset.name}
                width={displayWidth}
                height={Math.round(displayWidth / 1.65)}
                onError={(e) => {(e.target as HTMLImageElement).parentElement?.classList.add('missing');}}
            />
        </picture>
    );
};

export default Picture;
