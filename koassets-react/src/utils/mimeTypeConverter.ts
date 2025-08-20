/**
 * Converts MIME types to file extensions
 * @param mimeType - The MIME type string (e.g., "video/mp4", "image/jpeg")
 * @returns The file extension without the dot (e.g., "mp4", "jpg") or null if unknown
 */
export function mimeTypeToExtension(mimeType: string): string | null {
    // Handle empty or invalid input
    if (!mimeType || typeof mimeType !== 'string') {
        return null;
    }

    // Convert to lowercase for consistent matching
    const normalizedMimeType = mimeType.toLowerCase().trim();

    // MIME type to extension mapping
    const mimeToExtensionMap: Record<string, string> = {
        // Video formats
        'video/mp4': 'mp4',
        'video/mpeg': 'mpeg',
        'video/quicktime': 'mov',
        'video/x-msvideo': 'avi',
        'video/x-ms-wmv': 'wmv',
        'video/webm': 'webm',
        'video/ogg': 'ogv',
        'video/3gpp': '3gp',
        'video/x-flv': 'flv',
        'video/x-matroska': 'mkv',

        // Image formats
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'image/tiff': 'tiff',
        'image/x-icon': 'ico',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/avif': 'avif',

        // Audio formats
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/aac': 'aac',
        'audio/flac': 'flac',
        'audio/x-ms-wma': 'wma',
        'audio/amr': 'amr',
        'audio/3gpp': '3ga',

        // Document formats
        'application/pdf': 'pdf',
        'text/plain': 'txt',
        'text/html': 'html',
        'text/css': 'css',
        'text/javascript': 'js',
        'application/json': 'json',
        'application/xml': 'xml',
        'text/xml': 'xml',
        'application/rtf': 'rtf',

        // Microsoft Office formats
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',

        // Archive formats
        'application/zip': 'zip',
        'application/x-rar-compressed': 'rar',
        'application/x-tar': 'tar',
        'application/gzip': 'gz',
        'application/x-7z-compressed': '7z',

        // Adobe formats
        'application/vnd.adobe.photoshop': 'psd',
        'application/postscript': 'ai',
        'application/vnd.adobe.illustrator': 'ai',
        'application/vnd.adobe.indesign': 'indd',

        // Other common formats
        'application/octet-stream': 'bin',
        'text/csv': 'csv',
        'application/vnd.google-earth.kml+xml': 'kml',
        'application/vnd.google-earth.kmz': 'kmz',
    };

    // Direct lookup
    if (mimeToExtensionMap[normalizedMimeType]) {
        return mimeToExtensionMap[normalizedMimeType];
    }

    // Handle generic patterns for unknown specific types
    if (normalizedMimeType.startsWith('video/')) {
        // Extract extension from video MIME types like "video/x-custom-format"
        const parts = normalizedMimeType.split('/');
        if (parts.length === 2) {
            let extension = parts[1];
            // Remove common prefixes
            extension = extension.replace(/^x-/, '');
            extension = extension.replace(/^vnd\./, '');
            return extension;
        }
    }

    if (normalizedMimeType.startsWith('image/')) {
        // Extract extension from image MIME types
        const parts = normalizedMimeType.split('/');
        if (parts.length === 2) {
            let extension = parts[1];
            extension = extension.replace(/^x-/, '');
            extension = extension.replace(/^vnd\./, '');
            return extension;
        }
    }

    if (normalizedMimeType.startsWith('audio/')) {
        // Extract extension from audio MIME types
        const parts = normalizedMimeType.split('/');
        if (parts.length === 2) {
            let extension = parts[1];
            extension = extension.replace(/^x-/, '');
            extension = extension.replace(/^vnd\./, '');
            return extension;
        }
    }

    // Return null for unknown MIME types
    return null;
}

/**
 * Converts MIME type to extension with dot prefix
 * @param mimeType - The MIME type string
 * @returns The file extension with dot (e.g., ".mp4", ".jpg") or null if unknown
 */
export function mimeTypeToExtensionWithDot(mimeType: string): string | null {
    const extension = mimeTypeToExtension(mimeType);
    return extension ? `.${extension}` : null;
}

/**
 * Gets the media category from a MIME type
 * @param mimeType - The MIME type string
 * @returns The media category ("video", "image", "audio", "document", "other")
 */
export function getMimeTypeCategory(mimeType: string): string {
    if (!mimeType || typeof mimeType !== 'string') {
        return 'other';
    }

    const normalizedMimeType = mimeType.toLowerCase().trim();

    if (normalizedMimeType.startsWith('video/')) {
        return 'video';
    }
    if (normalizedMimeType.startsWith('image/')) {
        return 'image';
    }
    if (normalizedMimeType.startsWith('audio/')) {
        return 'audio';
    }
    if (normalizedMimeType.startsWith('text/') || 
        normalizedMimeType.startsWith('application/pdf') ||
        normalizedMimeType.includes('document') ||
        normalizedMimeType.includes('office') ||
        normalizedMimeType.includes('sheet') ||
        normalizedMimeType.includes('presentation')) {
        return 'document';
    }

    return 'other';
}

/**
 * Checks if a MIME type represents a supported media format
 * @param mimeType - The MIME type string
 * @returns True if the MIME type is supported, false otherwise
 */
export function isSupportedMimeType(mimeType: string): boolean {
    return mimeTypeToExtension(mimeType) !== null;
}
