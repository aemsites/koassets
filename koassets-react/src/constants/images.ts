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
export const EAGER_LOAD_IMAGE_COUNT = 4;

