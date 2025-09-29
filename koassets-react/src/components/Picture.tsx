import React, { useState } from 'react';
import type { Asset } from '../types';

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
    const id = asset.assetId || '';
    const encodedId = encodeURIComponent(id);
    const name = asset.name || '';
    const alt = asset.alt;

    const fileName = encodeURIComponent(name?.replace(/\.[^/.]+$/, '') || 'thumbnail');
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const handleLoad = () => {
        setIsLoading(false);
    };

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setIsLoading(false);
        const target = e.target as HTMLImageElement;
        target.parentElement?.classList.add('missing');
    };

    return (
        <div className={'preview-image'}>
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1
                }}>
                    <div className="loading-spinner"></div>
                </div>
            )}
            <picture>
                <source type="image/webp" srcSet={`/api/adobe/assets/${encodedId}/as/${fileName}.webp?width=${width}`} />
                <source type="image/jpg" srcSet={`/api/adobe/assets/${encodedId}/as/${fileName}.jpg?width=${width}`} />
                <img
                    className={className}
                    loading="lazy"
                    src={`/api/adobe/assets/${encodedId}/as/${fileName}.jpg?width=${width}`}
                    alt={alt || name}
                    onLoad={handleLoad}
                    onError={handleError}
                    style={{ opacity: isLoading ? 0.1 : 1 }}
                />
            </picture>
        </div>
    );
};

export default Picture;
