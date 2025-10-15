/**
 * Image loading constants
 * Based on web.dev LCP optimization best practices:
 * https://web.dev/articles/lcp-lazy-loading
 */

/**
 * Number of images to load eagerly (above the fold) before applying lazy loading.
 * This helps optimize Largest Contentful Paint (LCP) performance.
 * 
 * Research shows that lazy loading above-the-fold images can delay LCP by 600-1200ms.
 * Adjust this number based on your typical viewport size and grid layout:
 * - Desktop (3 columns): 9 images = 3 rows
 * - Mobile (1-2 columns): 9 images = 5-9 rows
 */
export const EAGER_LOAD_IMAGE_COUNT = 6;

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

