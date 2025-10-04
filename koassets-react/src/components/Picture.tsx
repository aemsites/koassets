import type { Asset } from '../types';
import React, { useState } from 'react';

interface PictureProps {
    asset: Asset;
    width: number;
    className?: string;
}

const Picture: React.FC<PictureProps> = ({
    asset,
    width,
    className = ''
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const name = asset?.name || '';
    const fileName = encodeURIComponent(name?.replace(/\.[^/.]+$/, '') || 'thumbnail');

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        setIsLoaded(true);
        setHasError(true);
    };

    return (
        <div className={`preview-image ${!isLoaded ? 'skeleton' : ''} ${hasError ? 'missing' : ''}`}>
            <picture>
                <source type="image/webp" srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.webp?width=${width}`} />
                <source type="image/jpg" srcSet={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${width}`} />
                <img
                    className={`${className} ${isLoaded ? 'fade-in' : ''}`}
                    loading="lazy"
                    src={`/api/adobe/assets/${asset.assetId}/as/${fileName}.jpg?width=${width}`}
                    alt={asset.alt || asset.name}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            </picture>
        </div>
    );
};

export default Picture;
