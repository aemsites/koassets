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

    return (
        <div className={'preview-image loading-spinner'}>
            <picture>
                <source type="image/webp" srcSet={`/api/adobe/assets/${encodedId}/as/${fileName}.webp?width=${width}`} />
                <source type="image/jpg" srcSet={`/api/adobe/assets/${encodedId}/as/${fileName}.jpg?width=${width}`} />
                <img
                    className={className}
                    loading="lazy"
                    src={`/api/adobe/assets/${encodedId}/as/${fileName}.jpg?width=${width}`}
                    alt={alt || name}
                    onLoad={(e) => { (e.target as HTMLImageElement)?.parentElement?.parentElement?.classList.remove('loading-spinner'); }}
                    onError={(e) => { (e.target as HTMLImageElement)?.parentElement?.parentElement?.classList.add('missing'); }}
                />
            </picture>
        </div>
    );
};

export default Picture;
