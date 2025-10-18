/**
 * Comprehensive list of image MIME types supported by the application.
 * Includes standard image formats, Adobe formats (PSD, Photoshop), and various vendor-specific types.
 * Used for type checking and validation of image assets.
 */
export const IMAGE_MIME_TYPES = [
  'application/photoshop',
  'application/psd',
  'application/x-photoshop',
  'application/x-psd',
  'image/avif',
  'image/bmp',
  'image/cgm',
  'image/g3fax',
  'image/gif',
  'image/ief',
  'image/jpeg',
  'image/ktx',
  'image/pjpeg',
  'image/png',
  'image/prs.btif',
  'image/psd',
  'image/tiff',
  'image/vnd.adobe.photoshop',
  'image/vnd.dece.graphic',
  'image/vnd.djvu',
  'image/vnd.dvb.subtitle',
  'image/vnd.dwg',
  'image/vnd.dxf',
  'image/vnd.fastbidsheet',
  'image/vnd.fpx',
  'image/vnd.fst',
  'image/vnd.fujixerox.edmics-mmr',
  'image/vnd.fujixerox.edmics-rlc',
  'image/vnd.ms-modi',
  'image/vnd.net-fpx',
  'image/vnd.wap.wbmp',
  'image/vnd.xiff',
  'image/webp',
  'image/x-citrix-jpeg',
  'image/x-citrix-png',
  'image/x-cmu-raster',
  'image/x-cmx',
  'image/x-freehand',
  'image/x-icon',
  'image/x-pcx',
  'image/x-pict',
  'image/x-png',
  'image/x-portable-anymap',
  'image/x-portable-bitmap',
  'image/x-portable-graymap',
  'image/x-portable-pixmap',
  'image/x-rgb',
  'image/x-xbitmap',
  'image/x-xpixmap',
  'image/x-xwindowdump'
];

/**
 * MIME types that can be previewed/converted as PDF.
 * Includes document formats and office document formats.
 * Used for determining if an asset can be previewed as PDF.
 */
export const DOCUMENT_PREVIEW_AS_PDF_MIME_TYPES = [
  'application/rtf',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'text/plain'
];

/**
 * Checks if a MIME type represents an image format
 * @param format - The MIME type string to check
 * @returns True if the format is an image, false otherwise
 */
export const isImage = (format: string): boolean => 
  format?.includes('image/') || IMAGE_MIME_TYPES.includes(format) || false;

/**
 * Checks if a MIME type can be previewed as PDF
 * @param format - The MIME type string to check
 * @returns True if the format can be previewed as PDF, false otherwise
 */
export const isPdfPreview = (format: string): boolean => DOCUMENT_PREVIEW_AS_PDF_MIME_TYPES.includes(format);
