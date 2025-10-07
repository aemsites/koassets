import type { Asset } from '../types';
import React from 'react';

interface PictureProps {
    asset: Asset;
    width: number;
    className?: string;
    fetchPriority?: 'auto' | 'high' | 'low';
    eager?: boolean; // Controls loading strategy: true = eager (above fold), false = lazy (below fold)
}

const Picture: React.FC<PictureProps> = ({
    asset,
    width,
    className = '',
    fetchPriority = 'auto',
    eager = false // Default to lazy loading for below-the-fold images
}) => {
    const name = asset?.name || '';
    const fileName = encodeURIComponent(name?.replace(/\.[^/.]+$/, '') || 'thumbnail');

    return (
        <picture>
            <source type="image/webp" srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.webp?width=${width}`} />
            <source type="image/jpg" srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${width}`} />
            <img
                key={asset.assetId}
                className={`${className}`}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={fetchPriority}
                src={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${width}`}
                alt={asset.alt || asset.name}
                onError={(e) => {(e.target as HTMLImageElement).parentElement?.classList.add('missing');}}
            />
        </picture>
    );
};

export default Picture;
