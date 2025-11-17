#!/usr/bin/env node

/* eslint-disable no-console, no-shadow, no-restricted-syntax, no-inner-declarations, no-underscore-dangle, no-plusplus, no-await-in-loop, no-undef, no-unused-vars, global-require, no-lonely-if, prefer-destructuring, radix, max-len, guard-for-in, no-continue, brace-style */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const { sanitizeFileName, buildFileNameWithId } = require('./sanitize-utils.js');
const { PATH_SEPARATOR, DATA_DIR } = require('./constants.js');
const { AEM_AUTHOR } = require('./da-admin-client.js');

// Help and usage information
function showHelp() {
  console.log(`
📋 AEM Content Hierarchy Extractor
==================================

DESCRIPTION:
  Extracts hierarchical content structure from AEM and downloads associated images.
  Creates a clean JSON hierarchy with all teaser images and banner images downloaded.

USAGE:
  node extract-stores-hierarchy.js [CONTENT_PATH] [OPTIONS]

  OPTIONS:
  --recursive          Automatically extract linked content stores found in clickableURLs
  --debug              Skip recursive extractions (only discover and list them)
  --input <file>       Read content paths from file (one per line, # for comments)
  --fetch-store-links  Discover all store links from default path and save to all-store-links.txt
  --store <path>       Specify content store path to use with --fetch-store-links

  NO PARAMETERS:
  Running with no parameters shows this help message.

EXAMPLES:
  # Show help
  node extract-stores-hierarchy.js
  
  # Extract default content store
  node extract-stores-hierarchy.js /content/share/us/en/all-content-stores
  
  # Extract default content store with recursive extraction
  node extract-stores-hierarchy.js /content/share/us/en/all-content-stores --recursive
  
  # Extract specific campaign
  node extract-stores-hierarchy.js /content/share/us/en/all-content-stores/global-coca-cola-uplift
  
  # Extract specific content store with recursive extraction
  node extract-stores-hierarchy.js /content/share/us/en/bottler-content-stores --recursive
  
  # Extract multiple stores from a file
  node extract-stores-hierarchy.js --input stores.txt
  
  # Extract stores from file with recursive extraction
  node extract-stores-hierarchy.js --input stores.txt --recursive
  
  # Discover and save all store links from default path (no extraction)
  node extract-stores-hierarchy.js --fetch-store-links
  
  # Discover and save all store links from a specific store
  node extract-stores-hierarchy.js --fetch-store-links --store /content/share/us/en/bottler-content-stores

OUTPUTS:
  📁 {hierarchical-dir-name}/extracted-results/
  ├── hierarchy-structure.json          # Main structured output
  ├── jcr-content.json                 # Raw JCR data from AEM
  ├── most-comprehensive-tabs.model.json # Raw Sling model data
  ├── caches/                           # Downloaded file cache (delete to force re-download)
  │   ├── jcr-content-a1b2c3d4.infinity.json  # Cached JCR content (pretty JSON)
  │   └── tabs-e5f6g7h8.model.json      # Cached Sling model files (pretty JSON)
  └── images/                           # Downloaded teaser & banner images
      ├── teaser-abc123-image1.png
      └── banner-image.png

  Note: {hierarchical-dir-name} follows this convention:
  • all-content-stores                  # For main content stores
  • *-content-stores                    # For other main content stores  
  • all-content-stores__global-coca-cola-uplift    # For child campaigns (parent__child)
  • *-content-stores__campaign-name     # For other child campaigns (parent__child)

FEATURES:
  ✅ Data-driven extraction (no hardcoded logic)
  ✅ Auto-detects content sections and hierarchy
  ✅ Automatic discovery and recursive extraction of linked content stores
  ✅ Downloads all associated images with fallback URLs
  ✅ Parallel downloads for maximum speed
  ✅ Clean key names (removes technical suffixes)
  ✅ Extracts navigation links and metadata
  ✅ Filters out duplicate text components (text/text_copy)

AUTOMATIC DISCOVERY:
  The script automatically discovers and extracts OTHER base content stores:
  
  1. Extracts the specified content path (e.g., /content/share/us/en/all-content-stores)
  2. Analyzes all linkURLs in the extracted hierarchy
  3. Identifies linkURLs pointing to DIFFERENT base content stores
     (must end with '-content-stores' and be different from current store)
  4. Recursively extracts each discovered base content store
  
  Example:
    Running: node extract-stores-hierarchy.js /content/share/us/en/all-content-stores
    
    Will extract:
    • all-content-stores/                          (main extraction - specified)
    
    May also discover and extract (if linkURLs point to them):
    • bottler-content-stores/                      (different base store)
    • regional-content-stores/                     (different base store)
    
  Note: Child campaigns (e.g., global-coca-cola-uplift) are NOT automatically
        extracted. You must manually run the script for each child campaign:
        node extract-stores-hierarchy.js /content/share/us/en/all-content-stores/global-coca-cola-uplift

REQUIREMENTS:
  - AEM authentication cookie in da.config file
  - Network access to AEM author instance
  - Write permissions to output directory

For more information, see README.md
`);
}

// Check for help flag or missing arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Function to create deterministic ID from a string (simple hash)
function createDeterministicId(input) {
  let hash = 0;
  if (input.length === 0) return '0000000000';

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = ((hash << 5) - hash) + char;
    // eslint-disable-next-line no-bitwise
    hash &= hash; // Convert to 32-bit integer
  }

  // Convert to positive number and then to base36 string
  const positiveHash = Math.abs(hash);
  return positiveHash.toString(36).padStart(10, '0').substring(0, 10);
}

// Function to strip host from URLs and remove file extensions
// Validate if a linkURL is valid (not just random text like "hh")
function isValidLinkURL(url) {
  if (!url || typeof url !== 'string') return false;

  // Must start with http://, https://, or /
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return false;
  }

  // If it starts with /, it must have more than just a few characters
  if (url.startsWith('/') && url.length < 5) {
    return false;
  }

  return true;
}

// Strip host from URL but keep extension (for backward compatibility)
function stripHostAndExtension(url) {
  if (!url) return url;

  let pathname; let search; let
    hash;

  try {
    const urlObj = new URL(url);
    pathname = urlObj.pathname;
    search = urlObj.search;
    hash = urlObj.hash;
  } catch (e) {
    // If it's not a valid URL (e.g., already a path), treat as pathname
    pathname = url;
    search = '';
    hash = '';
  }

  // Only strip file extension if the entire URL ends with an extension
  // (i.e., no query params or hash after the pathname)
  if (!search && !hash) {
    pathname = pathname.replace(/\.[^/.]+$/, '');
  }

  return pathname + search + hash;
}

// Strip host from URL but KEEP extension (for migration)
function stripHostOnly(url) {
  if (!url) return url;

  let pathname; let search; let hash;

  try {
    const urlObj = new URL(url);
    pathname = urlObj.pathname;
    search = urlObj.search;
    hash = urlObj.hash;
  } catch (e) {
    // If it's not a valid URL (e.g., already a path), treat as pathname
    pathname = url;
    search = '';
    hash = '';
  }

  return pathname + search + hash;
}

// Strip hosts from URLs within rich text/HTML content
function stripHostsFromText(text) {
  if (!text || typeof text !== 'string') return text;

  // Pattern to match href attributes with full URLs
  // Matches: href="https://domain.com/path" or href='https://domain.com/path'
  const hrefPattern = /href=["']([^"']+)["']/gi;

  return text.replace(hrefPattern, (match, url) => {
    // Only process URLs that look like full URLs (http:// or https://)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const strippedUrl = stripHostOnly(url);
      // Preserve the original quote style
      const quote = match.includes('href="') ? '"' : "'";
      return `href=${quote}${strippedUrl}${quote}`;
    }
    // Return unchanged if not a full URL
    return match;
  });
}

// Strip HTML tags from text and return plain text for use as title
function stripHtmlToText(html) {
  if (!html || typeof html !== 'string') return html;
  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Truncate to reasonable title length
  return text.length > 100 ? `${text.substring(0, 100)}...` : text;
}

// Default content path
const DEFAULT_CONTENT_PATH = '/content/share/us/en/all-content-stores';

// Parse command line arguments (path and flags)
const args = process.argv.slice(2);
const flags = {
  debug: args.includes('--debug'),
  recursive: args.includes('--recursive'),
  fetchStoreLinks: args.includes('--fetch-store-links'),
};

// Parse --store flag
const storeFlagIndex = args.indexOf('--store');
let storePathArg = null;
if (storeFlagIndex !== -1 && args[storeFlagIndex + 1]) {
  storePathArg = args[storeFlagIndex + 1];
}

// If no arguments provided, show help and exit
if (args.length === 0) {
  showHelp();
  process.exit(0);
}

// Check for --input flag
const inputFlagIndex = args.indexOf('--input');
let CONTENT_PATHS = [];

if (inputFlagIndex !== -1 && args[inputFlagIndex + 1]) {
  // Read stores from file
  const inputFile = args[inputFlagIndex + 1];
  try {
    const fileContent = fs.readFileSync(inputFile, 'utf8');
    const lines = fileContent.split('\n');
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      // Skip empty lines and comments
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        CONTENT_PATHS.push(trimmedLine);
      }
    });
    console.log(`📄 Reading stores from file: ${inputFile}`);
    console.log(`   Found ${CONTENT_PATHS.length} store(s) in file\n`);
  } catch (error) {
    console.error(`❌ Error reading input file ${inputFile}: ${error.message}`);
    process.exit(1);
  }
} else {
  // Get content path (first non-flag argument)
  const CONTENT_PATH = args.find((arg) => !arg.startsWith('--')) || DEFAULT_CONTENT_PATH;
  CONTENT_PATHS = [CONTENT_PATH];
}

// Get the first content path (for backward compatibility with existing code)
const CONTENT_PATH = CONTENT_PATHS[0];

// Load AUTHOR_AUTH_COOKIE from config file
let AUTHOR_AUTH_COOKIE;
try {
  const authConfig = fs.readFileSync(path.join(__dirname, 'da.config'), 'utf8').trim();
  const [, cookieValue] = authConfig.match(/AUTHOR_AUTH_COOKIE=(.*)/);
  AUTHOR_AUTH_COOKIE = cookieValue;
  if (!AUTHOR_AUTH_COOKIE) {
    throw new Error('AUTHOR_AUTH_COOKIE not found in da.config');
  }
} catch (error) {
  console.error(`❌ Error loading AUTHOR_AUTH_COOKIE from da.config: ${error.message}`);
  process.exit(1);
}

// Handle --fetch-store-links mode (discover and save store links, then exit)
if (flags.fetchStoreLinks) {
  (async () => {
    const { execSync } = require('child_process');

    // Use --store argument if provided, otherwise use default
    const contentPathArg = storePathArg || DEFAULT_CONTENT_PATH;

    console.log('🔍 FETCH STORE LINKS MODE');
    console.log('='.repeat(80));
    console.log(`📋 Extracting content store: ${contentPathArg}`);
    console.log('   This is required to discover all linked stores\n');

    try {
      // Extract the specified content store to get hierarchy-structure.json
      // Set environment variable to skip images in the child process
      execSync(`node "${__filename}" "${contentPathArg}"`, {
        cwd: __dirname,
        stdio: 'inherit',
        env: { ...process.env, SKIP_IMAGES: 'true' },
      });

      console.log('\n🔍 Analyzing extracted hierarchy for linked stores...');

      // Build the path to the hierarchy file based on the extracted content path
      const pathParts = contentPathArg.split('/').filter((p) => p);
      const contentName = pathParts[pathParts.length - 1];
      const parentName = pathParts[pathParts.length - 2];

      // Determine the directory name (same logic as createHierarchicalDirName)
      let dirName;
      if (contentName.endsWith('-content-stores') || contentName === 'all-content-stores') {
        dirName = contentName;
      } else if (parentName && (parentName.endsWith('-content-stores') || parentName === 'all-content-stores')) {
        dirName = `${parentName}-${contentName}`;
      } else {
        dirName = contentName;
      }

      const hierarchyFile = path.join(__dirname, DATA_DIR, dirName, 'extracted-results', 'hierarchy-structure.json');

      if (!fs.existsSync(hierarchyFile)) {
        console.error(`❌ Error: Hierarchy file not found: ${hierarchyFile}`);
        process.exit(1);
      }

      // Read and parse the hierarchy file
      const fileContent = fs.readFileSync(hierarchyFile, 'utf8');
      const hierarchyData = JSON.parse(fileContent);

      // Function to recursively extract all clickableUrl from linkSources
      function extractClickableURLs(obj, clickableURLs = new Set()) {
        if (Array.isArray(obj)) {
          obj.forEach((item) => extractClickableURLs(item, clickableURLs));
        } else if (typeof obj === 'object' && obj !== null) {
          // Extract clickableUrl from linkSources object
          if (obj.linkSources && obj.linkSources.clickableUrl) {
            // Strip .html extension if present
            const url = obj.linkSources.clickableUrl.replace(/\.html$/, '');
            clickableURLs.add(url);
          }
          Object.values(obj).forEach((value) => extractClickableURLs(value, clickableURLs));
        }
        return clickableURLs;
      }

      // Extract all clickableURLs
      const allClickableURLs = extractClickableURLs(hierarchyData);
      console.log(`📊 Found ${allClickableURLs.size} total clickableURLs`);

      // Filter to only valid AEM content store paths
      const contentStorePaths = new Set();
      allClickableURLs.forEach((clickableURL) => {
        // Skip the current content path
        if (clickableURL === DEFAULT_CONTENT_PATH) {
          return;
        }

        // Only process valid AEM content store paths
        if (clickableURL.startsWith('/content/share/us/en/')) {
          contentStorePaths.add(clickableURL);
        }
      });

      console.log(`🎯 Discovered ${contentStorePaths.size} unique linked store(s)\n`);

      // Sort paths for consistent output and add DEFAULT_CONTENT_PATH at the top
      const sortedPaths = Array.from(contentStorePaths).sort();
      const allStorePaths = [DEFAULT_CONTENT_PATH, ...sortedPaths];

      // Display all stores (including default)
      console.log('📋 All store links (including default):');
      allStorePaths.forEach((storePath, index) => {
        const label = index === 0 ? ' (default)' : '';
        console.log(`  ${index + 1}. ${storePath}${label}`);
      });

      // Save to file with header comment
      const outputFile = path.join(__dirname, 'all-store-links.txt');
      const header = '# Lines starting with # are comments and will be skipped\n# Generated by: node extract-stores-hierarchy.js --fetch-store-links\n#\n';
      const fileContent2 = `${header}${allStorePaths.join('\n')}\n`;
      fs.writeFileSync(outputFile, fileContent2);

      console.log(`\n✅ Store links saved to: ${path.relative(process.cwd(), outputFile)}`);
      console.log(`   Total stores: ${allStorePaths.length} (1 default + ${sortedPaths.length} linked)`);
      console.log('\n💡 You can now use this file with --input flag:');
      console.log('   node extract-stores-hierarchy.js --input all-store-links.txt');

      process.exit(0);
    } catch (error) {
      console.error(`\n❌ Error in fetch-store-links mode: ${error.message}`);
      process.exit(1);
    }
  })();
  // The IIFE above will exit the process, so the rest of the script won't execute
}

// File paths - Create hierarchical directory name
function createHierarchicalDirName(contentPath) {
  const pathParts = contentPath.split('/').filter((p) => p);
  const contentName = pathParts[pathParts.length - 1];
  const parentName = pathParts[pathParts.length - 2];

  // If no parent, use just the content name
  if (!parentName) {
    return contentName;
  }

  // Check if parent looks like a content store (ends with '-content-stores' or is 'all-content-stores')
  const isContentStoreParent = parentName === 'all-content-stores' || parentName.endsWith('-content-stores');

  // Check if current name looks like a main content store
  const isMainContentStore = contentName === 'all-content-stores' || contentName.endsWith('-content-stores');

  // If this is a main content store, always use just that name
  if (isMainContentStore) {
    return contentName;
  }

  // Use double underscore to show hierarchy: parent__child (for content store children)
  if (isContentStoreParent) {
    return `${parentName}-${contentName}`;
  }

  // For other cases, use just the content name
  return contentName;
}

const hierarchicalDirName = createHierarchicalDirName(CONTENT_PATH);
const OUTPUT_DIR = path.join(__dirname, DATA_DIR, hierarchicalDirName, 'extracted-results');
const CACHE_DIR = path.join(OUTPUT_DIR, 'caches');

// Helper function to get cache file path
function getCacheFilePath(url) {
  // Use MD5 hash of the full URL to ensure uniqueness
  // This prevents collisions when multiple files have the same name but different paths
  const crypto = require('crypto');
  const urlHash = crypto.createHash('md5').update(url).digest('hex');

  // Extract the original filename for readability
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  let baseFilename = pathname.split('/').pop();

  // Replace special characters with dashes
  baseFilename = baseFilename.replace(/:/g, '-');

  // Get file extension
  const ext = baseFilename.includes('.') ? baseFilename.substring(baseFilename.lastIndexOf('.')) : '';
  const nameWithoutExt = baseFilename.includes('.') ? baseFilename.substring(0, baseFilename.lastIndexOf('.')) : baseFilename;

  // Create filename: basename-hash.ext (e.g., tabs-a1b2c3d4.model.json)
  const filename = `${nameWithoutExt}-${urlHash.substring(0, 8)}${ext}`;

  return path.join(CACHE_DIR, filename);
}

// Helper function to check if cache exists
function getCachedFile(url) {
  const cachePath = getCacheFilePath(url);
  if (fs.existsSync(cachePath)) {
    console.log(`📦 Using cached: ${path.basename(url)}`);
    return fs.readFileSync(cachePath, 'utf8');
  }
  return null;
}

// Helper function to save to cache
function saveToCacheFile(url, data) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cachePath = getCacheFilePath(url);

  // Try to parse and save as pretty JSON
  try {
    const jsonData = JSON.parse(data);
    fs.writeFileSync(cachePath, JSON.stringify(jsonData, null, 2));
  } catch (e) {
    // If not JSON, save as-is
    fs.writeFileSync(cachePath, data);
  }
}

// Image URL configuration
const BASE_URL = `${CONTENT_PATH}/`;

// Dynamic paths - will be discovered at runtime
// const DISCOVERED_BASE_PATH = null;

// Function to download file from AEM
function downloadFile(url, outputPath) {
  // Check cache first
  const cached = getCachedFile(url);
  if (cached) {
    if (outputPath) {
      fs.writeFileSync(outputPath, cached);
    }
    return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (error) {
      reject(new Error(`Invalid URL: ${url} - ${error.message}`));
      return;
    }

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Cookie: AUTHOR_AUTH_COOKIE,
        'User-Agent': 'Node.js AEM Content Extractor',
      },
    };

    const req = https.request(options, (res) => {
      // Handle redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;

        // If redirect URL is relative, make it absolute
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = `https://${urlObj.hostname}${redirectUrl}`;
        }

        // Recursively follow the redirect
        downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
        return;
      }

      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const data = Buffer.concat(chunks);
          const dataStr = data.toString('utf8');

          // Check if we got an HTML login/error page instead of actual content
          const isHtmlResponse = dataStr.trim().startsWith('<!DOCTYPE')
                                 || dataStr.trim().startsWith('<html')
                                 || dataStr.trim().startsWith('<!doctype')
                                 || dataStr.includes('AEM Sign In')
                                 || dataStr.includes('j_security_check');

          if (isHtmlResponse && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.gif') || url.endsWith('.webp'))) {
            reject(new Error('Authentication required - received HTML login page instead of image'));
            return;
          }

          // Save to cache
          saveToCacheFile(url, dataStr);

          if (outputPath) {
            fs.writeFileSync(outputPath, data);
            console.log(`✅ Downloaded: ${path.basename(outputPath)} (${data.length} bytes)`);
          } else {
            console.log(`✅ Downloaded (skipped saving): ${path.basename(url)}`);
          }
          resolve(dataStr);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(30000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Function to ensure images directory exists
function ensureImagesDir() {
  const imagesDir = path.join(OUTPUT_DIR, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
    console.log(`📁 Created images directory: ${imagesDir}`);
  }
  return imagesDir;
}

// Function to validate if an image file is not corrupted
// Returns an object: { valid: true } or { valid: false, reason: 'html'|'invalid'|'error', message: string }
function isValidImageFile(filePath) {
  try {
    const stats = fs.statSync(filePath);

    // Check if file size is too small (likely corrupted or incomplete)
    if (stats.size < 100) {
      const msg = `File too small (${stats.size} bytes): ${path.basename(filePath)}`;
      console.log(`   ⚠️  ${msg}`);
      return { valid: false, reason: 'invalid', message: msg };
    }

    // Read first 20 bytes to check file signature
    const buffer = Buffer.alloc(20);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 20, 0);
    fs.closeSync(fd);

    // Check if it's an HTML error page (common when download fails)
    const bufferStr = buffer.toString('utf8', 0, 15);
    if (bufferStr.includes('<!DOCTYPE') || bufferStr.includes('<html') || bufferStr.includes('<!doctype')) {
      const msg = `HTML error page detected: ${path.basename(filePath)}`;
      console.log(`   ⚠️  ${msg}`);
      return { valid: false, reason: 'html', message: msg };
    }

    // Check for common image file signatures
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    const isWebP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    const isSVG = bufferStr.includes('<?xml') || bufferStr.includes('<svg');

    if (!isPNG && !isJPEG && !isGIF && !isWebP && !isSVG) {
      const msg = `Invalid image format (first bytes: ${buffer.toString('hex', 0, 4)}): ${path.basename(filePath)}`;
      console.log(`   ⚠️  ${msg}`);
      return { valid: false, reason: 'invalid', message: msg };
    }

    return { valid: true };
  } catch (error) {
    const msg = `Error validating file: ${error.message}`;
    console.log(`   ⚠️  ${msg}`);
    return { valid: false, reason: 'error', message: msg };
  }
}

// Function to clean up corrupted images in the images directory
function cleanupCorruptedImages() {
  const imagesDir = path.join(OUTPUT_DIR, 'images');

  // Skip if images directory doesn't exist
  if (!fs.existsSync(imagesDir)) {
    return;
  }

  console.log('\n🔍 Checking for corrupted images...');

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const files = fs.readdirSync(imagesDir);
  let corruptedCount = 0;
  const htmlFiles = [];

  files.forEach((file) => {
    const filePath = path.join(imagesDir, file);
    const ext = path.extname(file).toLowerCase();

    // Only check image files
    if (imageExtensions.includes(ext) && fs.statSync(filePath).isFile()) {
      const validationResult = isValidImageFile(filePath);
      if (!validationResult.valid) {
        if (validationResult.reason === 'html') {
          // Track HTML files separately - these are critical errors
          htmlFiles.push({ file, message: validationResult.message });
        }
        console.log(`🗑️  Deleting corrupted image: ${file}`);
        fs.unlinkSync(filePath);
        corruptedCount++;
      }
    }
  });

  if (corruptedCount > 0) {
    console.log(`✅ Cleaned up ${corruptedCount} corrupted image(s)\n`);
  } else {
    console.log('✅ No corrupted images found\n');
  }

  // If HTML files were detected, fail the script
  if (htmlFiles.length > 0) {
    console.error('\n❌ ❌ ❌  CRITICAL ERROR: HTML CONTENT DETECTED IN IMAGE FILES  ❌ ❌ ❌\n');
    console.error(`   Found ${htmlFiles.length} image file(s) containing HTML content:`);
    htmlFiles.forEach((item, index) => {
      console.error(`   ${index + 1}. ${item.file} - ${item.message}`);
    });
    console.error('\n   This indicates a download failure where the server returned an error page');
    console.error('   instead of the actual image. Please check:\n');
    console.error('   - Authentication cookie is valid');
    console.error('   - Network connectivity to AEM server');
    console.error('   - Image URLs are correct\n');
    throw new Error(`Script failed: ${htmlFiles.length} image file(s) contain HTML content instead of valid images`);
  }
}

console.log('📋 ALL ITEMS WITH IMAGE URLS');
console.log('=============================');
console.log('');

// Function to extract and process linked content stores
async function extractLinkedContentStores(hierarchyStructureFile, debug = false) {
  console.log('\n🔍 Analyzing clickableURLs for other content stores...');

  // Read and parse the hierarchy file
  let hierarchyData;
  try {
    const fileContent = fs.readFileSync(hierarchyStructureFile, 'utf8');
    hierarchyData = JSON.parse(fileContent);
  } catch (error) {
    console.log(`❌ Error reading hierarchy file: ${error.message}`);
    return;
  }

  // Function to recursively extract all clickableUrl from linkSources
  function extractClickableURLs(obj, clickableURLs = new Set()) {
    if (Array.isArray(obj)) {
      obj.forEach((item) => extractClickableURLs(item, clickableURLs));
    } else if (typeof obj === 'object' && obj !== null) {
      // Extract clickableUrl from linkSources object
      if (obj.linkSources && obj.linkSources.clickableUrl) {
        // Strip .html extension if present
        const url = obj.linkSources.clickableUrl.replace(/\.html$/, '');
        clickableURLs.add(url);
      }
      Object.values(obj).forEach((value) => extractClickableURLs(value, clickableURLs));
    }
    return clickableURLs;
  }

  // Extract all clickableURLs
  const allClickableURLs = extractClickableURLs(hierarchyData);
  console.log(`📊 Found ${allClickableURLs.size} total clickableURLs`);

  // Filter out the current content path to avoid circular extraction
  const contentStorePaths = new Set();

  allClickableURLs.forEach((clickableURL) => {
    // Skip the current content path (avoid circular extraction)
    if (clickableURL === CONTENT_PATH) {
      return;
    }

    // Only process valid AEM content store paths
    // Valid patterns: /content/share/us/en/all-content-stores/* or /content/share/us/en/bottler-content-stores/*
    if (!clickableURL.startsWith('/content/share/us/en/')) {
      console.log(`  ⏭️  Skipping non-AEM path: ${clickableURL}`);
      return;
    }

    contentStorePaths.add(clickableURL);
  });

  if (contentStorePaths.size === 0) {
    console.log('✅ No other content paths found to extract.');
    return;
  }

  console.log(`🎯 Discovered ${contentStorePaths.size} unique content path(s) to extract:`);
  Array.from(contentStorePaths).sort().forEach((path, index) => {
    console.log(`  ${index + 1}. ${path}`);
  });

  console.log('\n🚀 Starting extraction for discovered content stores...');

  // Import child_process for running the script
  const { execFileSync } = require('child_process');

  let successCount = 0;
  let failureCount = 0;
  const failedPaths = [];

  for (const contentPath of Array.from(contentStorePaths).sort()) {
    console.log(`\n📋 Extracting: ${contentPath}`);
    console.log('-'.repeat(50));

    if (debug) {
      console.log('⏭️  SKIPPED (debug mode)');
    } else {
      try {
      // Run the extraction script recursively
        // Use execFileSync instead of execSync to prevent command injection
        const output = execFileSync('node', ['extract-stores-hierarchy.js', contentPath], {
          cwd: __dirname,
          encoding: 'utf8',
          stdio: 'pipe',
        });

        console.log('✅ SUCCESS');
        // Show the last few meaningful lines (summary section)
        const lines = output.split('\n').filter((line) => line.trim());
        const lastLines = lines.slice(-8); // Show last 8 non-empty lines
        lastLines.forEach((line) => console.log(line));

        successCount++;
      } catch (error) {
        console.log('❌ FAILED');

        // Collect all available error information
        const errorParts = [];

        if (error.stdout) {
          errorParts.push(error.stdout);
        }
        if (error.stderr) {
          errorParts.push(error.stderr);
        }
        if (error.message && !error.stdout && !error.stderr) {
          errorParts.push(error.message);
        }

        const errorOutput = errorParts.join('\n');

        // Show meaningful error context - last few lines before failure
        const lines = errorOutput.split('\n').filter((line) => line.trim());
        const errorLines = lines.slice(-10); // Show last 10 non-empty lines for better context

        if (errorLines.length > 0) {
          console.log('Error details:');
          errorLines.forEach((line) => console.log(`  ${line}`));
        } else {
          console.log(`Error: ${error.message || 'Unknown error'}`);
          if (error.code) {
            console.log(`Exit code: ${error.code}`);
          }
        }

        failureCount++;
        failedPaths.push(contentPath);

        // EXIT IMMEDIATELY on first failure
        console.log(`\n💥 STOPPING recursive extraction due to failure in: ${contentPath}`);
        console.log(`📊 Processed: ${successCount + failureCount}/${contentStorePaths.size} stores before stopping`);
        console.log(`✅ Successful: ${successCount}`);
        process.exit(1);
      }
    }
  }

  // Final summary for linked extractions
  console.log('\n📊 LINKED CONTENT STORES SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successful extractions: ${successCount}`);
  console.log(`❌ Failed extractions: ${failureCount}`);
  console.log(`📁 Total linked stores processed: ${contentStorePaths.size}`);

  if (failedPaths.length > 0) {
    console.log('\n🚫 Failed content paths:');
    failedPaths.forEach((path, index) => {
      console.log(`  ${index + 1}. ${path}`);
    });
  }
}

// Main execution function
async function main() {
  // Ensure DATA directory exists
  const dataDir = path.join(__dirname, DATA_DIR);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Created DATA directory: ${dataDir}`);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created directory: ${OUTPUT_DIR}`);
  }

  // Clean up any corrupted images from previous runs
  cleanupCorruptedImages();

  console.log('📥 Downloading jcr:content.infinity.json from AEM...\n');

  try {
    // First find the tabs path by downloading jcr:content structure
    const jcrUrl = `${AEM_AUTHOR}${CONTENT_PATH}/jcr:content.infinity.json`;
    console.log(`📡 Fetching JCR structure: ${jcrUrl}\n`);

    const jcrContent = await downloadFile(jcrUrl, path.join(OUTPUT_DIR, 'jcr-content.json'));
    const jcrData = JSON.parse(jcrContent);

    // Save jcr-content.json in pretty format
    fs.writeFileSync(path.join(OUTPUT_DIR, 'jcr-content.json'), JSON.stringify(jcrData, null, 2));
    console.log('✅ Saved jcr-content.json in pretty format');
    console.log(`💡 Tip: Delete ${CACHE_DIR} to force re-download from AEM\n`);

    // Find all tabs paths in the JCR
    const tabsPaths = findAllTabsPaths(jcrData);
    console.log(`\n📊 Found ${tabsPaths.length} tabs path(s):`);
    tabsPaths.forEach((p) => console.log(`  - ${p}`));

    // Button container extraction disabled - buttons are already part of regular tabs structure
    const buttonContainerPaths = [];

    // Filter out nested tabs (tabs inside tab items) - they should remain nested
    // Nested tabs have '/tabs/' or '/tabs_' in their path (tabs inside tab items)
    const topLevelTabsPaths = tabsPaths.filter((path) => {
      // Count how many times '/tabs' appears in the path after the first occurrence
      const match = path.match(/\/tabs/g);
      return !match || match.length === 1; // Keep only paths with exactly one /tabs
    });

    console.log(`📋 Using top-level tabs only: ${topLevelTabsPaths.length} path(s)\n`);

    // Function to determine which JCR section a tab path belongs to
    function getJCRSectionForTabPath(tabPath, jcrData) {
      // tabPath is like: /jcr:content/root/container/container/container_732554625_/tabs
      // or: /jcr:content/root/container/container_copy_copy_1873410646/container_732554625_/tabs
      // We need to find which ROOT-level container this path traverses through

      const pathParts = tabPath.split('/').filter((p) => p && p !== 'jcr:content' && p !== 'root');
      if (pathParts.length === 0) return null;

      // Get all root-level container keys
      const rootContainer = jcrData.root.container;
      const rootKeys = Object.keys(rootContainer).filter((k) => !k.startsWith(':'));

      // Find the longest matching root-level container key in the path
      let matchedKey = null;
      let maxMatchLength = 0;

      for (const key of rootKeys) {
        // Check if this key appears anywhere in the path
        if (pathParts.includes(key) && key.length > maxMatchLength) {
          matchedKey = key;
          maxMatchLength = key.length;
        }
      }

      if (!matchedKey) {
        // Try matching by sequence - take all path parts until we find a root-level key
        for (let i = 0; i < pathParts.length; i++) {
          if (rootKeys.includes(pathParts[i])) {
            matchedKey = pathParts[i];
            break;
          }
        }
      }

      if (!matchedKey) return null;

      const container = rootContainer[matchedKey];
      if (!container || typeof container !== 'object') {
        return null;
      }

      // Recursively search for a title component within this container
      function findTitleInSubtree(obj) {
        for (const key in obj) {
          if (!key.startsWith(':') && obj[key] && typeof obj[key] === 'object') {
            const item = obj[key];
            if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
              return item['jcr:title'];
            }
            // Recurse into nested objects
            const result = findTitleInSubtree(item);
            if (result) return result;
          }
        }
        return null;
      }

      return findTitleInSubtree(container);
    }

    // Download all tabs as models and combine
    const allTabsData = [];
    for (let i = 0; i < topLevelTabsPaths.length; i++) {
      const tabsUrl = `${AEM_AUTHOR}${CONTENT_PATH}${topLevelTabsPaths[i]}.model.json`;
      console.log(`\n📥 Downloading tabs ${i + 1}/${topLevelTabsPaths.length}: ${tabsUrl}`);
      try {
        const tabsContent = await downloadFile(tabsUrl, null); // Pass null for intermediate files
        const tabsData = JSON.parse(tabsContent);

        // Attach JCR section information
        const jcrSection = getJCRSectionForTabPath(topLevelTabsPaths[i], jcrData);
        if (jcrSection) {
          tabsData.__jcrSection = jcrSection;
        }

        allTabsData.push(tabsData);
      } catch (err) {
        console.log(`  ⚠️  Failed to download this tabs: ${err.message}`);
      }
    }

    let mainTabsData = null;

    if (allTabsData.length === 0) {
      console.log('\n⚠️  No tabs data found - will extract non-tabs content only');
    } else {
      console.log(`\n✅ Downloaded ${allTabsData.length} tabs model(s)`);

      // Track the most comprehensive model (the one with the most items)
      let mostComprehensiveModel = allTabsData[0];
      let maxItemCount = allTabsData[0][':itemsOrder']?.length || 0;

      allTabsData.forEach((tabs, idx) => {
        const itemCount = tabs[':itemsOrder']?.length || 0;
        console.log(`  - Tabs ${idx}: ${itemCount} items`);
        if (itemCount > maxItemCount) {
          maxItemCount = itemCount;
          mostComprehensiveModel = tabs;
        }
      });

      console.log(`\n📊 Most comprehensive model: ${maxItemCount} items`);
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'most-comprehensive-tabs.model.json'),
        JSON.stringify(mostComprehensiveModel, null, 2),
      );
      console.log('💾 Saved most comprehensive model to: most-comprehensive-tabs.model.json\n');

      // Combine ALL tabs data to get complete hierarchy
      const combinedTabsData = {
        ':itemsOrder': [],
        ':items': {},
        ':type': 'tccc-dam/components/tabs',
        id: 'combined-tabs',
      };

      // Merge all tabs intelligently
      // Use a unique key for each item from each tabs to preserve all content
      allTabsData.forEach((tabs, idx) => {
        const itemsOrder = tabs[':itemsOrder'] || [];
        const items = tabs[':items'] || {};

        itemsOrder.forEach((key) => {
        // Create a unique key combining original key and tabs index
        // This ensures items with the same name from different tabs don't overwrite each other
          const uniqueKey = `${key}__tabs${idx}`;

          combinedTabsData[':itemsOrder'].push(uniqueKey);
          const item = items[key];
          combinedTabsData[':items'][uniqueKey] = item;

          // Attach JCR section information from the tabs data
          if (tabs.__jcrSection) {
            item.__jcrSection = tabs.__jcrSection;
          }
        });
      });

      console.log(`📌 Combined all tabs into ${combinedTabsData[':itemsOrder'].length} items\n`);
      mainTabsData = combinedTabsData;
    }

    // Create a map of all titles to their sling:resourceType from JCR
    const jcrTitleMap = {};
    const jcrLinkUrlMap = {}; // Map of (title|parentKey) -> linkURL
    const jcrTextMap = {}; // Map of (title|parentKey) -> text content
    const jcrButtonsWithoutLinkUrl = {}; // Track buttons that DON'T have linkURL
    const jcrPathMap = {}; // Map of key -> full JCR path for image URLs
    const jcrTeaserImageMap = {}; // Map of teaser key -> {fileName, lastModified, jcrPath}
    function indexJCRByTitle(obj, parentPath = '', parentKey = '') {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
        if (!key.startsWith(':') && typeof obj[key] === 'object') {
          const rt = obj[key]['sling:resourceType'];
          const title = obj[key]['cq:panelTitle'] || obj[key]['jcr:title'] || obj[key].title;
          const { linkURL } = obj[key];

          // Store JCR path for teasers and other items
          if (key.startsWith('teaser') || key.startsWith('button')) {
            jcrPathMap[key] = `${parentPath}/${key}`;
          }

          // Store teaser image information ONLY if it has imageResource in model
          if (key.startsWith('teaser') && obj[key].file && obj[key].fileName) {
            // Store all teasers - purely data-driven extraction
            const { fileName } = obj[key];
            // Use teaser's jcr:lastModified for timestamp
            const lastModifiedStr = obj[key]['jcr:lastModified'] || obj[key].file['jcr:lastModified'] || obj[key].file['jcr:created'];
            // Convert to Unix timestamp in milliseconds
            const lastModified = new Date(lastModifiedStr).getTime();

            // Create unique key for each teaser instance (path-based)
            // Extract the path starting from first item_ component to match model paths
            const pathParts = parentPath.split('/');
            const itemIndex = pathParts.findIndex((p) => p.startsWith('item_'));
            const modelPath = itemIndex >= 0 ? `/${pathParts.slice(itemIndex).join('/')}/${key}` : `${parentPath}/${key}`;

            jcrTeaserImageMap[modelPath] = {
              fileName,
              lastModified,
              jcrPath: `${parentPath}/${key}`,
              teaserKey: key,
              teaserTitle: obj[key]['jcr:title'], // Store title for disambiguation
              // Mark as pending - will be confirmed when checking model
              hasImageResource: false,
            };
          }

          if (title && rt) {
            jcrTitleMap[String(title)] = rt;
          }

          // Capture linkURL for button items
          if (title && rt && rt.includes('button')) {
            const titleKey = String(title);
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${titleKey}|${parentKeyContext}`;

            if (linkURL) {
              // Store buttons WITH linkURL by:
              // 1. Full JCR path (most specific - handles duplicate keys in different containers)
              // 2. Button key (may have collisions if same key in different containers)
              // 3. Context key (title|parentKey)
              // 4. Title-only (fallback, but may have collisions)
              const fullPath = `${parentPath}/${key}`;
              jcrLinkUrlMap[fullPath] = linkURL;
              jcrLinkUrlMap[key] = linkURL;
              jcrLinkUrlMap[contextKey] = linkURL;
              jcrLinkUrlMap[titleKey] = linkURL;
            }
            // Note: Don't store buttons WITHOUT linkURL to avoid false positives
            // Only store the ones WITH linkURLs
          }

          // Capture text content from text_* properties OR direct text component items
          if (title) {
            const titleKey = String(title);
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${titleKey}|${parentKeyContext}`;

            let textContent = null;

            // First, check if this item itself is a text component with direct text field
            if (rt && rt.includes('text') && obj[key].text) {
              textContent = obj[key].text;
            } else {
              // Otherwise, collect ALL text components (text_*, text) and concatenate them
              const textComponents = [];

              // Check :itemsOrder first to respect authoring order
              const itemsOrder = obj[key][':itemsOrder'] || [];
              for (const orderedKey of itemsOrder) {
                if ((orderedKey === 'text' || orderedKey.startsWith('text_'))
                    && obj[key][orderedKey] && obj[key][orderedKey].text) {
                  textComponents.push(obj[key][orderedKey].text);
                }
              }

              // If no :itemsOrder, fall back to unordered iteration
              if (textComponents.length === 0) {
                for (const textKey in obj[key]) {
                  if ((textKey === 'text' || textKey.startsWith('text_'))
                      && obj[key][textKey].text) {
                    textComponents.push(obj[key][textKey].text);
                  }
                }
              }

              // Concatenate all text components
              if (textComponents.length > 0) {
                textContent = textComponents.join('\n');
              }
            }

            if (textContent) {
              // Store text by context key (title|parentKey) with path for uniqueness
              // Use current item's path (parentPath/key) not parent's path
              const currentItemPath = `${parentPath}/${key}`;
              const uniqueContextKey = `${titleKey}|${parentKeyContext}|${currentItemPath}`;
              jcrTextMap[uniqueContextKey] = textContent;
              jcrTextMap[contextKey] = textContent;

              // Store by title-only as fallback, but don't overwrite existing content
              if (!jcrTextMap[titleKey]) {
                jcrTextMap[titleKey] = textContent;
              }
            }
          } else if (rt && rt.includes('text') && obj[key].text) {
            // For text components without a title, store by key context
            const parentKeyContext = parentKey || 'root';
            const contextKey = `${key}|${parentKeyContext}`;
            const textContent = obj[key].text;
            jcrTextMap[contextKey] = textContent;
            // Also store by key only as fallback
            if (!jcrTextMap[key]) {
              jcrTextMap[key] = textContent;
            }
          }

          indexJCRByTitle(obj[key], `${parentPath}/${key}`, key);
        }
      }
    }
    indexJCRByTitle(jcrData.root);

    // Apply resource types to tabs model by matching titles
    function enrichByTitle(items) {
      if (!items || typeof items !== 'object') return;
      for (const key in items) {
        if (!key.startsWith(':') && typeof items[key] === 'object') {
          const title = items[key]['cq:panelTitle'] || items[key]['jcr:title'] || items[key].title;
          if (title && jcrTitleMap[String(title)]) {
            items[key]['sling:resourceType'] = jcrTitleMap[String(title)];
          }
          if (items[key][':items']) enrichByTitle(items[key][':items']);
        }
      }
    }
    if (mainTabsData) {
      enrichByTitle(mainTabsData[':items']);
    }

    // Extract jcr:lastModified timestamps from model data for teasers
    function extractTimestampsFromModel(items, basePath = '') {
      if (!items || typeof items !== 'object') return;

      // Process items in order if :itemsOrder exists, otherwise use for...in
      const itemsOrder = items[':itemsOrder'] || Object.keys(items).filter((k) => !k.startsWith(':'));

      for (const key of itemsOrder) {
        if (!key.startsWith(':') && items[key] && typeof items[key] === 'object') {
          const newPath = `${basePath}/${key}`;
          const item = items[key];

          // Check if this is a teaser item with valid image data
          if ((key.startsWith('teaser') || item['sling:resourceType']?.includes('teaser')) && item.imageResource && item.imageResource['jcr:lastModified']) {
            // Create path-based unique key to match JCR indexing
            const uniqueKey = `${newPath}`;

            // Find JCR entry that matches both the component name AND the image filename
            let matchingJcrKey = null;
            const modelFileName = item.imageResource.fileName;

            // Look for JCR entries with matching component name and filename
            for (const [jcrPath, jcrData] of Object.entries(jcrTeaserImageMap)) {
              if (jcrData.teaserKey === key && jcrData.fileName === modelFileName) {
                matchingJcrKey = jcrPath;
                break;
              }
            }

            // Only update if we found a matching JCR entry with the same filename
            if (matchingJcrKey) {
              jcrTeaserImageMap[matchingJcrKey].lastModified = item.imageResource['jcr:lastModified'];
              jcrTeaserImageMap[matchingJcrKey].hasImageResource = true;
              jcrTeaserImageMap[matchingJcrKey].modelPath = uniqueKey; // Store model path for lookup

              // Store all three URL sources for comparison (keep extensions)
              const linkSources = {};

              // Check if this is a button component (prioritize :type from Sling Model)
              const isButtonComponent = (item[':type'] || item['sling:resourceType']) === 'tccc-dam/components/button';

              // link.url - the actual clickable link in the UI
              if (item.link && item.link.url) {
                linkSources.clickableUrl = stripHostOnly(item.link.url);
              }
              // linkURL - raw storage format from JCR
              // For button components, linkURL should be treated as clickableUrl
              if (item.linkURL) {
                const processedURL = stripHostOnly(item.linkURL);
                if (isButtonComponent) {
                  if (!linkSources.clickableUrl) {
                    linkSources.clickableUrl = processedURL;
                  }
                } else {
                  linkSources.storageUrl = processedURL;
                }
              }
              // xdm:linkURL - analytics/data layer tracking URL
              // Check nested under item.id first, then direct
              let xdmLinkURL1;
              if (item.dataLayer) {
                if (item.id && item.dataLayer[item.id] && item.dataLayer[item.id]['xdm:linkURL']) {
                  xdmLinkURL1 = item.dataLayer[item.id]['xdm:linkURL'];
                } else if (item.dataLayer['xdm:linkURL']) {
                  xdmLinkURL1 = item.dataLayer['xdm:linkURL'];
                }
              }
              if (xdmLinkURL1 && isValidLinkURL(xdmLinkURL1)) {
                linkSources.analyticsUrl = stripHostOnly(xdmLinkURL1);
              }
              // imageResource.linkURL - link from image metadata
              if (item.imageResource.linkURL) {
                linkSources.imageResourceUrl = stripHostOnly(item.imageResource.linkURL);
              }

              // Store all URL sources if any exist
              if (Object.keys(linkSources).length > 0) {
                jcrTeaserImageMap[matchingJcrKey].linkSources = linkSources;
              }
            }
          }

          // Extract linkURL from any item that has link.url or linkURL (not just teasers)
          if (item.linkURL || (item.link && item.link.url)) {
            // Create path-based unique key to match JCR indexing
            const uniqueKey = `${newPath}`;

            // Create a synthetic JCR key for linkURL storage
            const linkURLKey = `${newPath}_linkurl`;

            // Store all three URL sources for comparison (keep extensions)
            const linkSources = {};

            // Check if this is a button component (prioritize :type from Sling Model)
            const isButtonComponent = (item[':type'] || item['sling:resourceType']) === 'tccc-dam/components/button';

            // link.url - the actual clickable link in the UI
            if (item.link && item.link.url) {
              linkSources.clickableUrl = stripHostOnly(item.link.url);
            }
            // linkURL - raw storage format from JCR
            // For button components, linkURL should be treated as clickableUrl
            if (item.linkURL) {
              const processedURL = stripHostOnly(item.linkURL);
              if (isButtonComponent) {
                if (!linkSources.clickableUrl) {
                  linkSources.clickableUrl = processedURL;
                }
              } else {
                linkSources.storageUrl = processedURL;
              }
            }
            // xdm:linkURL - analytics/data layer tracking URL
            // Check nested under item.id first, then direct
            let xdmLinkURL2;
            if (item.dataLayer) {
              if (item.id && item.dataLayer[item.id] && item.dataLayer[item.id]['xdm:linkURL']) {
                xdmLinkURL2 = item.dataLayer[item.id]['xdm:linkURL'];
              } else if (item.dataLayer['xdm:linkURL']) {
                xdmLinkURL2 = item.dataLayer['xdm:linkURL'];
              }
            }
            if (xdmLinkURL2 && isValidLinkURL(xdmLinkURL2)) {
              linkSources.analyticsUrl = stripHostOnly(xdmLinkURL2);
            }

            // Store all URL sources
            const mapEntry = {
              teaserKey: key,
              hasImageResource: false,
              modelPath: uniqueKey,
              linkSources,
            };

            jcrTeaserImageMap[linkURLKey] = mapEntry;
          }

          // Recurse into nested items
          if (item[':items']) {
            extractTimestampsFromModel(item[':items'], newPath);
          }
        }
      }
    }
    if (mainTabsData) {
      extractTimestampsFromModel(mainTabsData[':items']);
    }

    // Remove teasers from jcrTeaserImageMap that don't have imageResource AND don't have linkSources AND don't have fileName
    // Keep teasers with fileName even if not in Sling Model (needed for JCR-only content like non-tabs sections)
    const beforeCleanup = Object.keys(jcrTeaserImageMap).length;
    for (const uniqueKey in jcrTeaserImageMap) {
      if (!jcrTeaserImageMap[uniqueKey].hasImageResource && !jcrTeaserImageMap[uniqueKey].linkSources && !jcrTeaserImageMap[uniqueKey].fileName) {
        delete jcrTeaserImageMap[uniqueKey];
      }
    }
    const afterCleanup = Object.keys(jcrTeaserImageMap).length;
    if (beforeCleanup !== afterCleanup) {
      console.log(`🧹 Cleaned up ${beforeCleanup - afterCleanup} teasers without imageResource from model`);
    }

    // Button container processing disabled - buttons are already part of regular tabs structure
    let mainHierarchy = [];
    // =========================================================================
    // PHASE 1: EXTRACTION
    // =========================================================================
    // Extract content from Sling Model and JCR separately
    // Sling Model: tabs, buttons, teasers with URLs and structured data
    // JCR: non-tabs sections, standalone content, text components
    // NO merging or deduplication at this stage
    // =========================================================================
    console.log('\n📥 PHASE 1: Extracting from Sling Model and JCR...\n');

    if (mainTabsData) {
      console.log(`📌 Extracting ${mainTabsData[':itemsOrder'].length} items from Sling Model\n`);

      // Continue with parsing
      // eslint-disable-next-line no-use-before-define
      mainHierarchy = parseHierarchyFromModel(mainTabsData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrData, jcrPathMap, jcrTeaserImageMap);
    } else {
      console.log('📌 No tabs data from Sling Model - extracting tabs directly from JCR\n');
      // eslint-disable-next-line no-use-before-define
      mainHierarchy = extractTabsFromJCR(jcrData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrPathMap, jcrTeaserImageMap);
    }

    // Extract non-tabs content from JCR (separate extraction, no merging yet)
    console.log('\n📥 Extracting non-tabs content from JCR...\n');
    // eslint-disable-next-line no-use-before-define
    const { sections: nonTabsSections, processedRootContainerKeys } = extractNonTabsContent(jcrData, jcrTeaserImageMap);
    if (nonTabsSections.length > 0) {
      console.log(`\n📦 Found ${nonTabsSections.length} section(s) outside tabs:`);
      nonTabsSections.forEach((section) => {
        console.log(`   - ${section.title} (${section.items.length} items)`);
      });
      // Prepend non-tabs sections to the beginning of the hierarchy
      mainHierarchy = [...nonTabsSections, ...mainHierarchy];
    }

    // Find banner images
    // eslint-disable-next-line no-use-before-define
    const bannerImages = extractBannerImage(jcrData, CONTENT_PATH);

    // Build global item registry from existing hierarchy (Sling Model)
    // This tracks items with their parent context to prevent duplicates within the same parent
    // Declared here so it's accessible throughout the script
    const globalItemRegistry = new Set();
    function buildGlobalItemRegistry(items, parentPath = '') {
      if (!items || !Array.isArray(items)) return;
      items.forEach((item) => {
        if (item.type === 'button' || item.type === 'accordion') {
          // Include parent path in unique key to allow same-named items in different sections
          const uniqueKey = `${parentPath}|${item.type}|${item.key || ''}|${item.title || ''}`;
          globalItemRegistry.add(uniqueKey);
        }
        if (item.items) {
          // Pass the current item's path as parent for children
          buildGlobalItemRegistry(item.items, item.path || item.title || '');
        }
      });
    }

    // Supplement with content from JCR BEFORE transformations (so unwrapping doesn't remove accordions with JCR text)
    // Skip this if non-tabs sections already exist (they've already been fully extracted including accordions)
    const hasNonTabsSections = nonTabsSections.length > 0;

    if (hasNonTabsSections) {
      console.log('\n⏭️  Skipping JCR button/accordion extraction (non-tabs sections already fully extracted)');
      // Still initialize the global registry for deduplication later
      buildGlobalItemRegistry(mainHierarchy);
      console.log(`📋 Global item registry: ${globalItemRegistry.size} unique item(s) from Sling Model`);
    } else {
      console.log('\n🔍 Checking for missing content in JCR (buttons only - accordion extraction disabled)...');
      // eslint-disable-next-line no-use-before-define
      const jcrButtonContainerPaths = findAllButtonContainerPaths(jcrData.root);
      // Accordion extraction disabled to avoid duplicates
      const jcrAccordionPaths = [];

      console.log(`📊 Found ${jcrButtonContainerPaths.length} container(s) with buttons in JCR`);
      console.log('📊 JCR accordion extraction: DISABLED');

      if (jcrButtonContainerPaths.length > 0 || jcrAccordionPaths.length > 0) {
      // Extract buttons from all containers
        const jcrButtons = [];
        jcrButtonContainerPaths.forEach((containerPath) => {
        // eslint-disable-next-line no-use-before-define
          const buttons = extractButtonsFromContainer(jcrData, containerPath);
          if (buttons.length > 0) {
            console.log(`  - ${containerPath}: ${buttons.length} button(s)`);
            jcrButtons.push({ containerPath, buttons });
          }
        });

        // Extract text from all accordions (each accordion may have multiple panels)
        const jcrAccordionTexts = [];
        jcrAccordionPaths.forEach((accordionPath) => {
        // eslint-disable-next-line no-use-before-define
          const panels = extractTextFromAccordion(jcrData, accordionPath);
          if (panels && Array.isArray(panels)) {
            panels.forEach((panel) => {
              jcrAccordionTexts.push({
                accordionPath,
                text: panel.text,
                title: panel.title,
                panelKey: panel.key,
              });
            });
          }
        });

        console.log(`\n📌 Found ${jcrButtons.reduce((sum, c) => sum + c.buttons.length, 0)} button(s) and ${jcrAccordionTexts.length} accordion text content(s) to merge`);

        // Build a map of JCR container paths to their panel titles for better matching
        const containerTitleMap = {};
        function mapContainerTitles(obj, currentPath = '') {
          if (!obj || typeof obj !== 'object') return;
          for (const key in obj) {
            if (!key.startsWith(':') && typeof obj[key] === 'object') {
              const newPath = currentPath ? `${currentPath}/${key}` : key;
              const panelTitle = obj[key]['cq:panelTitle'] || obj[key]['jcr:title'];
              if (panelTitle) {
                containerTitleMap[`/jcr:content/${newPath}`] = panelTitle;
              }
              mapContainerTitles(obj[key], newPath);
            }
          }
        }
        mapContainerTitles(jcrData.root);

        // Initialize global item registry with mainHierarchy
        buildGlobalItemRegistry(mainHierarchy);
        console.log(`📋 Global item registry: ${globalItemRegistry.size} unique item(s) from Sling Model`);

        // =========================================================================
        // PHASE 2: MERGE (Part 1 - Merge JCR into Sling)
        // =========================================================================
        // Merge JCR content (buttons, text) into Sling Model hierarchy
        // Merge rules:
        //   - Sling wins for: linkURL, searchLink, structured data
        //   - JCR adds: missing items, text content, image paths
        //   - Match by: key + title (strongest), key only, or title only
        // =========================================================================
        console.log('\n🔀 PHASE 2A: Merging JCR content into Sling Model hierarchy...\n');
        const mergedContainers = new Set(); // Track which JCR containers we've already merged

        function mergeJCRContentIntoHierarchy(items, depth = 0) {
          if (!items || !Array.isArray(items)) return;

          // Safeguard against infinite recursion
          if (depth > 50) {
            console.warn(`⚠️  Stopping recursion at depth ${depth} to prevent stack overflow`);
            return;
          }

          items.forEach((item) => {
          // Check if this item's title matches any button container's parent
            jcrButtons.forEach(({ containerPath, buttons }) => {
            // Skip if we've already merged this container
              if (mergedContainers.has(containerPath)) {
                return;
              }
              // Find the nearest ancestor container with a title by traversing up the path
              let parentTitle = null;
              let parentPath = containerPath;
              const pathParts = containerPath.split('/');

              // Try each ancestor path from closest to furthest
              for (let i = pathParts.length - 1; i >= 0 && !parentTitle; i--) {
                const ancestorPath = pathParts.slice(0, i + 1).join('/');
                if (containerTitleMap[ancestorPath]) {
                  parentTitle = containerTitleMap[ancestorPath];
                  parentPath = ancestorPath;
                  break;
                }
              }

              // Match by title (most reliable) or by key
              const titleMatches = parentTitle && item.title === parentTitle;
              const keyMatches = item.key && (parentPath.includes(`/${item.key}/`) || parentPath.endsWith(`/${item.key}`));

              if (titleMatches || keyMatches) {
              // This item might be the parent - add buttons if not already present
              // Use key+title combination for comparison (more reliable than ID alone)
                const existingButtonKeys = new Set();
                if (item.items) {
                  item.items.forEach((child) => {
                    if (child.type === 'button') {
                    // Use key+title combination for uniqueness check
                      const uniqueKey = `${child.key || ''}|${child.title || ''}`;
                      existingButtonKeys.add(uniqueKey);
                    }
                  });
                }

                // Add missing buttons
                let addedCount = 0;
                let skippedCount = 0;
                buttons.forEach((button) => {
                  const buttonUniqueKey = `${button.key || ''}|${button.title || ''}`;
                  // For buttons: use global deduplication (buttons should be globally unique)
                  const globalButtonKey = `button|${button.key || ''}|${button.title || ''}`;
                  // Check if this button exists ANYWHERE in the hierarchy
                  let existsGlobally = false;
                  for (const registryKey of globalItemRegistry) {
                    if (registryKey.endsWith(globalButtonKey)) {
                      existsGlobally = true;
                      break;
                    }
                  }
                  if (existsGlobally) {
                    // This button already exists elsewhere in the hierarchy (from Sling Model)
                    skippedCount++;
                  } else if (!existingButtonKeys.has(buttonUniqueKey)) {
                    if (!item.items) {
                      item.items = [];
                    }
                    // Create a deep copy to avoid circular references
                    const buttonCopy = JSON.parse(JSON.stringify(button));
                    // Add path to button copy
                    buttonCopy.path = item.path ? `${item.path}${PATH_SEPARATOR}${buttonCopy.title}` : buttonCopy.title;
                    item.items.push(buttonCopy);
                    addedCount++;
                    // Mark as added to prevent re-adding in future iterations
                    existingButtonKeys.add(buttonUniqueKey);
                    // Also add to global registry (with parent path) to prevent duplicates
                    const globalUniqueKey = `${item.path || item.title || ''}|button|${button.key || ''}|${button.title || ''}`;
                    globalItemRegistry.add(globalUniqueKey);
                  }
                });
                if (addedCount > 0 || skippedCount > 0) {
                  if (addedCount > 0) {
                    console.log(`  ✅ Added ${addedCount} missing button(s) to "${item.title}"`);
                  }
                  if (skippedCount > 0) {
                    console.log(`  ⏭️  Skipped ${skippedCount} duplicate button(s) for "${item.title}" (already exists in hierarchy)`);
                  }
                  // Mark this container as merged to prevent duplicates
                  mergedContainers.add(containerPath);
                }
              }
            });

            // Merge accordion text content
            jcrAccordionTexts.forEach(({ accordionPath, text }) => {
            // Only merge accordion text to accordion items, NOT to parent tabs
            // Extract the accordion key from the JCR path (last component)
              const pathParts = accordionPath.split('/').filter((p) => p && !p.startsWith('jcr:'));
              const accordionKeyInPath = pathParts[pathParts.length - 1]; // e.g., "accordion_copy_copy__667460752"

              // Only match if this is an accordion item AND the keys match exactly
              const shouldMerge = (item.type === 'accordion' && item.key === accordionKeyInPath);

              if (shouldMerge && text) {
                const strippedText = stripHostsFromText(text);
                // Append text if not already present
                if (!item.text) {
                  item.text = strippedText;
                } else if (!item.text.includes(strippedText.substring(0, 300))) {
                  // Only append if this text isn't already present (check first 300 chars as signature for better uniqueness)
                  item.text += `\n${strippedText}`;
                }
                // Mark as matched
                accordionPath.matched = true;
              }
            });

            // Recurse into children
            if (item.items) {
              mergeJCRContentIntoHierarchy(item.items, depth + 1);
            }
          });
        }

        mergeJCRContentIntoHierarchy(mainHierarchy);

        // Extract unmatched JCR-only accordion panels and add them to the hierarchy
        const unmatchedAccordions = jcrAccordionTexts.filter(({ accordionPath }) => !accordionPath.matched);
        if (unmatchedAccordions.length > 0) {
          console.log(`\n🔍 Found ${unmatchedAccordions.length} JCR-only accordion panel(s) to add to hierarchy`);

          // Group panels by accordion path
          const accordionGroups = {};
          unmatchedAccordions.forEach(({
            accordionPath, text, title, panelKey,
          }) => {
            if (!accordionGroups[accordionPath]) {
              accordionGroups[accordionPath] = [];
            }
            accordionGroups[accordionPath].push({ text, title, panelKey });
          });

          // Sort accordion paths by depth (shallowest first) to ensure parent accordions are added before children
          const sortedPaths = Object.keys(accordionGroups).sort((a, b) => {
            const depthA = a.split('/').length;
            const depthB = b.split('/').length;
            return depthA - depthB;
          });

          // For each accordion (in depth order), find its nearest ancestor with a title
          sortedPaths.forEach((accordionPath) => {
            const panels = accordionGroups[accordionPath];

            // Extract path hierarchy
            // e.g., "/jcr:content/container/container_copy/container_copy_78921/accordion_copy_50799"
            const allPathParts = accordionPath.split('/');

            // Find the nearest ancestor with a title by traversing up the path
            // IMPORTANT: We need to find an ancestor that exists in the hierarchy,
            // not one that's also JCR-only
            let ancestorTitle = null;
            let foundInHierarchy = false;

            for (let i = allPathParts.length - 2; i >= 0 && !foundInHierarchy; i--) {
              const ancestorPath = allPathParts.slice(0, i + 1).join('/');
              // Check if any paths under this ancestor have a title
              // Find ALL matching titles, then check which ones exist in hierarchy
              const matchingTitles = Object.keys(containerTitleMap)
                .filter((path) => path.startsWith(ancestorPath))
                .map((path) => containerTitleMap[path]);

              if (matchingTitles.length > 0) {
              // Check if any of these titles exists in the hierarchy (not just in JCR)
                function titleExistsInHierarchy(items, title) {
                  if (!items || !Array.isArray(items)) return false;
                  for (const item of items) {
                    if (item.title === title) return true;
                    if (item.items && titleExistsInHierarchy(item.items, title)) return true;
                  }
                  return false;
                }

                // Find first title that exists in hierarchy
                for (const potentialTitle of matchingTitles) {
                  if (titleExistsInHierarchy(mainHierarchy, potentialTitle)) {
                    ancestorTitle = potentialTitle;
                    foundInHierarchy = true;
                    break;
                  }
                }
              }
            }

            const pathParts = accordionPath.split('/').filter((p) => p && !p.startsWith('jcr:'));
            const grandparentKey = pathParts[pathParts.length - 3]; // container_copy

            // Find the ancestor section in hierarchy
            function findAncestorAndAddAccordions(items) {
              if (!items || !Array.isArray(items)) return false;

              for (const item of items) {
              // Match by title (e.g., "Visual", "VIS ID")
                const titleMatches = ancestorTitle && item.title === ancestorTitle;
                const keyMatches = item.key && (grandparentKey === item.key || item.path?.includes(ancestorTitle));

                if (titleMatches || keyMatches) {
                // Add each panel as a separate accordion item (check for global duplicates)
                  let addedAccordionCount = 0;
                  let skippedAccordionCount = 0;
                  panels.forEach((panel) => {
                    // For accordions: use global deduplication (same as buttons)
                    const globalAccordionKey = `accordion|${panel.panelKey || ''}|${panel.title || ''}`;
                    // Check if this accordion exists ANYWHERE in the actual hierarchy (not just registry)
                    // This handles nested tabs that might not be in the main registry
                    let existsGlobally = false;
                    function checkHierarchyForAccordion(items) {
                      if (!items || !Array.isArray(items)) return false;
                      for (const hierarchyItem of items) {
                        if (hierarchyItem.type === 'accordion'
                            && hierarchyItem.key === panel.panelKey
                            && hierarchyItem.title === panel.title) {
                          return true;
                        }
                        if (hierarchyItem.items && checkHierarchyForAccordion(hierarchyItem.items)) {
                          return true;
                        }
                      }
                      return false;
                    }
                    existsGlobally = checkHierarchyForAccordion(mainHierarchy);

                    if (existsGlobally) {
                      skippedAccordionCount++;
                    } else {
                      const accordionItem = {
                        title: panel.title,
                        path: item.path ? `${item.path}${PATH_SEPARATOR}${panel.title}` : panel.title,
                        type: 'accordion',
                        key: panel.panelKey,
                        text: stripHostsFromText(panel.text || ''),
                      };

                      if (!item.items) {
                        item.items = [];
                      }
                      item.items.push(accordionItem);
                      addedAccordionCount++;
                      // Add to global registry (with parent path) to prevent duplicates
                      const globalUniqueKey = `${item.path || item.title || ''}|accordion|${panel.panelKey || ''}|${panel.title || ''}`;
                      globalItemRegistry.add(globalUniqueKey);
                    }
                  });
                  if (addedAccordionCount > 0) {
                    console.log(`  ✅ Added ${addedAccordionCount} JCR-only accordion panel(s) to "${item.title}"`);
                  }
                  if (skippedAccordionCount > 0) {
                    console.log(`  ⏭️  Skipped ${skippedAccordionCount} duplicate accordion(s) for "${item.title}" (already exists in hierarchy)`);
                  }
                  return true;
                }

                // Recurse into children FIRST to find nested items
                if (item.items && findAncestorAndAddAccordions(item.items)) {
                  return true;
                }
              }
              return false;
            }

            if (!findAncestorAndAddAccordions(mainHierarchy)) {
              console.log(`  ⚠️  Could not find ancestor for accordion at ${accordionPath} (looking for "${ancestorTitle}")`);
            }
          });
        }

      // NOTE: Orphan accordion text fallback logic removed
      // If accordion text doesn't match any hierarchy item, it's intentionally ignored
      // Merging orphans to the first item caused incorrect text associations
      }
    } // End of else block for JCR button/accordion extraction

    // =========================================================================
    // PHASE 3: TYPE RESOLUTION
    // =========================================================================
    // Apply type conversions to correctly identify accordions, tabs, and containers
    // Rules (priority order):
    //   1. Unwrap accordion wrapper containers (title starts with 'accordion_')
    //   2. Convert items with cq:panelTitle + text → 'accordion'
    //   3. Convert items with cq:panelTitle + children → 'tab'
    //   4. Filter out empty containers
    // =========================================================================
    console.log('\n🔄 PHASE 3: Resolving item types (accordion/tab/container/text)...');
    // eslint-disable-next-line no-use-before-define
    const unwrappedHierarchy = unwrapAccordionItems(mainHierarchy);
    // eslint-disable-next-line no-use-before-define
    const accordionConverted = convertAccordionContainers(unwrappedHierarchy);
    // eslint-disable-next-line no-use-before-define
    const tabConverted = convertTabContainers(accordionConverted);
    // eslint-disable-next-line no-use-before-define
    const textExtracted = extractTextFromTabsWithChildren(tabConverted);
    // eslint-disable-next-line no-use-before-define
    const textConverted = convertTextContainers(textExtracted);
    // eslint-disable-next-line no-use-before-define
    let convertedHierarchy = filterEmptyContainers(textConverted);

    // =========================================================================
    // PHASE 2: MERGE (Part 2 - Add missing JCR content)
    // =========================================================================
    // Extract sections from JCR that weren't found in Sling Model
    // This includes:
    //   - Non-tabs content (titled sections, standalone teasers/buttons)
    //   - Orphaned content in "Other Content" section
    // =========================================================================
    console.log('\n🔍 PHASE 2B: Checking for missing sections in JCR...');

    // Collect all titles (including nested ones) to prevent re-extraction
    const collectAllTitles = (items) => {
      const titles = [];
      for (const item of items) {
        if (item.title) titles.push(item.title);
        if (item.items && item.items.length > 0) {
          titles.push(...collectAllTitles(item.items));
        }
      }
      return titles;
    };
    const existingSectionTitles = collectAllTitles(convertedHierarchy);

    const missingSections = extractMissingSectionsFromJCR(jcrData, existingSectionTitles, convertedHierarchy, jcrTeaserImageMap, processedRootContainerKeys);

    if (missingSections.length > 0) {
      console.log(`✅ Found ${missingSections.length} missing section(s) from JCR - adding to hierarchy`);
      convertedHierarchy.push(...missingSections);

      // Rebuild global registry to include newly added sections from JCR
      console.log('🔄 Rebuilding global item registry with JCR-added sections...');
      globalItemRegistry.clear();
      buildGlobalItemRegistry(convertedHierarchy);
      console.log(`📋 Updated global item registry: ${globalItemRegistry.size} unique item(s)`);

      // Unwrap any accordion wrappers that were added from JCR
      // (items with title starting with 'accordion_' - skip the wrapper but keep its children)
      console.log('🔄 Unwrapping accordion wrappers added from JCR...');
      const beforeUnwrap = JSON.stringify(convertedHierarchy).length;
      for (let i = 0; i < convertedHierarchy.length; i++) {
        if (convertedHierarchy[i].items) {
          convertedHierarchy[i].items = unwrapAccordionItems(convertedHierarchy[i].items);
        }
      }
      const afterUnwrap = JSON.stringify(convertedHierarchy).length;
      console.log(`✅ Unwrapped JCR accordions (${beforeUnwrap} -> ${afterUnwrap} bytes)`);

      // Remove "Other Content" section if it became empty or only contains duplicates after unwrapping
      const otherContentIndex = convertedHierarchy.findIndex(
        (section) => section.title === 'Other Content',
      );
      if (otherContentIndex !== -1) {
        const otherContent = convertedHierarchy[otherContentIndex];
        if (!otherContent.items || otherContent.items.length === 0) {
          console.log('⚠️  Removing empty "Other Content" section');
          convertedHierarchy.splice(otherContentIndex, 1);
        } else {
          // Build a set of title+key combinations from all other sections
          const existingItemSignatures = new Set();
          function collectSignatures(items, skipSection = null) {
            if (!items || !Array.isArray(items)) return;
            items.forEach((section) => {
              if (section === skipSection) return; // Don't collect from "Other Content" itself

              // Collect signature for this item itself (if it's a button/accordion/teaser)
              if (section.type === 'button' || section.type === 'accordion' || section.type === 'teaser') {
                const signature = `${section.type}|${section.title}|${section.key || ''}`;
                existingItemSignatures.add(signature);
              }

              // Recursively collect from children
              if (section.items && Array.isArray(section.items)) {
                collectSignatures(section.items);
              }
            });
          }
          collectSignatures(convertedHierarchy, otherContent);

          // Check if "Other Content" has any truly unique items and filter out duplicates
          const uniqueItems = [];
          const duplicateItems = [];
          const filteredItems = [];

          otherContent.items.forEach((item) => {
            const signature = `${item.type}|${item.title}|${item.key || ''}`;

            // If this item exists elsewhere in the hierarchy, it's a duplicate
            if (existingItemSignatures.has(signature)) {
              duplicateItems.push(`${item.title} (${item.type})`);
              return; // Skip this item
            }

            // Buttons, teasers with URLs are considered unique (if not duplicates)
            if ((item.type === 'button' || item.type === 'teaser') && item.linkSources) {
              uniqueItems.push(`${item.title} (${item.type})`);
              filteredItems.push(item);
              return;
            }

            // Text items or containers with substantive text content are considered unique
            // But skip generic instructional/boilerplate text
            if (item.type === 'text' || (item.type === 'container' && item.text)) {
              const text = (item.text || '').trim();
              const isBoilerplate = text.includes('Bold and underlined text are links')
                                  || text.includes('Explore tabs below to access various content');
              if (text.length > 50 && !isBoilerplate) {
                uniqueItems.push(`${item.title} (${item.type})`);
                filteredItems.push(item);
                return;
              }
            }

            // Other items are not considered unique
            duplicateItems.push(`${item.title} (${item.type})`);
          });

          if (duplicateItems.length > 0) {
            console.log(`⚠️  Filtering out ${duplicateItems.length} duplicate(s) from "Other Content":`);
            duplicateItems.forEach((dup) => console.log(`   - ${dup}`));
          }

          const hasUniqueContent = uniqueItems.length > 0;

          if (!hasUniqueContent) {
            console.log(`⚠️  Removing "Other Content" section (${otherContent.items.length} duplicate/low-value item(s))`);
            convertedHierarchy.splice(otherContentIndex, 1);
          } else {
            // Update "Other Content" to only include unique items
            otherContent.items = filteredItems;
            console.log(`✅ Keeping "Other Content" with ${filteredItems.length} unique item(s)`);
          }
        }
      }
    } else {
      console.log('✅ No missing sections detected');
    }

    // JCR-based proximity grouping: Nest tabs under titles based on JCR file order
    console.log('\n🔍 Applying JCR-based proximity semantic grouping...');

    // Build a map of JCR container order (titles and tabs components)
    const jcrContainerOrder = [];
    const rootContainer = jcrData.root.container;

    for (const containerKey in rootContainer) {
      const container = rootContainer[containerKey];
      if (!container || typeof container !== 'object') continue;
      if (containerKey.startsWith('jcr:') || containerKey.startsWith('cq:') || containerKey.startsWith('sling:')) continue;

      // Check if this container has a title component
      for (const nestedKey in container) {
        const nestedItem = container[nestedKey];
        if (nestedItem && nestedItem['sling:resourceType'] === 'tccc-dam/components/title') {
          jcrContainerOrder.push({
            type: 'title',
            title: nestedItem['jcr:title'],
            containerKey,
          });
          break;
        }
      }

      // Check if this container has a tabs component
      for (const nestedKey in container) {
        const nestedItem = container[nestedKey];
        if (nestedItem && nestedItem['sling:resourceType'] === 'tccc-dam/components/tabs') {
          // Extract tab panel titles
          const tabTitles = [];
          for (const tabKey in nestedItem) {
            const tabItem = nestedItem[tabKey];
            if (tabItem && typeof tabItem === 'object' && tabItem['cq:panelTitle']) {
              tabTitles.push(tabItem['cq:panelTitle']);
            }
          }
          jcrContainerOrder.push({
            type: 'tabs',
            tabTitles,
            containerKey,
          });
          break;
        }
      }
    }

    if (jcrContainerOrder.length > 0) {
      console.log(`Found ${jcrContainerOrder.filter((i) => i.type === 'title').length} title(s) and ${jcrContainerOrder.filter((i) => i.type === 'tabs').length} tabs component(s) in JCR`);
    }

    // Group tabs under preceding titles based on JCR proximity
    const groupedHierarchy = [];
    const processedTabs = new Set(); // Track which tabs have been nested

    for (let i = 0; i < jcrContainerOrder.length; i++) {
      const current = jcrContainerOrder[i];

      if (current.type === 'title') {
        // Find this title in convertedHierarchy
        const titleItem = convertedHierarchy.find((item) => item.type === 'title' && item.title === current.title);

        if (titleItem) {
          const titleSection = { ...titleItem };
          if (!titleSection.items) {
            titleSection.items = [];
          }

          // Look ahead in JCR order for immediately following tabs
          let grouped = false;
          if (i + 1 < jcrContainerOrder.length && jcrContainerOrder[i + 1].type === 'tabs') {
            const nextTabs = jcrContainerOrder[i + 1];

            // Find and nest these tabs under this title
            const tabsToNest = [];
            for (const tabTitle of nextTabs.tabTitles) {
              const tabItem = convertedHierarchy.find((item) => item.type === 'tab' && item.title === tabTitle && !processedTabs.has(item.title));
              if (tabItem) {
                tabsToNest.push(tabItem);
                processedTabs.add(tabItem.title);
              }
            }

            if (tabsToNest.length > 0) {
              // Update paths to include the parent title
              const updatedTabs = tabsToNest.map((tab) => {
                const updated = { ...tab };
                updated.path = `${titleSection.path}${PATH_SEPARATOR}${tab.title}`;

                // Recursively update paths of all nested children
                if (updated.items && Array.isArray(updated.items)) {
                  const updateNestedPaths = (items, parentPath) => items.map((item) => {
                    const updatedItem = { ...item };
                    updatedItem.path = `${parentPath}${PATH_SEPARATOR}${item.title}`;

                    if (updatedItem.items && Array.isArray(updatedItem.items)) {
                      updatedItem.items = updateNestedPaths(updatedItem.items, updatedItem.path);
                    }
                    return updatedItem;
                  });
                  updated.items = updateNestedPaths(updated.items, updated.path);
                }

                return updated;
              });

              titleSection.items.push(...updatedTabs);
              console.log(`  📁 Grouped ${tabsToNest.length} tab(s) [${tabsToNest.map((t) => t.title).join(', ')}] under title "${current.title}"`);
              grouped = true;
            }
          }

          groupedHierarchy.push(titleSection);
        }
      }
    }

    // Add any remaining items that weren't processed
    convertedHierarchy.forEach((item) => {
      if (item.type === 'title' && !groupedHierarchy.find((g) => g.type === 'title' && g.title === item.title)) {
        // Title wasn't in JCR order (probably added from non-tabs content) - keep it as is
        groupedHierarchy.push(item);
      } else if (item.type === 'tab' && !processedTabs.has(item.title)) {
        // Tab wasn't nested - keep it at root level
        groupedHierarchy.push(item);
      } else if (item.type !== 'title' && item.type !== 'tab') {
        // Other item types (accordion, button, etc.) - keep as is
        groupedHierarchy.push(item);
      }
    });

    // Replace convertedHierarchy with the grouped version only if we nested tabs
    const originalLength = convertedHierarchy.length;
    if (processedTabs.size > 0) {
      convertedHierarchy = groupedHierarchy;
      console.log(`✅ JCR-based proximity grouping complete (${processedTabs.size} tabs nested)`);
    } else {
      console.log('✅ No JCR-based proximity grouping needed (no tabs found in JCR)');
    }

    // =========================================================================
    // PHASE 4: CLEANUP & DEDUPLICATION
    // =========================================================================
    // Idempotent transformations:
    //   1. Deduplicate items (prefer items with more content)
    //   2. Filter out "Other Content" duplicates
    //   3. Sort sections by __jcrOrder
    //   4. Recalculate all paths for consistency
    // Deduplication rules:
    //   - ONLY deduplicate between JCR and Sling (keep Sling version)
    //   - Within same source: keep ALL if in different parent sections
    //   - Same parent + same content: keep first only
    // =========================================================================
    console.log('\n🔍 PHASE 4: Deduplication and cleanup...');

    // Pass 1: Collect all button/accordion items
    const allItems = new Map(); // uniqueKey -> array of {item, path}
    function collectItems(items, parentPath = '') {
      if (!items || !Array.isArray(items)) return;
      items.forEach((item) => {
        if (item.type === 'button' || item.type === 'accordion') {
          // Use global uniqueness for both buttons and accordions (type|key|title)
          // Content comparison will determine if they're true duplicates
          const uniqueKey = `${item.type}|${item.key}|${item.title}`;
          if (!allItems.has(uniqueKey)) {
            allItems.set(uniqueKey, []);
          }
          allItems.get(uniqueKey).push({ item, path: item.path || parentPath });
        }
        if (item.items) {
          collectItems(item.items, item.path || item.title || parentPath);
        }
      });
    }

    for (const section of convertedHierarchy) {
      collectItems(section.items, section.path || section.title);
    }

    // Pass 2: For duplicates, decide which to keep (prefer Sling Model version)
    const itemsToRemove = new Set(); // Set of paths to remove
    allItems.forEach((occurrences, uniqueKey) => {
      if (occurrences.length > 1) {
        // Check if all occurrences are at the same path - this indicates a bug where items were added twice
        const paths = occurrences.map((o) => o.path);
        const uniquePaths = [...new Set(paths)];

        if (uniquePaths.length === 1) {
          // All duplicates are at the same path - this is a bug, just keep the first one
          console.log(`  ⚠️  WARNING: Multiple instances of ${occurrences[0].item.type} "${occurrences[0].item.title}" at same path "${uniquePaths[0]}" - keeping only first instance`);
          // Don't remove any via path matching - instead deduplicate the array directly
          return;
        }

        // Extract parent sections from paths (everything before the last ">>>")
        const parentSections = occurrences.map((o) => {
          const parts = (o.path || '').split(' >>> ');
          return parts.length > 1 ? parts.slice(0, -1).join(' >>> ') : parts[0];
        });
        const uniqueParentSections = [...new Set(parentSections)];

        // If items are in different parent sections, keep all (even if they have identical content)
        // This honors the source data structure where the same button/accordion appears in multiple sections
        if (uniqueParentSections.length > 1) {
          console.log(`  ℹ️  Keeping all ${occurrences.length} instances of ${occurrences[0].item.type} "${occurrences[0].item.title}" (in ${uniqueParentSections.length} different sections)`);
          return;
        }

        // Check if all occurrences have the same URL/content - if not, they're not truly duplicates
        if (occurrences[0].item.type === 'button') {
          const urls = occurrences.map((o) => {
            const ls = o.item.linkSources || {};
            return ls.clickableUrl || ls.analyticsUrl || ls.storageUrl || '';
          });
          const uniqueURLs = [...new Set(urls.filter((u) => u))];
          if (uniqueURLs.length > 1) {
            // Buttons have different URLs - they're not truly duplicates, keep all
            console.log(`  ℹ️  Keeping all ${occurrences.length} buttons titled "${occurrences[0].item.title}" (different URLs)`);
            return;
          }
        } else if (occurrences[0].item.type === 'accordion') {
          // For accordions, check if they have different text content
          const texts = occurrences.map((o) => (o.item.text || '').trim());
          const uniqueTexts = [...new Set(texts)];
          if (uniqueTexts.length > 1 && uniqueTexts.some((t) => t.length > 0)) {
            // Accordions have different non-empty text content - not true duplicates, keep all
            console.log(`  ℹ️  Keeping all ${occurrences.length} accordions titled "${occurrences[0].item.title}" (different content)`);
            return;
          }
        }

        // Find the best one (prefer Sling Model, but also consider content richness)
        let bestIdx = 0;
        for (let i = 1; i < occurrences.length; i++) {
          const current = occurrences[i].item;
          const best = occurrences[bestIdx].item;

          // Score: panelTitle=10, button-ID=5, text content length=0.001 per char
          const currentScore = (current['cq:panelTitle'] ? 10 : 0)
                             + (current.id && current.id.startsWith('button-') && !current.id.startsWith('custom-button-') ? 5 : 0)
                             + ((current.text || '').length * 0.001);
          const bestScore = (best['cq:panelTitle'] ? 10 : 0)
                          + (best.id && best.id.startsWith('button-') && !best.id.startsWith('custom-button-') ? 5 : 0)
                          + ((best.text || '').length * 0.001);
          if (currentScore > bestScore) {
            bestIdx = i;
          }
        }

        // Mark all others for removal
        occurrences.forEach((occ, idx) => {
          if (idx !== bestIdx) {
            itemsToRemove.add(occ.path);
            console.log(`  ⏭️  Removing duplicate ${occ.item.type} "${occ.item.title}" from "${occ.path}"`);
          }
        });
        console.log(`  ✅ Keeping ${occurrences[bestIdx].item.type} "${occurrences[bestIdx].item.title}" at "${occurrences[bestIdx].path}"`);
      }
    });

    // Pass 3: Filter hierarchy to remove marked items AND deduplicate same-path items
    function filterItems(items) {
      if (!items || !Array.isArray(items)) return items;

      // First filter by path
      let filtered = items.filter((item) => !itemsToRemove.has(item.path));

      // Then deduplicate items at the same path - prefer items with content
      const pathGroups = new Map(); // pathKey -> array of items
      filtered.forEach((item) => {
        // For text items, include text length and key in the grouping to avoid false duplicates
        let pathKey;
        if (item.type === 'text' && item.text) {
          // Use text length + key to differentiate text items
          pathKey = `${item.type}|${item.path}|${item.key}|${item.text.length}`;
        } else {
          pathKey = `${item.type}|${item.path}`;
        }
        if (!pathGroups.has(pathKey)) {
          pathGroups.set(pathKey, []);
        }
        pathGroups.get(pathKey).push(item);
      });

      // For each group, pick the best item (prefer items with content)
      const itemsToKeep = new Set();
      pathGroups.forEach((groupItems, pathKey) => {
        if (groupItems.length === 1) {
          itemsToKeep.add(groupItems[0]);
        } else {
          // Multiple items with same path - pick the one with content
          let bestItem = groupItems[0];

          // Preserve __jcrOrder from any item that has it
          const itemWithOrder = groupItems.find((item) => typeof item.__jcrOrder === 'number');

          for (const item of groupItems) {
            // Prefer items that have non-empty items array OR text content
            const currentHasItems = item.items && Array.isArray(item.items) && item.items.length > 0;
            const currentHasText = item.type === 'text' && item.text && item.text.trim().length > 0;
            const currentHasContent = currentHasItems || currentHasText;

            const bestHasItems = bestItem.items && Array.isArray(bestItem.items) && bestItem.items.length > 0;
            const bestHasText = bestItem.type === 'text' && bestItem.text && bestItem.text.trim().length > 0;
            const bestHasContent = bestHasItems || bestHasText;

            if (currentHasContent && !bestHasContent) {
              // Current has content, best doesn't - prefer current
              bestItem = item;
            }
            // If both have content or both don't have content, keep the first one (bestItem)
          }

          // Preserve __jcrOrder if any item had it
          if (itemWithOrder && typeof itemWithOrder.__jcrOrder === 'number') {
            bestItem.__jcrOrder = itemWithOrder.__jcrOrder;
          }

          // Log if we're removing an empty duplicate
          if (groupItems.length > 1) {
            const removedCount = groupItems.length - 1;
            const contentDesc = bestItem.type === 'text'
              ? `${bestItem.text?.length || 0} chars of text`
              : `${bestItem.items?.length || 0} items`;
            console.log(`  🔄 Removing ${removedCount} duplicate(s) at path "${bestItem.path}" (keeping the one with ${contentDesc})`);
          }

          itemsToKeep.add(bestItem);
        }
      });

      // Filter to keep only the selected items
      filtered = filtered.filter((item) => itemsToKeep.has(item));

      // Recursively process children
      filtered.forEach((item) => {
        if (item.items) {
          item.items = filterItems(item.items);
        }
      });

      return filtered;
    }

    // First, apply filtering to root-level items themselves
    convertedHierarchy = filterItems(convertedHierarchy);

    // Then apply filtering to nested items within each section
    for (let i = 0; i < convertedHierarchy.length; i++) {
      if (convertedHierarchy[i].items) {
        convertedHierarchy[i].items = filterItems(convertedHierarchy[i].items);
      }
    }

    if (itemsToRemove.size > 0) {
      console.log(`✅ Removed ${itemsToRemove.size} duplicate item(s)`);
    } else {
      console.log('✅ No duplicates found');
    }

    // Sort sections by JCR order to preserve the exact order from the file
    console.log('\n🔀 Sorting sections by JCR order...');
    convertedHierarchy.sort((a, b) => {
      const orderA = typeof a.__jcrOrder === 'number' ? a.__jcrOrder : 9999;
      const orderB = typeof b.__jcrOrder === 'number' ? b.__jcrOrder : 9999;
      return orderA - orderB;
    });
    console.log('✅ Sections sorted to preserve JCR file order');

    // Final pass: Recalculate all paths to ensure consistency
    console.log('\n🔄 Recalculating all paths for consistency...');
    function recalculateAllPaths(items, parentPath = '') {
      return items.map((item) => {
        const updatedItem = { ...item };
        // Build full path from root
        if (parentPath) {
          updatedItem.path = `${parentPath}${PATH_SEPARATOR}${item.title}`;
        } else {
          updatedItem.path = item.title;
        }

        // Recursively update children
        if (updatedItem.items && Array.isArray(updatedItem.items)) {
          updatedItem.items = recalculateAllPaths(updatedItem.items, updatedItem.path);
        }

        return updatedItem;
      });
    }
    convertedHierarchy = recalculateAllPaths(convertedHierarchy);
    console.log('✅ All paths recalculated');

    // Save to file
    const jsonOutputPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
    const hierarchyStructure = {
      title: jcrData['jcr:title'] || '',
      items: convertedHierarchy,
      linkURL: CONTENT_PATH,
    };

    // Add banner images to root level if any found
    if (bannerImages.length > 0) {
      hierarchyStructure.bannerImages = bannerImages;
      console.log(`🖼️  Found ${bannerImages.length} banner image(s):`);
      bannerImages.forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.fileName} (${img.alt || 'No alt text'})`);
      });
    }

    // Sort sections by __jcrOrder (preserves JCR file order for sibling titles)
    if (hierarchyStructure.items) {
      const hasJcrOrder = hierarchyStructure.items.some((item) => item.__jcrOrder !== undefined && item.__jcrOrder !== null);
      if (hasJcrOrder) {
        console.log('🔄 Sorting sections by JCR order...');
        hierarchyStructure.items.sort((a, b) => {
          const orderA = a.__jcrOrder !== undefined && a.__jcrOrder !== null ? a.__jcrOrder : 9999;
          const orderB = b.__jcrOrder !== undefined && b.__jcrOrder !== null ? b.__jcrOrder : 9999;
          return orderA - orderB;
        });
      }
    }

    // Clean up internal metadata before saving
    function removeInternalMetadata(items) {
      if (!items || !Array.isArray(items)) return items;
      items.forEach((item) => {
        delete item['cq:panelTitle']; // Internal metadata only, not needed in output
        delete item.__jcrSection; // Internal metadata only
        delete item.__jcrOrder; // Internal metadata only, used for sorting
        if (item.items) {
          removeInternalMetadata(item.items);
        }
      });
      return items;
    }

    // Remove internal metadata from all sections
    if (hierarchyStructure.items) {
      removeInternalMetadata(hierarchyStructure.items);
    }

    fs.writeFileSync(jsonOutputPath, JSON.stringify(hierarchyStructure, null, 2));
    console.log('✅ Hierarchy extracted successfully!');
    console.log(`💾 JSON structure saved to: ${jsonOutputPath}`);

    console.log('\n📋 OUTPUTS SAVED');
    console.log('===============');
    console.log(`📋 JSON structure: ${jsonOutputPath}`);

    // Display summary
    function countItems(items) {
      let count = items.length;
      items.forEach((item) => {
        if (item.items) {
          count += countItems(item.items);
        }
      });
      return count;
    }

    const totalItems = countItems(mainHierarchy);
    console.log('\n📊 Hierarchy Summary:');
    console.log(`  Total items (including nested): ${totalItems}`);
    console.log(`  Root level items: ${mainHierarchy.length}`);
    if (mainHierarchy.length > 0) {
      console.log(`  First item: "${mainHierarchy[0].title}" (${mainHierarchy[0].type})`);
    }
  } catch (error) {
    console.error(`❌ Failed: ${error.message}`);
    process.exit(1);
  }
}

// Function to build image URL from teaser component
function buildImageUrl(item, itemKey, jcrPath) {
  if (!item.imageResource || !item.imageResource.fileName || !item.imageResource['jcr:lastModified']) {
    return null;
  }

  const { fileName } = item.imageResource;
  const lastModified = item.imageResource['jcr:lastModified'];

  // Extract file extension from the image filename
  const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
  const imageFormat = `coreimg.85.1600.${fileExtension}`;

  // Build the complete image URL with dynamic format, prepend item.id to fileName
  const fileNameWithId = buildFileNameWithId(item.id, fileName);
  return `${BASE_URL}${jcrPath}/${itemKey}.${imageFormat}/${lastModified}/${fileNameWithId}`;
}

// Helper function to determine item type from sling:resourceType
function getItemTypeFromResourceType(item, itemKey = '') {
  const resourceType = item['sling:resourceType'] || '';

  // Map resource type to item type
  if (resourceType.includes('tabs')) {
    return 'tabs';
  }
  if (resourceType.includes('accordion')) {
    return 'accordion';
  }
  if (resourceType.includes('teaser')) {
    return 'teaser';
  }
  if (resourceType.includes('container')) {
    return 'container';
  }
  if (resourceType.includes('button')) {
    return 'button';
  }
  if (resourceType.includes('title')) {
    return 'title';
  }
  if (resourceType.includes('text')) {
    return 'text';
  }
  if (resourceType.includes('image')) {
    return 'image';
  }
  if (resourceType.includes('carousel')) {
    return 'carousel';
  }

  // Fallback to checking key patterns
  if (itemKey.startsWith('accordion')) {
    return 'accordion';
  }
  if (itemKey.startsWith('teaser')) {
    return 'teaser';
  }
  if (itemKey.startsWith('button')) {
    return 'button';
  }

  return 'item';
}

// Extract tabs directly from JCR when Sling Model has no tabs
function extractTabsFromJCR(jcrData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrPathMap, jcrTeaserImageMap) {
  console.log('📖 Extracting tabs from JCR...\n');

  const hierarchy = [];

  // Find all tabs components in JCR
  const tabsComponents = [];
  function findTabsComponents(obj, path = '') {
    if (!obj || typeof obj !== 'object') return;

    if (obj['sling:resourceType'] === 'tccc-dam/components/tabs') {
      tabsComponents.push({ obj, path });
    }

    for (const key in obj) {
      if (typeof obj[key] === 'object' && !key.startsWith(':')) {
        findTabsComponents(obj[key], `${path}/${key}`);
      }
    }
  }

  findTabsComponents(jcrData.root);
  console.log(`🔍 Found ${tabsComponents.length} tabs component(s) in JCR`);

  // Process each tabs component
  tabsComponents.forEach(({ obj: tabsObj, path: tabsPath }) => {
    // Get all tab items (item_1, item_2, etc.)
    const itemsOrder = tabsObj[':itemsOrder'] || Object.keys(tabsObj).filter((k) => !k.startsWith(':') && !k.startsWith('jcr:') && !k.startsWith('cq:') && !k.startsWith('sling:'));

    console.log(`  📂 Processing tabs at ${tabsPath} with ${itemsOrder.length} tab(s)`);

    itemsOrder.forEach((itemKey) => {
      const tabItem = tabsObj[itemKey];
      if (!tabItem || typeof tabItem !== 'object') return;

      const tabTitle = tabItem['cq:panelTitle'] || tabItem['jcr:title'] || itemKey;
      console.log(`    - ${tabTitle}`);

      const tab = {
        title: tabTitle,
        path: tabTitle,
        type: 'tab',
        key: itemKey,
        items: [],
      };

      // Extract all content from this tab (containers, buttons, etc.)
      function extractTabContent(containerObj, parentPath = '') {
        const items = [];

        if (!containerObj || typeof containerObj !== 'object') return items;

        // Check if this is a container with items
        if (containerObj['sling:resourceType'] === 'tccc-dam/components/container' || containerObj[':items']) {
          const contentItems = containerObj[':items'] || containerObj;
          const contentOrder = contentItems[':itemsOrder'] || Object.keys(contentItems).filter((k) => !k.startsWith(':') && !k.startsWith('jcr:') && !k.startsWith('cq:') && !k.startsWith('sling:'));

          contentOrder.forEach((contentKey) => {
            const contentItem = contentItems[contentKey];
            if (!contentItem || typeof contentItem !== 'object') return;

            const resourceType = contentItem[':type'] || contentItem['sling:resourceType'] || '';
            const itemType = getItemTypeFromResourceType(resourceType, contentKey);
            const itemTitle = contentItem['jcr:title'] || contentItem['cq:panelTitle'] || contentKey;
            const itemPath = parentPath ? `${parentPath} >>> ${itemTitle}` : itemTitle;

            const item = {
              title: itemTitle,
              path: itemPath,
              type: itemType,
              key: contentKey,
            };

            // Extract linkSources for buttons
            if (itemType === 'button' && contentItem.linkURL) {
              item.linkSources = {
                clickableUrl: stripHostOnly(contentItem.linkURL),
              };
            }

            // Extract text content
            if (contentItem.text) {
              item.text = stripHostsFromText(contentItem.text);
            }

            // Recursively extract nested items
            if (contentItem[':items'] || contentItem.container) {
              const nestedItems = extractTabContent(contentItem.container || contentItem, itemPath);
              if (nestedItems.length > 0) {
                item.items = nestedItems;
              }
            }

            items.push(item);
          });
        }

        return items;
      }

      // Extract content from the tab's container
      if (tabItem.container) {
        tab.items = extractTabContent(tabItem.container, tabTitle);
      }

      hierarchy.push(tab);
    });
  });

  console.log(`✅ Extracted ${hierarchy.length} tab(s) from JCR\n`);
  return hierarchy;
}

// =============================================================================
// PHASE 1: SLING MODEL EXTRACTION FUNCTIONS
// =============================================================================

/**
 * PHASE 1: Extract hierarchy from Sling Model (tabs.model.json)
 *
 * Extracts structured data from AEM Sling Model:
 * - Tabs and tab panels
 * - Buttons with linkURL/searchLink
 * - Teasers with imageResource
 * - Containers and nested items
 *
 * Rules:
 * - Use :itemsOrder to preserve exact sequence
 * - Extract linkURL and searchLink (priority: Sling > JCR)
 * - Text components: assign text to parent, don't create separate item
 * - NO deduplication at this stage
 */
function parseHierarchyFromModel(modelData, jcrTitleMap, jcrLinkUrlMap, jcrTextMap, jcrData, jcrPathMap, jcrTeaserImageMap) {
  console.log('📖 Parsing hierarchy from combined-tabs.model.json...\n');

  // Function to recursively extract hierarchy from :items
  function extractItemsHierarchy(itemsObj, parentKeyPath = '', displayPath = '', jcrPathMap = {}, jcrTeaserImageMap = {}) {
    if (!itemsObj || typeof itemsObj !== 'object') {
      return [];
    }

    const result = [];
    const itemsOrder = itemsObj[':itemsOrder'] || Object.keys(itemsObj).filter((k) => !k.startsWith(':'));

    itemsOrder.forEach((key) => {
      if (key.startsWith(':')) {
        return;
      }

      const item = itemsObj[key];
      if (!item || typeof item !== 'object') {
        return;
      }

      let title = item['cq:panelTitle'] || item.title || item['jcr:title'] || item.text;

      // Skip tabs/tabs_ components without a custom title - they're just structural
      if (!title && (key === 'tabs' || key.startsWith('tabs_'))) {
        // But still recurse into their nested items, including the structural component in the path
        if (item[':items']) {
          const structuralKeyPath = `${parentKeyPath}/${key}`;
          const childrenItems = extractItemsHierarchy(item[':items'], structuralKeyPath, displayPath, jcrPathMap, jcrTeaserImageMap);
          if (childrenItems.length > 0) {
            result.push(...childrenItems);
          }
        }
        return;
      }

      if (!title) {
        title = key;
      }

      // For text components with HTML content, try to extract a clean title
      if (!title) {
        return;
      }

      if (String(title).includes('<')) {
        // If this is a text component with HTML content, try to extract clean text
        const resourceType = item['sling:resourceType'] || item[':type'] || '';
        if (resourceType.includes('text') && title) {
          // Extract text content from HTML - sanitize to prevent injection
          let cleanTitle = String(title);

          // Iteratively remove all HTML tags (handles nested/malformed HTML)
          // Loop until no more changes occur or max iterations reached
          let prevTitle = '';
          let iterations = 0;
          const maxIterations = 10; // Prevent infinite loops

          while (cleanTitle !== prevTitle && iterations < maxIterations) {
            prevTitle = cleanTitle;
            // Remove any tag-like patterns
            cleanTitle = cleanTitle.replace(/<[^>]*>/g, '');
            iterations += 1;
          }

          // Final sanitization: remove ALL < and > characters to prevent any injection
          // This ensures no HTML can remain regardless of malformed input
          cleanTitle = cleanTitle.replace(/[<>]/g, '').trim();

          if (cleanTitle && cleanTitle.length > 0 && cleanTitle.length < 200) {
            title = cleanTitle;
          } else {
            // If we can't extract clean text, use the component key as title
            title = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
          }
        } else {
          // For non-text components with HTML, skip them
          return;
        }
      }

      // Check if this is a synthetic button container that should be flattened
      if (key.startsWith('button_container_') && title === key) {
        // This is a synthetic container - skip it but process its children
        // Preserve the JCR section metadata from the synthetic container
        if (item[':items']) {
          const childrenItems = extractItemsHierarchy(item[':items'], `${parentKeyPath}/${key}`, displayPath, jcrPathMap, jcrTeaserImageMap);
          if (childrenItems.length > 0) {
            // Transfer the __jcrSection metadata from the synthetic container to its children
            if (item.__jcrSection) {
              childrenItems.forEach((child) => {
                if (!child.__jcrSection) {
                  child.__jcrSection = item.__jcrSection;
                }
              });
            }
            result.push(...childrenItems);
          }
        }
        return;
      }

      // Don't trim - preserve exact spacing from source data
      title = String(title);

      let itemType = 'item';
      // Prioritize :type from Sling Model over sling:resourceType from JCR
      const resourceType = item[':type'] || item['sling:resourceType'] || '';

      if (resourceType.includes('tabs')) {
        itemType = 'tabs';
      } else if (resourceType.includes('accordion')) {
        itemType = 'accordion';
      } else if (resourceType.includes('container')) {
        itemType = 'container';
      } else if (resourceType.includes('text')) {
        itemType = 'text';
      } else if (key.startsWith('teaser_')) {
        itemType = 'teaser';
      }

      // Fallback: infer type from ID pattern if sling:resourceType is missing
      if (itemType === 'item' && item.id) {
        // Check for custom-button- prefix first (before splitting)
        if (item.id.startsWith('custom-button-')) {
          itemType = 'button';
        } else {
          const idPrefix = item.id.split('-')[0];
          if (idPrefix === 'button') itemType = 'button';
          else if (idPrefix === 'accordion') itemType = 'accordion';
          else if (idPrefix === 'tabs') itemType = 'tabs';
          else if (idPrefix === 'container') itemType = 'container';
          else if (idPrefix === 'text') itemType = 'text';
        }
      }

      // Build display path only for output (for user viewing)
      // Avoid duplicates in the path and exclude structural JSON object keys
      const structuralKeys = ['container', 'accordion', 'tabs'];
      const isStructuralKey = structuralKeys.includes(title) || title.startsWith('container_') || title.startsWith('accordion_') || title.startsWith('tabs_');

      let currentDisplayPath = title;
      if (displayPath) {
        // Always append the title to create a full path for this item, unless it's a structural key
        // This ensures every item has its complete path from root, even if it shares a name with ancestors
        if (!isStructuralKey) {
          currentDisplayPath = `${displayPath}${PATH_SEPARATOR}${title}`;
        } else {
          // Skip adding structural segments to path
          currentDisplayPath = displayPath;
        }
      } else {
        // If this is the root level and is a structural key, use empty path
        if (isStructuralKey) {
          currentDisplayPath = '';
        }
      }

      // Build JCR key path for logic (context matching, hierarchy tracking)
      // Make sure it matches the format used in extractTimestampsFromModel
      const currentKeyPath = `${parentKeyPath}/${key}`;

      const hierarchyItem = {
        title,
        path: currentDisplayPath,
        type: itemType,
        key: key.replace(/__tabs\d+$/, ''), // Remove __tabs suffix from key for cleaner output
      };

      if (item.id) {
        hierarchyItem.id = item.id;
      }

      // Preserve cq:panelTitle metadata (used by convertTabContainers to identify tab panels)
      // Note: This is internal metadata and will be removed before saving to JSON
      if (item['cq:panelTitle']) {
        hierarchyItem['cq:panelTitle'] = item['cq:panelTitle'];
      }

      // Preserve JCR section information if available
      if (item.__jcrSection) {
        hierarchyItem.__jcrSection = item.__jcrSection;
      }

      // Use context-aware matching based on JCR key path
      // Extract the immediate parent key (e.g., "/Half Time/container" -> "container")
      const keyPathParts = currentKeyPath.split('/').filter((p) => p);
      const immediateParentKey = keyPathParts.length > 1 ? keyPathParts[keyPathParts.length - 2] : keyPathParts[0];
      const contextKey = `${String(title)}|${immediateParentKey}`;

      // Collect all three URL sources for comparison (keep extensions)
      const itemLinkSources = {};

      // Check if this is a button component (prioritize :type from Sling Model)
      const isButtonComponent = (item[':type'] || item['sling:resourceType']) === 'tccc-dam/components/button';

      // link.url - the actual clickable link in the UI
      if (item.link && item.link.url && isValidLinkURL(item.link.url)) {
        itemLinkSources.clickableUrl = stripHostOnly(item.link.url);
      }

      // linkURL - raw storage format from JCR
      // For button components, linkURL should be treated as clickableUrl
      if (item.linkURL && isValidLinkURL(item.linkURL)) {
        const processedURL = item.linkURL.startsWith('/') ? item.linkURL : stripHostOnly(item.linkURL);
        if (isButtonComponent) {
          // For button components, linkURL is the clickable URL
          if (!itemLinkSources.clickableUrl) {
            itemLinkSources.clickableUrl = processedURL;
          }
        } else {
          itemLinkSources.storageUrl = processedURL;
        }
      }

      // xdm:linkURL - analytics/data layer tracking URL
      // Check nested under item.id first, then direct
      let xdmLinkURL;
      if (item.dataLayer) {
        if (item.id && item.dataLayer[item.id] && item.dataLayer[item.id]['xdm:linkURL']) {
          xdmLinkURL = item.dataLayer[item.id]['xdm:linkURL'];
        } else if (item.dataLayer['xdm:linkURL']) {
          xdmLinkURL = item.dataLayer['xdm:linkURL'];
        }
      }
      if (xdmLinkURL && isValidLinkURL(xdmLinkURL)) {
        itemLinkSources.analyticsUrl = stripHostOnly(xdmLinkURL);
      }

      // imageResource.linkURL - link from image resource metadata
      if (item.imageResource && item.imageResource.linkURL && isValidLinkURL(item.imageResource.linkURL)) {
        itemLinkSources.imageResourceUrl = stripHostOnly(item.imageResource.linkURL);
      }

      // buttonLink.url - for button components, assign to clickableUrl
      if (item.buttonLink && item.buttonLink.url && isValidLinkURL(item.buttonLink.url)) {
        // For button components, buttonLink.url is the clickable URL
        if (!itemLinkSources.clickableUrl) {
          itemLinkSources.clickableUrl = stripHostOnly(item.buttonLink.url);
        }
      }

      // searchLink - for custom-button components, assign to clickableUrl
      // Check Sling Model first, then fall back to JCR if needed
      if (item.searchLink && isValidLinkURL(item.searchLink)) {
        // For custom-button components, searchLink is the clickable URL
        if (!itemLinkSources.clickableUrl) {
          itemLinkSources.clickableUrl = stripHostOnly(item.searchLink);
        }
      } else if (itemType === 'button' && item[':type'] === 'tccc-dam/components/custom-button' && !itemLinkSources.clickableUrl) {
        // For custom-button components, if searchLink is not in Sling Model, check JCR
        // Search for the button by BOTH key AND title in JCR (keys can be reused in different sections)
        function findButtonInJCR(obj, targetKey, targetTitle) {
          if (obj && typeof obj === 'object') {
            if (obj[targetKey]
                && obj[targetKey]['sling:resourceType'] === 'tccc-dam/components/custom-button'
                && obj[targetKey]['jcr:title'] === targetTitle) {
              return obj[targetKey];
            }
            for (const key of Object.keys(obj)) {
              if (typeof obj[key] === 'object') {
                const result = findButtonInJCR(obj[key], targetKey, targetTitle);
                if (result) return result;
              }
            }
          }
          return null;
        }

        const jcrButton = findButtonInJCR(jcrData.root, key, title);
        if (jcrButton && jcrButton.searchLink && isValidLinkURL(jcrButton.searchLink)) {
          itemLinkSources.clickableUrl = stripHostOnly(jcrButton.searchLink);
        }
      }

      // Always check jcrTeaserImageMap for imageResourceUrl (don't overwrite if already exists)
      // For teasers with duplicate keys, also match by title to disambiguate
      for (const [jcrPath, teaserData] of Object.entries(jcrTeaserImageMap)) {
        if (teaserData.modelPath === currentKeyPath && teaserData.linkSources) {
          // If teaser has a title in JCR, ensure it matches the item title
          if (teaserData.teaserTitle && title && teaserData.teaserTitle !== title) {
            continue; // Skip if titles don't match
          }
          // Merge imageResourceUrl if it exists and we don't already have it
          if (teaserData.linkSources.imageResourceUrl && !itemLinkSources.imageResourceUrl) {
            itemLinkSources.imageResourceUrl = teaserData.linkSources.imageResourceUrl;
          }
          // Only use jcrTeaserImageMap as fallback for other fields if not found yet
          if (!itemLinkSources.clickableUrl && teaserData.linkSources.clickableUrl) {
            itemLinkSources.clickableUrl = teaserData.linkSources.clickableUrl;
          }
          if (!itemLinkSources.analyticsUrl && teaserData.linkSources.analyticsUrl) {
            itemLinkSources.analyticsUrl = teaserData.linkSources.analyticsUrl;
          }
          if (!itemLinkSources.storageUrl && teaserData.linkSources.storageUrl) {
            itemLinkSources.storageUrl = teaserData.linkSources.storageUrl;
          }
          break;
        }
      }

      // Add linkSources object if any URL sources exist
      if (Object.keys(itemLinkSources).length > 0) {
        hierarchyItem.linkSources = itemLinkSources;
      }

      // First, check if text content exists directly in the model item
      if (item.text && itemType === 'text') {
        hierarchyItem.text = stripHostsFromText(item.text);
      } else if (item[':items'] && item[':itemsOrder']) {
        // For containers, extract and concatenate text from ALL child text components
        const textComponents = [];
        for (const childKey of item[':itemsOrder']) {
          const child = item[':items'][childKey];
          if (child && (childKey === 'text' || childKey.startsWith('text_')) && child.text) {
            textComponents.push(stripHostsFromText(child.text));
          }
        }
        if (textComponents.length > 0) {
          hierarchyItem.text = textComponents.join('\n');
        }
      }

      // If no text found yet, look up text content using JCR context
      if (!hierarchyItem.text) {
        // Look up text content using JCR context with multiple fallback strategies
        let textContent = null;
        const uniqueContextKey = `${String(title)}|${immediateParentKey}|${currentKeyPath}`;

        // For accordion panel items, ONLY use path-based keys (don't use contextKey which may be overwritten)
        if (itemType === 'container' && immediateParentKey && immediateParentKey.startsWith('accordion') && key === 'item_1' && currentKeyPath) {
          // Search for ALL path-based keys with this parent+title
          const parentContextPattern = `|${immediateParentKey}|`;
          const currentTitle = String(title);
          const pathBasedKeys = Object.keys(jcrTextMap).filter((k) => {
            if (!k.startsWith(`${currentTitle}|`)) return false;
            if (!k.includes(parentContextPattern)) return false;
            const afterParent = k.split(parentContextPattern)[1];
            return afterParent && afterParent.includes('/');
          });

          if (pathBasedKeys.length > 0) {
            // If there are multiple matches, try to find the best match based on path similarity
            if (pathBasedKeys.length > 1) {
              // Extract path segments from currentKeyPath to use for matching
              const pathSegments = currentKeyPath.split('/').filter((s) => s);

              // Score each JCR key based on how many path segments it contains
              const scoredKeys = pathBasedKeys.map((k) => {
                const jcrPath = k.split(parentContextPattern)[1] || '';
                const score = pathSegments.filter((seg) => jcrPath.includes(`/${seg}/`) || jcrPath.includes(`/${seg}`)).length;
                return { key: k, score };
              });

              // Sort by score (descending) and use the best match
              scoredKeys.sort((a, b) => b.score - a.score);
              textContent = jcrTextMap[scoredKeys[0].key];
            } else {
              // Only one match, use it
              textContent = jcrTextMap[pathBasedKeys[0]];
            }
          }
          // Don't fall back to contextKey for accordion items - it's unreliable when there are duplicates
        } else {
          // For non-accordion items, use the regular lookup
          textContent = jcrTextMap[uniqueContextKey] || jcrTextMap[contextKey];
        }

        if (textContent) {
          hierarchyItem.text = stripHostsFromText(textContent);
        } else {
        // Fallback: check if text was stored by key (for text components without titles)
          const textByKey = jcrTextMap[key];
          if (textByKey) {
            hierarchyItem.text = stripHostsFromText(textByKey);
          } else {
          // Also try the key with parent context
            const keyContextKey = `${key}|${immediateParentKey}`;
            const textByKeyContext = jcrTextMap[keyContextKey];
            if (textByKeyContext) {
              hierarchyItem.text = stripHostsFromText(textByKeyContext);
            } else if ((itemType === 'container' || key.startsWith('container')) && (key.startsWith('container') || key === 'container')) {
            // Last fallback: for structural containers, check if this key has orphaned text children
            // e.g., "text_copy_copy_copy__1538611243|container_copy_copy_" when looking for "container_copy_copy_"
              const childrenTextKey = Object.keys(jcrTextMap).find((k) => k.endsWith(`|${key}`));
              if (childrenTextKey) {
                hierarchyItem.text = stripHostsFromText(jcrTextMap[childrenTextKey]);
              }
            }
          }
        }
      }

      // Generate imageUrl for teaser items
      if (itemType === 'teaser') {
        let imageUrl = null;

        // Check if we have image info from model (only teasers with valid imageResource)
        let teaserImageInfo = null;

        // Find JCR entry that has this model path stored
        // First, collect all teasers with matching model path
        const matchingTeasers = Object.entries(jcrTeaserImageMap).filter(
          ([, jcrData]) => jcrData.modelPath === currentKeyPath && (jcrData.hasImageResource || jcrData.linkSources),
        );

        if (matchingTeasers.length > 0) {
          // If only one teaser with this path, use it (even if title doesn't match exactly)
          if (matchingTeasers.length === 1) {
            teaserImageInfo = matchingTeasers[0][1];
          } else {
            // Multiple teasers with same path - use title to disambiguate
            const exactMatch = matchingTeasers.find(([, jcrData]) => jcrData.teaserTitle === title);
            // If exact title match found, use it; otherwise use first one
            teaserImageInfo = exactMatch ? exactMatch[1] : matchingTeasers[0][1];
          }
        }

        if (teaserImageInfo && teaserImageInfo.fileName) {
          const { fileName } = teaserImageInfo;
          const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
          const imageFormat = `coreimg.85.1600.${fileExtension}`;
          const { lastModified } = teaserImageInfo;

          // Build full JCR path
          const jcrPath = `${CONTENT_PATH}/_jcr_content/root${teaserImageInfo.jcrPath}`;

          // Build filename with item ID for uniqueness
          let finalFileName = fileName;
          if (item.id) {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            finalFileName = `${item.id}-${nameWithoutExt}${ext}`;
          }

          imageUrl = `${jcrPath}.${imageFormat}/${lastModified}/${finalFileName}`;
        }

        if (imageUrl) {
          hierarchyItem.imageUrl = imageUrl;
        }
      }

      if (item[':items']) {
        // Check if there's a direct text component child and extract its text to parent
        // Look for ANY child with :type or sling:resourceType = tccc-dam/components/text
        let textChild = null;
        for (const childKey in item[':items']) {
          const child = item[':items'][childKey];
          const childType = child && (child[':type'] || child['sling:resourceType']);
          if (childType === 'tccc-dam/components/text' && child.text) {
            textChild = child;
            break; // Use the first text component found
          }
        }

        if (textChild && textChild.text && !hierarchyItem.text) {
          hierarchyItem.text = stripHostsFromText(textChild.text);
        }

        // Filter out text components - they're now assigned to parent's text field
        const filteredItems = { ...item[':items'] };
        Object.keys(filteredItems).forEach((childKey) => {
          const childItem = filteredItems[childKey];
          // Remove any child that is a text component (check both :type and sling:resourceType)
          const childType = childItem && (childItem[':type'] || childItem['sling:resourceType']);
          if (childType === 'tccc-dam/components/text') {
            delete filteredItems[childKey];
          }
        });

        const childrenItems = extractItemsHierarchy(filteredItems, currentKeyPath, currentDisplayPath, jcrPathMap, jcrTeaserImageMap);
        if (childrenItems.length > 0) {
          hierarchyItem.items = childrenItems;
        }
      }

      // Skip containers with titles starting with "container_" or exactly "container" but still process their children
      // EXCEPTION: If container has text content, keep it (don't unwrap) so text stays assigned to container
      if (itemType === 'container' && title && (String(title).startsWith('container_') || String(title).toLowerCase() === 'container') && !hierarchyItem.text) {
        // Don't add this container to result, but add its children directly (only if no text)
        if (hierarchyItem.items && hierarchyItem.items.length > 0) {
          result.push(...hierarchyItem.items);
        }
      } else {
        result.push(hierarchyItem);
      }
    });

    return result;
  }

  // Extract from root :items
  let mainHierarchy = [];
  if (modelData && modelData[':items']) {
    const rawHierarchy = extractItemsHierarchy(modelData[':items'], '', '', jcrPathMap, jcrTeaserImageMap);

    // Add tabs index tracking to top-level items based on unique keys
    rawHierarchy.forEach((item) => {
      // Extract tabs index from unique key (e.g., "item_1__tabs0" => 0)
      // Find the first child with an id to check its structure
      function findTabsIndexFromItem(obj) {
        if (!obj) return null;
        // Look for properties that indicate which tabs this came from
        if (obj.id && obj.id.includes('__tabs')) {
          const match = obj.id.match(/__tabs(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        // Check children
        if (obj.items && Array.isArray(obj.items)) {
          for (const child of obj.items) {
            const idx = findTabsIndexFromItem(child);
            if (idx !== null) return idx;
          }
        }
        return null;
      }

      const tabsIndex = findTabsIndexFromItem(item);
      if (tabsIndex !== null) {
        item.__tabsIndex = tabsIndex;
      }
    });

    // Function to remove duplicate consecutive containers with the same title
    function removeDuplicateContainers(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        // Recursively process children first
        if (item.items) {
          item.items = removeDuplicateContainers(item.items);
        }

        // Check if this item has a single child with the same title
        if (item.items && item.items.length === 1) {
          const child = item.items[0];

          // If parent and child have the same title and both are containers/items, merge them
          if (item.title === child.title
              && (item.type === 'container' || item.type === 'item')
              && (child.type === 'container' || child.type === 'item')) {
            // Merge: keep the parent but use the child's children
            return {
              ...item,
              items: child.items || [],
              // Preserve any additional properties from child if they don't exist in parent
              ...(child.id && !item.id ? { id: child.id } : {}),
              ...(child.linkURL && !item.linkURL ? { linkURL: child.linkURL } : {}),
              ...(child.imageUrl && !item.imageUrl ? { imageUrl: child.imageUrl } : {}),
              ...(child.text && !item.text ? { text: child.text } : {}),
            };
          }
        }

        return item;
      });
    }

    // Function to clean up duplicate path segments in the final hierarchy
    function cleanupDuplicatePathSegments(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        const updatedItem = { ...item };

        // Clean up duplicates and filter out structural JSON object keys in the path
        if (updatedItem.path) {
          const pathParts = updatedItem.path.split(PATH_SEPARATOR);
          const uniqueParts = [];
          const structuralKeys = ['container', 'accordion', 'tabs'];

          for (const part of pathParts) {
            // Check if this part is a structural key
            const isStructuralKey = structuralKeys.includes(part) || part.startsWith('container_') || part.startsWith('accordion_') || part.startsWith('tabs_');

            // Only add if it's not already in the unique parts array AND is not a structural key
            if (!uniqueParts.includes(part) && !isStructuralKey) {
              uniqueParts.push(part);
            }
          }

          updatedItem.path = uniqueParts.join(PATH_SEPARATOR);
        }

        // Recursively clean up children
        if (updatedItem.items) {
          updatedItem.items = cleanupDuplicatePathSegments(updatedItem.items);
        }

        return updatedItem;
      });
    }

    // Function to unwrap structural containers that don't add semantic value
    function unwrapStructuralContainers(items) {
      if (!items || !Array.isArray(items)) return items;

      return items.map((item) => {
        // If this is a container/item with a single child that's also a container/item, unwrap it
        if (item.items && item.items.length === 1) {
          const child = item.items[0];

          // Only unwrap if:
          // 1. Child is a generic structural container (name-like "container_*", "container", etc.)
          // 2. AND child is NOT a semantic element like "tabs" or "accordion"
          if ((child.type === 'item' || child.type === 'container')
              && (child.title.startsWith('container') || child.title === 'container')
              && child.type !== 'tabs' && child.type !== 'accordion') {
            // Skip the wrapper and promote grandchildren directly to this level
            if (child.items && child.items.length > 0) {
              return {
                ...item,
                items: unwrapStructuralContainers(child.items),
              };
            }
          }
        }

        // Recursively process children
        if (item.items) {
          item.items = unwrapStructuralContainers(item.items);
        }

        return item;
      });
    }

    const cleanedHierarchy = unwrapStructuralContainers(rawHierarchy);
    const deduplicatedHierarchy = removeDuplicateContainers(cleanedHierarchy);
    const groupedHierarchy = groupHierarchyBySections(deduplicatedHierarchy, jcrData);
    mainHierarchy = cleanupDuplicatePathSegments(groupedHierarchy);
  }

  return mainHierarchy;
}

// Function to extract sections from JCR structure
function extractSectionsFromJCR(jcrData) {
  const sections = [];

  if (!jcrData.root || !jcrData.root.container) {
    return null;
  }

  // Recursively search for title components and the containers that follow them
  function searchForTitles(obj, parentPath = '') {
    const foundSections = [];
    const itemsList = [];

    // First pass: collect all direct children in order
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object' && !key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
        itemsList.push({ key, item: obj[key] });
      }
    }

    // Second pass: identify title markers and group subsequent containers
    let currentSection = null;
    itemsList.forEach((entry, index) => {
      const { key, item } = entry;

      // Check if this is a title component (section marker)
      if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
        // Save previous section if exists
        if (currentSection) {
          foundSections.push(currentSection);
        }
        // Start new section with original type
        currentSection = {
          title: item['jcr:title'],
          type: getItemTypeFromResourceType(item, key),
          containerKeys: [],
        };
      } else if (currentSection && (item['sling:resourceType'] === 'tccc-dam/components/container' || item['sling:resourceType'] === 'tccc-dam/components/tabs')) {
        // This container/tabs belongs to the current section
        currentSection.containerKeys.push(key);
      }

      // Recursively search nested items inside containers
      if (item && typeof item === 'object' && item['sling:resourceType'] === 'tccc-dam/components/container') {
        foundSections.push(...searchForTitles(item, `${parentPath}/${key}`));
      }
    });

    if (currentSection) {
      foundSections.push(currentSection);
    }

    return foundSections;
  }

  const foundSections = searchForTitles(jcrData.root.container);

  // Remove duplicates (keep first occurrence of each title)
  const uniqueSections = [];
  const seenTitles = new Set();
  foundSections.forEach((section) => {
    if (!seenTitles.has(section.title)) {
      uniqueSections.push(section);
      seenTitles.add(section.title);
    }
  });

  return uniqueSections.length > 0 ? uniqueSections : null;
}

// Function to group items into sections - try JCR-based grouping first, then fallback
function groupHierarchyBySections(items, jcrData) {
  // Try to extract sections from JCR structure
  let jcrSections = null;
  if (jcrData) {
    jcrSections = extractSectionsFromJCR(jcrData);
    if (jcrSections) {
      console.log('\n🔍 JCR sections detected:', jcrSections.map((s) => s.title).join(', '));
    } else {
      console.log('\n🔍 No JCR sections detected in structure');
    }
  }

  if (jcrSections) {
    const result = groupByJCRSections(items, jcrSections);
    // Only use JCR grouping if it actually produced results
    if (result.length > 0 && result.some((s) => s.items.length > 0)) {
      return result;
    }
  }

  // Fallback: group by first-level path component
  return groupByFirstPathComponent(items);
}

// Group items using JCR section structure
function groupByJCRSections(items, jcrSections) {
  const grouped = [];
  const matchedItems = new Set();

  console.log('\n📋 Grouping by JCR section metadata:');

  jcrSections.forEach((section) => {
    // Find all items that belong to this section based on __jcrSection metadata
    const itemsInSection = items.filter((item) => item.__jcrSection === section.title);

    if (itemsInSection.length > 0) {
      // Mark these items as matched
      itemsInSection.forEach((item) => matchedItems.add(item));

      // Check if section contains only one item with the same title (redundant nesting)
      if (itemsInSection.length === 1
            && itemsInSection[0].title
            && itemsInSection[0].title.trim() === section.title.trim()) {
        // Flatten: use the container directly as the section, but use original type from JCR
        const flattenedItem = { ...itemsInSection[0] };
        delete flattenedItem.__jcrSection;
        flattenedItem.type = section.type || 'section'; // Use original type from JCR
        grouped.push(flattenedItem);
        console.log(`  - ${section.title} (${flattenedItem.items?.length || 0}) [flattened duplicate]`);
      } else {
        // Normal section with multiple items or different titles
        const sectionObj = {
          title: section.title,
          path: section.title,
          type: section.type || 'section', // Use original type from JCR
          items: itemsInSection.map((item) => {
            const updatedItem = { ...item };
            // Remove the internal metadata before output
            delete updatedItem.__jcrSection;

            if (!item.path.startsWith(section.title)) {
              updatedItem.path = `${section.title}${PATH_SEPARATOR}${item.path}`;
            }
            if (item.items && Array.isArray(item.items)) {
              updatedItem.items = item.items.map((child) => {
                const childCopy = { ...child };

                // Check if child path already starts with the updated parent path
                if (childCopy.path && childCopy.path.startsWith(updatedItem.path)) {
                  // Path already correct, no changes needed
                  // Just keep the existing path
                } else if (childCopy.path) {
                  // Child path needs to be updated to include the section prefix
                  childCopy.path = `${updatedItem.path}${PATH_SEPARATOR}${childCopy.path}`;
                }

                if (childCopy.items && Array.isArray(childCopy.items)) {
                  childCopy.items = childCopy.items.map((subchild) => prependPathToItem(subchild, childCopy.path));
                }
                return childCopy;
              });
            }
            return updatedItem;
          }),
        };
        grouped.push(sectionObj);
        console.log(`  - ${section.title} (${itemsInSection.length})`);
      }
    }
  });

  // Include items that didn't match any JCR section
  const unmatchedItems = items.filter((item) => !matchedItems.has(item));
  if (unmatchedItems.length > 0) {
    console.log(`⚠️  Found ${unmatchedItems.length} unmatched items (no JCR section metadata):`);
    unmatchedItems.forEach((item) => {
      console.log(`  - ${item.title} (type: ${item.type})`);
      // Remove __jcrSection metadata if present
      const cleanItem = { ...item };
      delete cleanItem.__jcrSection;
      grouped.push(cleanItem);
    });
  }

  console.log(`  - ${grouped.map((s) => `${s.title} (${s.items?.length || 0})`).join(', ')}\n`);

  return grouped;
}

// Helper function to prepend parent path to items recursively
function prependPathToItem(item, parentPath) {
  const updatedItem = { ...item };

  if (!item.path.startsWith(parentPath)) {
    updatedItem.path = `${parentPath}${PATH_SEPARATOR}${item.path}`;
  }

  if (item.items && Array.isArray(item.items)) {
    updatedItem.items = item.items.map((child) => {
      const childCopy = { ...child };

      // Check if child path already starts with the updated parent path
      if (childCopy.path && childCopy.path.startsWith(updatedItem.path)) {
        // Path already correct, no changes needed
      } else if (childCopy.path) {
        // Child path needs to be updated to include the parent prefix
        childCopy.path = `${updatedItem.path}${PATH_SEPARATOR}${childCopy.path}`;
      }

      if (childCopy.items && Array.isArray(childCopy.items)) {
        childCopy.items = childCopy.items.map((subchild) => prependPathToItem(subchild, childCopy.path));
      }
      return childCopy;
    });
  }

  return updatedItem;
}

// Fallback: group items by first-level path component (data-driven auto-detection)
function groupByFirstPathComponent(items) {
  const sectionMap = new Map();

  items.forEach((item) => {
    let sectionKey = null;
    let sectionTitle = null;

    if (item.path) {
      const pathParts = item.path.split(PATH_SEPARATOR);
      if (pathParts.length > 1) {
        sectionKey = pathParts[0];
        sectionTitle = pathParts[0];
      } else {
        sectionKey = item.title;
        sectionTitle = item.title;
      }
    } else {
      sectionKey = item.title;
      sectionTitle = item.title;
    }

    if (!sectionMap.has(sectionKey)) {
      sectionMap.set(sectionKey, {
        title: sectionTitle,
        items: [],
      });
    }

    sectionMap.get(sectionKey).items.push(item);
  });

  const grouped = Array.from(sectionMap.values()).map((section) => {
    // Check if section contains only one item with the same title (redundant nesting)
    if (section.items.length === 1
          && section.items[0].title
          && section.items[0].title.trim() === section.title.trim()) {
      // Flatten: use the container directly, preserving its original type
      const flattenedItem = { ...section.items[0] };
      // Keep the original type instead of forcing 'section'
      return flattenedItem;
    }
    // Normal section with multiple items or different titles
    return {
      title: section.title,
      path: section.title,
      type: 'section',
      items: section.items,
    };
  });

  console.log('\n📋 Auto-detected sections (data-driven from path):');
  grouped.forEach((section) => {
    const itemCount = section.items ? section.items.length : 0;
    const flattened = !section.items ? ' [flattened duplicate]' : '';
    console.log(`  - ${section.title} (${itemCount} items)${flattened}`);
  });
  console.log();

  return grouped.map((section) => {
    // If section was flattened (no items array), return as-is
    if (!section.items) {
      return section;
    }

    // Normal section processing
    return {
      ...section,
      items: section.items.map((item) => {
        if (!item.path.startsWith(section.title)) {
          return prependPathToItem(item, section.title);
        }
        return item;
      }),
    };
  });
}

// Extract banner image from JCR
function extractBannerImage(jcrData, contentPath) {
  function findImageComponents(obj, path = '') {
    const results = [];

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}/${key}` : key;

      if (typeof value === 'object' && value !== null) {
        // Check if this is an image component with fileName
        if (value['sling:resourceType'] === 'tccc-dam/components/image' && value.fileName) {
          const lastModified = value['jcr:lastModified'] || value.file?.['jcr:lastModified'] || value.file?.['jcr:created'];
          const timestamp = lastModified ? new Date(lastModified).getTime() : null;

          if (timestamp) {
            // Fix path construction: ensure /root is included
            const jcrPath = currentPath.replace(/^root/, '_jcr_content/root');

            // Extract extension from filename and use it in coreimg format
            const lastDotIndex = value.fileName.lastIndexOf('.');
            const fileExt = lastDotIndex > 0 ? value.fileName.slice(lastDotIndex + 1) : 'png';
            const imageFormat = `coreimg.${fileExt}`;

            // Sanitize filename using utility function
            const sanitizedFileName = sanitizeFileName(value.fileName);

            const imageUrl = `${contentPath}/${jcrPath}.${imageFormat}/${timestamp}/${sanitizedFileName}`;

            results.push({
              path: currentPath,
              fileName: value.fileName,
              imageUrl,
              alt: value.alt,
              resourceType: value['sling:resourceType'],
              lastModified,
              timestamp,
            });
          }
        }

        // Recurse into nested objects
        results.push(...findImageComponents(value, currentPath));
      }
    }

    return results;
  }

  return findImageComponents(jcrData);
}

// =============================================================================
// PHASE 1: JCR EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Helper: Detect if a container has a carousel component
 */
function hasCarouselComponent(container) {
  if (!container || typeof container !== 'object') {
    return false;
  }

  // eslint-disable-next-line guard-for-in
  for (const key in container) {
    const item = container[key];
    if (item && typeof item === 'object') {
      if (item['sling:resourceType'] === 'tccc-dam/components/carousel') {
        return true;
      }
    }
  }
  return false;
}

/**
 * PHASE 1: Extract non-tabs content from JCR
 *
 * Extracts standalone sections that exist outside tabs components:
 * - Title components → section headers
 * - Buttons, teasers, containers → section items
 * - Text components → assigned to parent container (not as separate items)
 *
 * Rules:
 * - Preserve exact order using __jcrOrder
 * - Skip carousel and tabs containers (handled separately)
 * - Group orphaned content into "Other Content" section
 * - NO deduplication at this stage
 */
function extractNonTabsContent(jcrData, jcrTeaserImageMap = {}) {
  const sections = [];
  const processedRootContainerKeys = new Set(); // Track all root container keys that are part of sections

  if (!jcrData.root || !jcrData.root.container) {
    return sections;
  }

  // Helper to recursively find containers with title components and their subsequent sibling containers
  function scanForSections(parentContainer, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return [];

    const foundSections = [];

    // Get all child keys in order
    const childKeys = Object.keys(parentContainer).filter((key) => {
      const item = parentContainer[key];
      return item
        && typeof item === 'object'
        && !key.startsWith('jcr:')
        && !key.startsWith('cq:')
        && !key.startsWith('sling:');
    });

    let currentTitle = null;
    let contentContainers = [];
    let precedingUntitledContainers = []; // Track untitled containers BEFORE first title

    for (const key of childKeys) {
      const child = parentContainer[key];
      const resourceType = child['sling:resourceType'];

      // Check if this child container has a DIRECT title component child (not recursive)
      let titleComp = null;
      const allTitlesInContainer = [];
      if (child && resourceType === 'tccc-dam/components/container') {
        // Look for immediate child title component(s) in their JCR order
        const childKeys = Object.keys(child).filter(
          (k) => !k.startsWith('jcr:') && !k.startsWith('cq:') && !k.startsWith('sling:'),
        );

        for (const childKey of childKeys) {
          const grandchild = child[childKey];
          if (grandchild && typeof grandchild === 'object'
              && grandchild['sling:resourceType'] === 'tccc-dam/components/title'
              && grandchild['jcr:title']) {
            allTitlesInContainer.push(grandchild);
          }
        }

        // Set titleComp to the first title for backward compatibility
        if (allTitlesInContainer.length === 1) {
          titleComp = allTitlesInContainer[0];
        } else if (allTitlesInContainer.length > 1) {
          // Multiple titles found - will create nested structure
          titleComp = allTitlesInContainer[0];
        }
      }

      if (titleComp && titleComp['jcr:title']) {
        // Found the first title!
        // Extract any preceding untitled containers as standalone sections
        if (!currentTitle && precedingUntitledContainers.length > 0) {
          for (const untitledContainer of precedingUntitledContainers) {
            foundSections.push({
              title: null, // Will be handled during extraction
              containers: [untitledContainer],
            });
          }
          precedingUntitledContainers = [];
        }

        // Save previous section if exists
        if (currentTitle && contentContainers.length > 0) {
          foundSections.push({
            title: currentTitle,
            containers: contentContainers,
          });
        }

        // Start new section - include the container WITH the title PLUS containers after
        currentTitle = titleComp;
        contentContainers = [child]; // Include the container that has the title

        // Handle nested titles (multiple titles in same container)
        if (allTitlesInContainer.length > 1) {
          // Store nested titles for special handling during conversion
          currentTitle.nestedTitles = allTitlesInContainer.slice(1); // All titles except the first

          // Mark nested titles so they won't be extracted as separate items
          for (const nestedTitle of currentTitle.nestedTitles) {
            nestedTitle.__isNestedTitle = true;
          }

          console.log(`  🔗 Found ${allTitlesInContainer.length} nested titles: ${allTitlesInContainer.map((t) => t['jcr:title']).join(' > ')}`);
        }
      } else if (currentTitle) {
        // This is content after a title - add to current section
        if (resourceType === 'tccc-dam/components/container') {
          contentContainers.push(child);
        }
      } else {
        // No title yet - either recursively search or save as preceding untitled container
        if (resourceType === 'tccc-dam/components/container') {
          // Always recursively search for nested sections
          const nested = scanForSections(child, depth + 1, maxDepth);
          if (nested.length > 0) {
            // Found nested sections - add them directly
            foundSections.push(...nested);
          } else {
            // No nested sections - save as preceding untitled container (only if no titles found yet)
            precedingUntitledContainers.push(child);
          }
        }
      }
    }

    // Don't forget last section
    if (currentTitle && contentContainers.length > 0) {
      foundSections.push({
        title: currentTitle,
        containers: contentContainers,
      });
    }

    return foundSections;
  }

  // Scan for all sections
  const detectedSections = scanForSections(jcrData.root.container);

  // Track which root-level containers are part of detected sections
  function markContainersAsProcessed(parentContainer, sectionsToMark) {
    const rootContainerKeys = Object.keys(parentContainer).filter(
      (key) => !key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:'),
    );

    for (const section of sectionsToMark) {
      for (const container of section.containers) {
        // Find the root-level key for this container
        for (const rootKey of rootContainerKeys) {
          if (parentContainer[rootKey] === container
              || isNestedWithin(container, parentContainer[rootKey])) {
            processedRootContainerKeys.add(rootKey);
            break;
          }
        }
      }
    }
  }

  // Helper to check if a container is nested within a parent
  function isNestedWithin(needle, haystack) {
    if (needle === haystack) return true;
    if (!haystack || typeof haystack !== 'object') return false;

    for (const key in haystack) {
      if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;
      const child = haystack[key];
      if (child && typeof child === 'object') {
        if (isNestedWithin(needle, child)) return true;
      }
    }
    return false;
  }

  markContainersAsProcessed(jcrData.root.container, detectedSections);

  // Helper function to collect all container keys recursively (including nested)
  function collectAllContainerKeys(container, collectedKeys = new Set()) {
    if (!container || typeof container !== 'object') return collectedKeys;

    for (const key in container) {
      if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;

      const child = container[key];
      if (child && typeof child === 'object') {
        const resourceType = child['sling:resourceType'];
        if (resourceType === 'tccc-dam/components/container') {
          // This is a container - recursively collect its nested containers
          collectAllContainerKeys(child, collectedKeys);
        }
      }
    }

    return collectedKeys;
  }

  // Convert to hierarchy format with JCR order
  // The detectedSections array is already in the correct order from the JCR file,
  // so we just assign __jcrOrder sequentially
  let orderIndex = 0;
  for (const section of detectedSections) {
    // Handle untitled sections (null title)
    if (!section.title) {
      // Extract items from untitled containers and add them directly as root-level items
      const untitledItems = [];
      for (const container of section.containers) {
        extractComponentsFromContainer(container, untitledItems, '', jcrTeaserImageMap);
      }

      // Add each item as a root-level section
      for (const item of untitledItems) {
        const jcrOrder = orderIndex++;
        console.log(`📦 Completed untitled section "${item.title}" (__jcrOrder: ${jcrOrder})`);
        sections.push({
          ...item,
          path: item.title || item.path || 'Untitled',
          items: item.items || [], // Ensure items array exists
          __jcrOrder: jcrOrder,
        });
      }
      continue;
    }

    const titleText = section.title['jcr:title'];

    // Skip sections that contain carousel components (e.g., "What's New")
    const hasCarousel = section.containers.some((container) => hasCarouselComponent(container));
    if (hasCarousel) {
      console.log(`⏭️  Skipping carousel section: "${titleText}"`);
      continue;
    }

    const sectionItems = [];

    // Extract content from all containers in this section
    for (const container of section.containers) {
      extractComponentsFromContainer(container, sectionItems, titleText, jcrTeaserImageMap);
    }

    // Handle nested titles (e.g., "Meals With Fanta" > "Snacks")
    if (section.title.nestedTitles && section.title.nestedTitles.length > 0) {
      // Create nested structure: outer title -> inner title(s) -> content
      let currentNested = null;

      // Build from innermost to outermost
      for (let i = section.title.nestedTitles.length - 1; i >= 0; i--) {
        const nestedTitle = section.title.nestedTitles[i];
        const nestedTitleText = nestedTitle['jcr:title'];
        const nestedPath = currentNested
          ? `${titleText} >>> ${nestedTitleText}`
          : nestedTitleText;

        currentNested = {
          title: nestedTitleText,
          path: currentNested ? `${titleText} >>> ${currentNested.path}` : `${titleText} >>> ${nestedTitleText}`,
          type: getItemTypeFromResourceType(nestedTitle),
          items: currentNested ? [currentNested] : sectionItems,
        };
      }

      // Outer section contains the nested structure
      const jcrOrder = orderIndex++;
      console.log(`📦 Completed nested section "${titleText}" > "${section.title.nestedTitles.map((t) => t['jcr:title']).join(' > ')}" with ${sectionItems.length} item(s) (__jcrOrder: ${jcrOrder})`);
      sections.push({
        title: titleText,
        path: titleText,
        type: getItemTypeFromResourceType(section.title),
        items: currentNested ? [currentNested] : [],
        __jcrOrder: jcrOrder,
      });
    } else {
      // Normal section (no nested titles)
      const jcrOrder = orderIndex++;
      console.log(`📦 Completed section "${titleText}" with ${sectionItems.length} item(s) (__jcrOrder: ${jcrOrder})`);
      sections.push({
        title: titleText,
        path: titleText,
        type: getItemTypeFromResourceType(section.title),
        items: sectionItems,
        __jcrOrder: jcrOrder, // Assign JCR order sequentially
      });
    }
  }

  return { sections, processedRootContainerKeys };
}

// Extract missing top-level sections from JCR that aren't in Sling Model
function extractMissingSectionsFromJCR(jcrData, existingSectionTitles = [], mainHierarchy = [], jcrTeaserImageMap = {}, alreadyProcessedKeys = new Set()) {
  const missingSections = [];

  if (!jcrData.root || !jcrData.root.container) {
    return missingSections;
  }

  // Find all title components at depth 2 (section level)
  const rootContainer = jcrData.root.container;
  const processedContainers = new Set(alreadyProcessedKeys); // Start with already processed keys

  // Get ordered list of root container keys (preserves JCR file order)
  const rootContainerKeys = Object.keys(rootContainer).filter(
    (key) => !key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:'),
  );

  let sectionOrderCounter = 0; // Track order in which sections are discovered

  // FIRST PASS: Detect containers with multiple sibling titles (like Tea store: "TEA STOREs", "Global Growth Information")
  // and extract any missing empty title sections
  for (const containerKey of rootContainerKeys) {
    const container = rootContainer[containerKey];

    if (!container || typeof container !== 'object') continue;

    // Check if this container has multiple direct title children (sibling titles)
    const directTitles = [];
    for (const childKey in container) {
      const child = container[childKey];
      if (child && typeof child === 'object'
            && child['sling:resourceType'] === 'tccc-dam/components/title'
            && child['jcr:title']) {
        directTitles.push(child['jcr:title']);
      }
    }

    // If we found multiple sibling titles, assign __jcrOrder and extract any missing
    if (directTitles.length >= 2) {
      console.log(`  🔍 Found ${directTitles.length} sibling title(s) in ${containerKey}: ${directTitles.join(', ')}`);

      // For sibling titles, assign __jcrOrder to both extracted and existing sections
      for (let i = 0; i < directTitles.length; i++) {
        const titleText = directTitles[i];
        const titleOrder = sectionOrderCounter++;

        if (existingSectionTitles.includes(titleText)) {
          // Update __jcrOrder for existing section
          const existingSection = mainHierarchy.find((s) => s.title === titleText);
          if (existingSection) {
            console.log(`  🔄 Setting __jcrOrder for existing section "${titleText}": ${titleOrder}`);
            existingSection.__jcrOrder = titleOrder;
          }
        } else {
          console.log(`  📦 Extracting empty sibling title section: "${titleText}" (__jcrOrder: ${titleOrder})`);
          missingSections.push({
            title: titleText,
            path: titleText,
            type: 'title',
            items: [],
            __jcrOrder: titleOrder,
          });
        }
      }
      processedContainers.add(containerKey);
    }
  }

  // SECOND PASS: Look for nested container with title (original logic)
  for (const containerKey in rootContainer) {
    const container = rootContainer[containerKey];

    if (!container || typeof container !== 'object') continue;
    if (containerKey.startsWith('jcr:') || containerKey.startsWith('cq:') || containerKey.startsWith('sling:')) continue;

    // Skip if already processed in first pass (sibling titles)
    if (processedContainers.has(containerKey)) continue;

    for (const nestedKey in container) {
      const nestedContainer = container[nestedKey];

      if (!nestedContainer || typeof nestedContainer !== 'object') continue;
      if (nestedKey.startsWith('jcr:') || nestedKey.startsWith('cq:') || nestedKey.startsWith('sling:')) continue;

      // Look for title component in this nested container
      for (const titleKey in nestedContainer) {
        const titleComp = nestedContainer[titleKey];

        if (titleComp && typeof titleComp === 'object'
              && titleComp['sling:resourceType'] === 'tccc-dam/components/title'
              && titleComp['jcr:title']) {
          const sectionTitle = titleComp['jcr:title'];

          // Skip if this section already exists in Sling Model
          if (existingSectionTitles.includes(sectionTitle)) {
            console.log(`  ⏭️  Skipping "${sectionTitle}" (already in Sling Model)`);
            processedContainers.add(containerKey);
            continue;
          }

          // Skip if this section contains a carousel component
          if (hasCarouselComponent(nestedContainer)) {
            console.log(`  ⏭️  Skipping carousel section: "${sectionTitle}"`);
            processedContainers.add(containerKey);
            continue;
          }

          console.log(`  📦 Extracting missing section from JCR: "${sectionTitle}"`);

          // Extract all content from the parent container
          const sectionItems = [];
          extractContentFromContainer(container, sectionItems, sectionTitle, jcrTeaserImageMap);

          if (sectionItems.length > 0) {
            missingSections.push({
              title: sectionTitle,
              path: sectionTitle,
              type: 'title', // Section type
              items: sectionItems,
            });
          }
          processedContainers.add(containerKey);
        }
      }
    }
  }

  // Extract standalone components (buttons, teasers) that aren't within any titled section
  // Always check for orphaned standalone components (teasers, buttons in containers without titles)
  // even if non-tabs sections exist, as there may be content in untitled containers
  console.log('  🔍 Checking for standalone components in JCR...');

  // Build a set of all keys/IDs AND unique signatures that already exist in the hierarchy to avoid duplicates
  const existingKeys = new Set();
  const existingSignatures = new Set(); // For buttons: key+url signature
  function collectExistingKeys(items) {
    if (!items || !Array.isArray(items)) return;
    items.forEach((item) => {
      if (item.key) existingKeys.add(item.key);
      if (item.id) existingKeys.add(item.id);
      // For buttons, create a unique signature from key + URL
      if (item.type === 'button' && item.linkSources) {
        const url = item.linkSources.clickableUrl || item.linkSources.searchLink || '';
        if (url) {
          existingSignatures.add(`${item.key}-${url}`);
        }
      }
      if (item.items) collectExistingKeys(item.items);
    });
  }
  collectExistingKeys(mainHierarchy);
  // Note: We DON'T collect from missingSections here because we want to allow
  // duplicate keys/signatures WITHIN JCR (only deduplicate between JCR and Sling Model)

  // Build a map of container keys to their JCR order
  const containerOrder = {};
  let orderIndex = 0;
  for (const containerKey in rootContainer) {
    const container = rootContainer[containerKey];
    if (!container || typeof container !== 'object') continue;
    if (containerKey.startsWith('jcr:') || containerKey.startsWith('cq:') || containerKey.startsWith('sling:')) continue;
    containerOrder[containerKey] = orderIndex++;
  }

  const standaloneItems = [];
  let firstOrphanedContainerOrder = null; // Track the order of the first container with orphaned content

  for (const containerKey in rootContainer) {
    const container = rootContainer[containerKey];

    if (!container || typeof container !== 'object') continue;
    if (containerKey.startsWith('jcr:') || containerKey.startsWith('cq:') || containerKey.startsWith('sling:')) continue;
    if (processedContainers.has(containerKey)) continue; // Skip containers we already processed as sections

    // Extract any buttons or teasers from this container
    const items = [];
    extractContentFromContainer(container, items, 'Other Content', jcrTeaserImageMap);

    // Filter out items that already exist in the hierarchy
    const uniqueItems = items.filter((item) => {
      const itemKey = item.key || item.id;

      // For buttons, check both key and unique signature (key+URL)
      if (item.type === 'button' && item.linkSources) {
        const url = item.linkSources.clickableUrl || item.linkSources.searchLink || '';
        if (url) {
          const signature = `${item.key}-${url}`;
          if (existingSignatures.has(signature)) {
            console.log(`  ⏭️  Skipping duplicate standalone component: "${item.title}" (key: ${itemKey}, signature matched)`);
            return false;
          }
        }
      }

      // For non-buttons or buttons without URLs, check by key/ID only
      if (itemKey && existingKeys.has(itemKey)) {
      // Additional check for tabs/teasers/accordions: they should have been extracted already if they're real duplicates
        if (item.type === 'tab' || item.type === 'teaser' || item.type === 'accordion') {
          console.log(`  ⏭️  Skipping duplicate standalone component: "${item.title}" (key: ${itemKey})`);
          return false;
        }
      }
      return true;
    });

    if (uniqueItems.length > 0) {
      console.log(`  📦 Found ${uniqueItems.length} unique standalone component(s) in container "${containerKey}" (${items.length - uniqueItems.length} duplicates skipped)`);
      standaloneItems.push(...uniqueItems);

      // Track the order of the first container with orphaned content
      if (firstOrphanedContainerOrder === null && containerOrder[containerKey] !== undefined) {
        firstOrphanedContainerOrder = containerOrder[containerKey];
      }
    }
  }

  // If we found any standalone items, add them as a section with proper JCR order
  // Use fractional order to ensure it sorts correctly relative to titled sections in the same container group
  if (standaloneItems.length > 0) {
    const otherContentOrder = firstOrphanedContainerOrder !== null ? (firstOrphanedContainerOrder - 0.5) : 9999;
    console.log(`  📦 Creating "Other Content" section with ${standaloneItems.length} item(s) (__jcrOrder: ${otherContentOrder})`);

    // DEBUG: Check all items in standaloneItems
    console.log('     📋 Other Content items:');
    standaloneItems.forEach((item, idx) => {
      console.log(`       ${idx + 1}. ${item.title} (${item.type})`);
      if (item.items) {
        item.items.forEach((child, childIdx) => {
          console.log(`          ${childIdx + 1}. ${child.title} (${child.type})`);
          if (child.title === 'Airplane') {
            console.log(`             Text starts: ${(child.text || '').substring(0, 120)}...`);
          }
        });
      }
    });

    missingSections.push({
      title: 'Other Content',
      path: 'Other Content',
      type: 'container',
      items: standaloneItems,
      __jcrOrder: otherContentOrder,
    });
  }

  return missingSections;
}

// Extract all content (tabs, accordions, buttons, teasers, text) from a JCR container
function extractContentFromContainer(container, items, parentTitle, jcrTeaserImageMap = {}) {
  if (!container || typeof container !== 'object') return;

  for (const key in container) {
    if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;

    const component = container[key];
    if (!component || typeof component !== 'object') continue;

    const resourceType = component['sling:resourceType'];
    if (!resourceType) continue;

    // Handle tabs components
    if (resourceType === 'tccc-dam/components/tabs') {
      const tabs = extractTabsFromTabsComponent(component, parentTitle, jcrTeaserImageMap);
      items.push(...tabs);
    }
    // Handle accordion components
    else if (resourceType === 'tccc-dam/components/accordion') {
      const accordion = extractAccordionFromComponent(component, key, parentTitle);
      if (accordion) items.push(accordion);
    }
    // Handle button components (both button and custom-button)
    else if (resourceType === 'tccc-dam/components/button' || resourceType === 'tccc-dam/components/custom-button') {
      const button = extractButtonFromComponent(component, key, parentTitle);
      if (button) items.push(button);
    }
    // Handle teaser components
    else if (resourceType === 'tccc-dam/components/teaser') {
      const teaser = extractTeaserFromComponent(component, key, parentTitle, jcrTeaserImageMap);
      if (teaser) items.push(teaser);
    }
    // Extract text components as standalone items with type 'text'
    else if (resourceType === 'tccc-dam/components/text' && component.text) {
      items.push({
        title: 'Text',
        path: `${parentTitle}${PATH_SEPARATOR}Text`,
        type: 'text',
        key,
        text: stripHostsFromText(component.text),
      });
      continue;
    }
    // Handle container components
    else if (resourceType === 'tccc-dam/components/container') {
      // Check if container has text children - if so, extract container with text assigned
      let containerText = null;
      let hasNonTextChildren = false;
      for (const childKey in component) {
        if (childKey.startsWith('jcr:') || childKey.startsWith('cq:') || childKey.startsWith('sling:')) continue;
        const child = component[childKey];
        if (child && typeof child === 'object') {
          const childResourceType = child['sling:resourceType'];
          if (childResourceType === 'tccc-dam/components/text' && child.text) {
            if (!containerText) {
              containerText = child.text;
            } else {
              containerText += `\n${child.text}`;
            }
          } else if (childResourceType) {
            // Container has non-text children (buttons, accordions, etc.)
            hasNonTextChildren = true;
          }
        }
      }

      if (containerText && !hasNonTextChildren) {
        // Container has ONLY text - extract as type 'text' not 'container'
        const strippedText = stripHostsFromText(containerText);
        items.push({
          title: 'Text',
          path: `${parentTitle}${PATH_SEPARATOR}Text`,
          type: 'text',
          key,
          text: strippedText,
        });
      } else {
        // Container has no text OR has mixed content - recursively process children
        // NOTE: If container has mixed content, each child will be extracted separately
        // Text children will be extracted as Text items, non-text children as their respective types
        extractContentFromContainer(component, items, parentTitle, jcrTeaserImageMap);
      }
    }
  }
}

// Extract tabs from a tabs component
function extractTabsFromTabsComponent(tabsComponent, parentTitle, jcrTeaserImageMap = {}) {
  const tabs = [];

  for (const key in tabsComponent) {
    if (key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) continue;
    if (key === ':type' || key === ':itemsOrder') continue;

    const tabItem = tabsComponent[key];
    if (!tabItem || typeof tabItem !== 'object') continue;

    const tabTitle = tabItem['cq:panelTitle'] || tabItem['jcr:title'] || key;
    const tabPath = `${parentTitle} >>> ${tabTitle}`;

    const tabItems = [];
    extractContentFromContainer(tabItem, tabItems, tabPath, jcrTeaserImageMap);

    if (tabTitle === ':06') {
      console.log(`  🔍 :06 tab extracted ${tabItems.length} items:`);
      tabItems.forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.title} (${item.type}) - has text: ${!!item.text}`);
        if (item.text) {
          console.log(`        Text starts: ${item.text.substring(0, 80)}...`);
        }
      });
    }

    tabs.push({
      title: tabTitle,
      path: tabPath,
      type: 'tab',
      key,
      items: tabItems,
    });
  }

  return tabs;
}

// Extract accordion from component
function extractAccordionFromComponent(accordionComp, key, parentTitle) {
  const accordionTitle = accordionComp['cq:panelTitle'] || accordionComp['jcr:title'] || key;
  const accordionItems = [];

  // Extract text from accordion panels
  for (const panelKey in accordionComp) {
    if (panelKey.startsWith('jcr:') || panelKey.startsWith('cq:') || panelKey.startsWith('sling:')) continue;
    if (panelKey === ':type' || panelKey === ':itemsOrder') continue;

    const panel = accordionComp[panelKey];
    if (!panel || typeof panel !== 'object') continue;

    const panelTitle = panel['cq:panelTitle'] || panel['jcr:title'] || panelKey;

    // Extract text from panel
    let panelText = '';
    let textComponentCount = 0;
    for (const textKey in panel) {
      // Skip JCR/CQ/Sling properties
      if (textKey.startsWith('jcr:') || textKey.startsWith('cq:') || textKey.startsWith('sling:')) continue;
      const textComp = panel[textKey];
      if (textComp && typeof textComp === 'object'
            && textComp['sling:resourceType'] === 'tccc-dam/components/text'
            && textComp.text) {
        textComponentCount++;
        const textPreview = textComp.text.substring(0, 80);
        console.log(`  🔍 Accordion panel "${panelTitle}" collecting text #${textComponentCount} from child "${textKey}": ${textPreview}...`);
        panelText += (panelText ? '\n\n' : '') + textComp.text;
      }
    }
    if (panelTitle === 'Airplane') {
      console.log(`  📊 Airplane panel collected ${textComponentCount} text component(s), total length: ${panelText.length}`);
    }

    if (panelText) {
      const accordionItem = {
        title: panelTitle,
        path: `${parentTitle} >>> ${accordionTitle} >>> ${panelTitle}`,
        type: 'accordion',
        key: panelKey,
        text: panelText,
      };
      if (panelTitle === 'Airplane') {
        console.log(`  ✅ Created Airplane accordion with text starting: ${panelText.substring(0, 100)}...`);
      }
      accordionItems.push(accordionItem);
    }
  }

  if (accordionItems.length > 0) {
    return {
      title: accordionTitle,
      path: `${parentTitle} >>> ${accordionTitle}`,
      type: 'accordion',
      key,
      items: accordionItems,
    };
  }

  return null;
}

// Extract button from component
function extractButtonFromComponent(buttonComp, key, parentTitle) {
  const buttonText = buttonComp.text || buttonComp['jcr:title'] || 'Button';
  const linkURL = buttonComp.linkURL || buttonComp.searchLink; // custom-button uses searchLink

  const button = {
    title: buttonText,
    path: `${parentTitle} >>> ${buttonText}`,
    type: 'button',
    key,
  };

  if (linkURL) {
    button.linkSources = {
      clickableUrl: stripHostOnly(linkURL),
    };
  }

  return button;
}

// Extract teaser from component
function extractTeaserFromComponent(teaserComp, key, parentTitle, jcrTeaserImageMap = {}) {
  const teaserTitle = teaserComp['jcr:title'] || key;
  const linkURL = teaserComp.linkURL;

  const teaser = {
    title: teaserTitle,
    path: `${parentTitle} >>> ${teaserTitle}`,
    type: 'teaser',
    key,
    id: `teaser-${createDeterministicId(teaserTitle + key)}`,
  };

  if (linkURL) {
    teaser.linkSources = {
      clickableUrl: stripHostOnly(linkURL),
    };
  }

  // Construct imageUrl from jcrTeaserImageMap
  let imageUrl = null;
  // Find this teaser in the map by matching the key AND title (to handle duplicate keys)
  // First, collect all teasers with matching key
  const matchingTeasers = Object.entries(jcrTeaserImageMap).filter(
    ([, teaserData]) => teaserData.teaserKey === key && teaserData.fileName,
  );

  if (matchingTeasers.length > 0) {
    let selectedTeaser = null;

    // If only one teaser with this key, use it (even if title doesn't match exactly)
    if (matchingTeasers.length === 1) {
      selectedTeaser = matchingTeasers[0];
    } else {
      // Multiple teasers with same key - use title to disambiguate
      selectedTeaser = matchingTeasers.find(([, teaserData]) => teaserData.teaserTitle === teaser.title);
      // If no exact title match, use the first one as fallback
      if (!selectedTeaser) {
        selectedTeaser = matchingTeasers[0];
      }
    }

    if (selectedTeaser) {
      const [jcrPath, teaserData] = selectedTeaser;
      const { fileName, lastModified } = teaserData;
      const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
      const imageFormat = `coreimg.85.1600.${fileExtension}`;

      // Build full JCR path
      const fullJcrPath = `${CONTENT_PATH}/_jcr_content/root${teaserData.jcrPath}`;

      // Build filename with item ID for uniqueness
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
      const ext = fileName.substring(fileName.lastIndexOf('.'));
      const finalFileName = `${teaser.id}-${nameWithoutExt}${ext}`;

      imageUrl = `${fullJcrPath}.${imageFormat}/${lastModified}/${finalFileName}`;
    }
  }

  if (imageUrl) {
    teaser.imageUrl = imageUrl;
  }

  return teaser;
}

// Helper to find a title component in a container (searches recursively)
function findTitleComponent(obj, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return null;

  for (const key in obj) {
    if (!key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
      const item = obj[key];
      if (item && typeof item === 'object') {
        // Check if this is a title component
        if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
          return item;
        }

        // Recursively search in nested containers
        if (item['sling:resourceType'] === 'tccc-dam/components/container') {
          const found = findTitleComponent(item, depth + 1, maxDepth);
          if (found) return found;
        }
      }
    }
  }
  return null;
}

// Find section-level title component (one with cq:styleIds, not generic headers)
function findSectionTitleComponent(obj, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return null;

  const GENERIC_TITLE_PATTERN = /^[A-Z\s]+$/; // Match all-caps titles like "TEA STOREs"
  const foundTitles = [];

  for (const key in obj) {
    if (!key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
      const item = obj[key];
      if (item && typeof item === 'object') {
        // Check if this is a title component
        if (item['sling:resourceType'] === 'tccc-dam/components/title' && item['jcr:title']) {
          foundTitles.push(item);
        }

        // Recursively search in nested containers (but don't go too deep)
        if (depth < 1 && item['sling:resourceType'] === 'tccc-dam/components/container') {
          const found = findSectionTitleComponent(item, depth + 1, maxDepth);
          if (found) foundTitles.push(found);
        }
      }
    }
  }

  // Prefer titles with cq:styleIds and non-generic text
  // Generic = mostly uppercase (e.g., "TEA STOREs", "GLOBAL ASSETS")
  const titlesWithStyle = foundTitles.filter((title) => {
    const titleStyleIds = title['cq:styleIds'];
    return titleStyleIds && Array.isArray(titleStyleIds) && titleStyleIds.length > 0;
  });

  if (titlesWithStyle.length > 0) {
    // Among styled titles, prefer ones that are NOT mostly uppercase
    const nonGenericTitles = titlesWithStyle.filter((title) => {
      const titleText = title['jcr:title'];
      // Check if title is mostly uppercase (>70% uppercase letters)
      const letters = titleText.replace(/[^a-zA-Z]/g, '');
      const uppercaseCount = (titleText.match(/[A-Z]/g) || []).length;
      const isMostlyUppercase = letters.length > 0 && (uppercaseCount / letters.length) > 0.7;
      return !isMostlyUppercase;
    });

    if (nonGenericTitles.length > 0) {
      return nonGenericTitles[0]; // Return first non-generic styled title
    }

    // If all styled titles are generic, return the last one (often more specific)
    return titlesWithStyle[titlesWithStyle.length - 1];
  }

  // Fallback: return first title found
  return foundTitles.length > 0 ? foundTitles[0] : null;
}

// Helper to extract components (buttons, teasers, etc.) from a container
function extractComponentsFromContainer(container, items, sectionTitle, jcrTeaserImageMap = {}) {
  for (const key in container) {
    if (!key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
      const component = container[key];
      if (component && typeof component === 'object') {
        const resourceType = component['sling:resourceType'];

        // Extract buttons (both button and custom-button)
        if (resourceType === 'tccc-dam/components/button' || resourceType === 'tccc-dam/components/custom-button') {
          const buttonTitle = component['jcr:title'] || key;
          const buttonItem = {
            title: buttonTitle,
            path: `${sectionTitle}${PATH_SEPARATOR}${buttonTitle}`,
            type: 'button',
            key,
            id: `button-${createDeterministicId(buttonTitle + key)}`,
          };

          // Extract URL sources
          // For button components, linkURL should be treated as clickableUrl
          // For custom-button components, use searchLink
          const buttonUrl = component.searchLink || component.linkURL;
          if (buttonUrl) {
            buttonItem.linkSources = {
              clickableUrl: stripHostOnly(buttonUrl),
            };
          }

          items.push(buttonItem);
        }

        // Extract accordions
        if (resourceType === 'tccc-dam/components/accordion') {
          // Extract accordion panels
          for (const panelKey in component) {
            if (panelKey.startsWith('item_') && component[panelKey]) {
              const panel = component[panelKey];
              const panelTitle = panel['cq:panelTitle'] || panel['jcr:title'] || panelKey;
              const accordionItem = {
                title: panelTitle,
                path: `${sectionTitle}${PATH_SEPARATOR}${panelTitle}`,
                type: 'accordion',
                key: panelKey,
                id: `accordion-${createDeterministicId(panelTitle + panelKey)}`,
              };

              // Extract text from the panel (look for text components)
              let panelText = '';
              for (const textKey in panel) {
                if (textKey.startsWith('text') && panel[textKey] && panel[textKey].text) {
                  if (panelText) panelText += '\n';
                  panelText += panel[textKey].text;
                }
              }
              if (panelText) {
                accordionItem.text = stripHostsFromText(panelText);
              }

              items.push(accordionItem);
            }
          }
        }

        // Extract teasers
        if (resourceType === 'tccc-dam/components/teaser') {
          const teaserTitle = component['jcr:title'] || key;
          const teaserItem = {
            title: teaserTitle,
            path: `${sectionTitle}${PATH_SEPARATOR}${teaserTitle}`,
            type: 'teaser',
            key,
            id: `teaser-${createDeterministicId(teaserTitle + key)}`,
          };

          // Extract URL sources from teaser
          const linkSources = {};
          if (component.linkURL) {
            linkSources.clickableUrl = stripHostOnly(component.linkURL);
          }
          if (Object.keys(linkSources).length > 0) {
            teaserItem.linkSources = linkSources;
          }

          // Construct imageUrl from jcrTeaserImageMap
          let imageUrl = null;
          // Find this teaser in the map by matching the key AND title (to handle duplicate keys)
          // First, collect all teasers with matching key
          const matchingTeasers = Object.entries(jcrTeaserImageMap).filter(
            ([, teaserData]) => teaserData.teaserKey === key && teaserData.fileName,
          );

          if (matchingTeasers.length > 0) {
            let selectedTeaser = null;

            // If only one teaser with this key, use it (even if title doesn't match exactly)
            if (matchingTeasers.length === 1) {
              selectedTeaser = matchingTeasers[0];
            } else {
              // Multiple teasers with same key - use title to disambiguate
              selectedTeaser = matchingTeasers.find(([, teaserData]) => teaserData.teaserTitle === teaserItem.title);
              // If no exact title match, use the first one as fallback
              if (!selectedTeaser) {
                selectedTeaser = matchingTeasers[0];
              }
            }

            if (selectedTeaser) {
              const [jcrPath, teaserData] = selectedTeaser;
              const { fileName, lastModified } = teaserData;
              const fileExtension = fileName.substring(fileName.lastIndexOf('.') + 1);
              const imageFormat = `coreimg.85.1600.${fileExtension}`;

              // Build full JCR path
              const fullJcrPath = `${CONTENT_PATH}/_jcr_content/root${teaserData.jcrPath}`;

              // Build filename with item ID for uniqueness
              const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
              const ext = fileName.substring(fileName.lastIndexOf('.'));
              const finalFileName = `${teaserItem.id}-${nameWithoutExt}${ext}`;

              imageUrl = `${fullJcrPath}.${imageFormat}/${lastModified}/${finalFileName}`;
            }
          }

          if (imageUrl) {
            teaserItem.imageUrl = imageUrl;
          }

          items.push(teaserItem);
        }

        // Extract text components as standalone items with type 'text'
        if (resourceType === 'tccc-dam/components/text' && component.text) {
          items.push({
            title: 'Text',
            path: `${sectionTitle}${PATH_SEPARATOR}Text`,
            type: 'text',
            key,
            text: stripHostsFromText(component.text),
          });
          continue;
        }

        // Handle container components
        if (resourceType === 'tccc-dam/components/container') {
          // Check if container has text children - if so, extract container with text assigned
          let containerText = null;
          let hasNonTextChildren = false;
          for (const childKey in component) {
            if (!childKey.startsWith('jcr:') && !childKey.startsWith('cq:') && !childKey.startsWith('sling:')) {
              const child = component[childKey];
              if (child && typeof child === 'object') {
                const childResourceType = child['sling:resourceType'];
                if (childResourceType === 'tccc-dam/components/text' && child.text) {
                  if (!containerText) {
                    containerText = child.text;
                  } else {
                    containerText += `\n${child.text}`;
                  }
                } else if (childResourceType) {
                  // Container has non-text children (buttons, accordions, etc.)
                  hasNonTextChildren = true;
                }
              }
            }
          }

          if (containerText && !hasNonTextChildren) {
            // Container has ONLY text - extract as type 'text' not 'container'
            const strippedText = stripHostsFromText(containerText);
            items.push({
              title: 'Text',
              path: `${sectionTitle}${PATH_SEPARATOR}Text`,
              type: 'text',
              key,
              text: strippedText,
            });
          } else {
            // Container has no text OR has mixed content - recursively search for other content
            extractComponentsFromContainer(component, items, sectionTitle, jcrTeaserImageMap);
          }
        }
      }
    }
  }
}

// Helper function to remove a parent title from paths
function removeParentFromPath(path, parentTitle) {
  if (!path || !parentTitle) return path;

  const separator = ' >>> ';
  const pathParts = path.split(separator);

  // Filter out the parent title from the path
  const filteredParts = pathParts.filter((part) => part !== parentTitle);

  return filteredParts.join(separator);
}

// Unwrap accordion items but keep their children
function unwrapAccordionItems(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  unwrapAccordionItems: Stopping recursion at depth ${depth}`);
    return items;
  }

  const result = [];

  items.forEach((item) => {
    // Skip items with specific titles that should not be included
    const skipTitles = ['Content Store Request Form'];
    if (item.title && skipTitles.includes(item.title)) {
      // Skip this item entirely (don't add to result)
      return;
    }

    // Skip items with specific text content (boilerplate/instructional text)
    if (item.text && item.text.includes('Explore tabs below to access various content')) {
      // Skip this item entirely (don't add to result)
      return;
    }

    // If item title starts with '{type}_', 'item_', or equals '{type}', skip it but keep its children
    // This handles wrappers like 'accordion_', 'button_', 'teaser_', 'item_*', etc.
    const shouldUnwrap = item.title
        && (item.title.startsWith('item_')
            || (item.type && (item.title.startsWith(`${item.type}_`) || item.title === item.type)));

    if (shouldUnwrap) {
      if (item.items && item.items.length > 0) {
        // Recursively unwrap children and add them directly
        const unwrappedChildren = unwrapAccordionItems(item.items, depth + 1);

        // Remove the skipped parent's title from all children's paths
        const updatedChildren = unwrappedChildren.map((child) => {
          const updatedChild = { ...child };

          // Update the child's path to remove the parent title
          if (updatedChild.path) {
            updatedChild.path = removeParentFromPath(updatedChild.path, item.title);
          }

          // Recursively update paths of nested children
          if (updatedChild.items && Array.isArray(updatedChild.items)) {
            const updateNestedPaths = (nestedItems) => nestedItems.map((nestedItem) => {
              const updated = { ...nestedItem };
              if (updated.path) {
                updated.path = removeParentFromPath(updated.path, item.title);
              }
              if (updated.items && Array.isArray(updated.items)) {
                updated.items = updateNestedPaths(updated.items);
              }
              return updated;
            });
            updatedChild.items = updateNestedPaths(updatedChild.items);
          }

          return updatedChild;
        });

        // If the wrapper itself had text, it should have been extracted as a separate item during JCR extraction
        // Unwrap the children without merging wrapper text into them
        result.push(...updatedChildren);
      } else if (item.text && item.text.trim()) {
        // Keep text-only items even if they're named like wrappers (e.g., "text_copy_copy_copy_")
        // because they contain meaningful content
        result.push(item);
      }
      // Skip wrapper items with no children and no text entirely
      // These are structural metadata with no content
    } else {
      // Keep the item and recursively process its children
      if (item.items) {
        item.items = unwrapAccordionItems(item.items, depth + 1);
      }
      result.push(item);
    }
  });

  return result;
}

// Function to detect and convert accordion items (containers with only text content)
function convertAccordionContainers(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  convertAccordionContainers: Stopping recursion at depth ${depth}`);
    return items;
  }

  return items.map((item) => {
    const updatedItem = { ...item };

    // Pattern detection: Convert container to accordion if:
    // 1. Type is "container"
    // 2. Has cq:panelTitle (strong indicator of accordion panel)
    // 3. Key matches accordion item patterns (item_1, item_copy, etc.)
    // 4. Has direct text content (text components are merged into parent)
    // 5. Does NOT have child items (if it has children, it's a tab, not an accordion)
    if (
      updatedItem.type === 'container'
      && updatedItem['cq:panelTitle']
      && updatedItem.key
      && (updatedItem.key.match(/^item_\d+$/) || updatedItem.key.match(/^item_copy/))
      && updatedItem.text
      && (!updatedItem.items || updatedItem.items.length === 0)
    ) {
      updatedItem.type = 'accordion';
    }

    // Recursively process children
    if (updatedItem.items) {
      updatedItem.items = convertAccordionContainers(updatedItem.items, depth + 1);
    }

    return updatedItem;
  });
}

// Function to detect and convert tab panel items (containers with nested items or with cq:panelTitle)
function convertTabContainers(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  convertTabContainers: Stopping recursion at depth ${depth}`);
    return items;
  }

  return items.map((item) => {
    const updatedItem = { ...item };

    // Pattern detection: Convert container to tab if:
    // 1. Type is "container"
    // 2. Has nested items (structural grouping), OR
    // 3. Has cq:panelTitle metadata (indicates it's a tab panel, even if empty now - items might be added from JCR)
    // EXCEPTION: Don't convert if it has text content and matches accordion patterns (it's an accordion, not a tab)
    // Note: No key pattern restriction - any container with nested items is a structural tab
    if (
      updatedItem.type === 'container'
      && (
        (updatedItem.items && updatedItem.items.length > 0)
        || updatedItem['cq:panelTitle']
      )
    ) {
      // Check if this looks like an accordion panel (has text + cq:panelTitle + accordion key pattern + NO children)
      // Items with children should be tabs, even if they have text
      const isAccordionPattern = updatedItem['cq:panelTitle']
        && updatedItem.key
        && (updatedItem.key.match(/^item_\d+$/) || updatedItem.key.match(/^item_copy/))
        && updatedItem.text
        && (!updatedItem.items || updatedItem.items.length === 0);

      if (!isAccordionPattern) {
        updatedItem.type = 'tab';
      }
    }

    // Recursively process children
    if (updatedItem.items) {
      updatedItem.items = convertTabContainers(updatedItem.items, depth + 1);
    }

    return updatedItem;
  });
}

// Function to extract text from tabs/accordions that have both text and children
// The text should be moved to a separate "Text" child item
function extractTextFromTabsWithChildren(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  extractTextFromTabsWithChildren: Stopping recursion at depth ${depth}`);
    return items;
  }

  return items.map((item) => {
    const updatedItem = { ...item };

    // Check if this is a tab/accordion with both text and children
    if (
      (updatedItem.type === 'tab' || updatedItem.type === 'accordion')
      && updatedItem.text
      && updatedItem.items
      && updatedItem.items.length > 0
    ) {
      // Extract the text as a separate "Text" child item at the beginning
      const textItem = {
        title: 'Text',
        path: `${updatedItem.path} >>> Text`,
        type: 'text',
        text: updatedItem.text,
      };

      // Add the text item at the beginning of the children
      updatedItem.items = [textItem, ...updatedItem.items];

      // Remove the text from the parent
      delete updatedItem.text;
    }

    // Recursively process children
    if (updatedItem.items) {
      updatedItem.items = extractTextFromTabsWithChildren(updatedItem.items, depth + 1);
    }

    return updatedItem;
  });
}

// Function to convert containers with only text (and no children) to type 'text'
// This runs AFTER accordion and tab resolution, so we don't accidentally convert those
function convertTextContainers(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  convertTextContainers: Stopping recursion at depth ${depth}`);
    return items;
  }

  return items.map((item) => {
    const updatedItem = { ...item };

    // Convert container to 'text' if:
    // 1. Still type 'container' (not already converted to accordion/tab)
    // 2. Has text content
    // 3. Has no children (or empty children array)
    if (
      updatedItem.type === 'container'
      && updatedItem.text
      && (!updatedItem.items || updatedItem.items.length === 0)
    ) {
      updatedItem.type = 'text';
      updatedItem.title = 'Text';
    }

    // Recursively process children
    if (updatedItem.items) {
      updatedItem.items = convertTextContainers(updatedItem.items, depth + 1);
    }

    return updatedItem;
  });
}

// Function to filter out empty containers (no items, no text, no meaningful content)
function filterEmptyContainers(items, depth = 0) {
  if (!items || !Array.isArray(items)) return items;

  // Safeguard against infinite recursion
  if (depth > 100) {
    console.warn(`⚠️  filterEmptyContainers: Stopping recursion at depth ${depth}`);
    return items;
  }

  return items
    .filter((item) => {
      // Keep if not a container
      if (item.type !== 'container') return true;

      // Filter out empty containers (no items, no text)
      if (
        (!item.items || item.items.length === 0)
        && !item.text
      ) {
        console.log(`⚠️  Filtering out empty container: "${item.title}" (key: ${item.key})`);
        return false;
      }

      return true;
    })
    .map((item) => {
      // Recursively filter children
      if (item.items) {
        return { ...item, items: filterEmptyContainers(item.items, depth + 1) };
      }
      return item;
    });
}

// Find all tabs paths in JCR recursively
function findAllTabsPaths(node, currentPath = '', found = []) {
  if (!node || typeof node !== 'object') {
    return found;
  }

  const keys = Object.keys(node);

  keys.forEach((key) => {
    const item = node[key];
    if (!item || typeof item !== 'object') {
      return;
    }

    const resourceType = item['sling:resourceType'] || '';
    const newPath = currentPath ? `${currentPath}/${key}` : key;

    // Found a tabs component
    if (resourceType.includes('tabs')) {
      const fullPath = `/jcr:content/${newPath}`;
      found.push(fullPath);
    }

    // Keep searching
    findAllTabsPaths(item, newPath, found);
  });

  return found;
}

// Function to find containers that contain button components (for sections like "Brand Materials")
function findAllButtonContainerPaths(node, currentPath = '', found = []) {
  if (!node || typeof node !== 'object') {
    return found;
  }

  const keys = Object.keys(node);

  keys.forEach((key) => {
    const item = node[key];
    if (!item || typeof item !== 'object') {
      return;
    }

    const resourceType = item['sling:resourceType'] || '';
    const newPath = currentPath ? `${currentPath}/${key}` : key;

    // Found a container component - check if it contains buttons (including custom-button)
    if (resourceType === 'tccc-dam/components/container') {
      const hasButtons = Object.values(item).some((child) => child && typeof child === 'object'
        && (child['sling:resourceType'] === 'tccc-dam/components/button'
            || child['sling:resourceType'] === 'tccc-dam/components/custom-button'));

      if (hasButtons) {
        const fullPath = `/jcr:content/${newPath}`;
        found.push(fullPath);
      }
    }

    // Keep searching
    findAllButtonContainerPaths(item, newPath, found);
  });

  return found;
}

// Function to extract button components from JCR containers
function extractButtonsFromContainer(jcrData, containerPath) {
  // Navigate to the container in JCR data
  // Path format: /jcr:content/container/... but jcrData structure is { root: { container: ... } }
  // So we need to start from jcrData.root
  const pathParts = containerPath.replace('/jcr:content/', '').split('/');
  let current = jcrData.root || jcrData; // Start from root if it exists

  for (const part of pathParts) {
    if (current && current[part]) {
      current = current[part];
    } else {
      return [];
    }
  }

  if (!current || typeof current !== 'object') {
    return [];
  }

  // Extract all button components from this container
  const buttons = [];

  function extractButtonsRecursively(obj, currentPath = '') {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach((key) => {
      const item = obj[key];
      if (!item || typeof item !== 'object') return;

      const resourceType = item['sling:resourceType'] || '';
      const newPath = currentPath ? `${currentPath}/${key}` : key;

      // Found a button or custom-button component
      if (resourceType === 'tccc-dam/components/button' || resourceType === 'tccc-dam/components/custom-button') {
        // Create deterministic ID based on button properties
        const title = item['jcr:title'] || key;
        const idSource = `${title}-${key}-${containerPath}`;
        const deterministicId = createDeterministicId(idSource);

        const button = {
          id: `custom-button-${deterministicId}`,
          title,
          type: 'button',
          key,
        };

        // Add URL sources if present and valid
        // For button components, linkURL should be treated as clickableUrl
        // For custom-button components, use searchLink
        const buttonUrl = item.searchLink || item.linkURL;
        if (buttonUrl && isValidLinkURL(buttonUrl)) {
          button.linkSources = {
            clickableUrl: stripHostOnly(buttonUrl),
          };
        }

        buttons.push(button);
      }

      // Recurse into nested objects
      extractButtonsRecursively(item, newPath);
    });
  }

  extractButtonsRecursively(current);
  return buttons;
}

// Helper to find all accordion paths in JCR
function findAllAccordionPaths(jcrRoot) {
  const accordionPaths = [];

  function traverse(obj, currentPath = '/jcr:content') {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
      const item = obj[key];
      if (!item || typeof item !== 'object') continue;

      const newPath = `${currentPath}/${key}`;
      const resourceType = item['sling:resourceType'] || '';

      // Check if this is an accordion component
      if (resourceType === 'tccc-dam/components/accordion') {
        accordionPaths.push(newPath);
      }

      // Recurse into children
      if (!key.startsWith(':') && !key.startsWith('jcr:') && !key.startsWith('cq:') && !key.startsWith('sling:')) {
        traverse(item, newPath);
      }
    }
  }

  traverse(jcrRoot);
  return accordionPaths;
}

// Helper to extract accordion panels with their titles and text from JCR
function extractTextFromAccordion(jcrData, accordionPath) {
  // Navigate to the accordion in JCR data
  const pathParts = accordionPath.replace('/jcr:content/', '').split('/');
  let current = jcrData.root || jcrData;

  for (const part of pathParts) {
    if (current && current[part]) {
      current = current[part];
    } else {
      return null;
    }
  }

  if (!current || typeof current !== 'object') {
    return null;
  }

  // Extract each accordion panel separately
  const panels = [];

  Object.keys(current).forEach((key) => {
    const item = current[key];
    if (!item || typeof item !== 'object') return;

    // Skip metadata properties
    if (key.startsWith(':') || key.startsWith('jcr:') || key.startsWith('cq:') || key.startsWith('sling:')) return;

    // Check if this is an accordion panel (container with cq:panelTitle)
    const panelTitle = item['cq:panelTitle'] || item['jcr:title'];
    if (panelTitle) {
      // Extract all text from this panel
      const textParts = [];

      function extractTextRecursively(obj) {
        if (!obj || typeof obj !== 'object') return;

        Object.keys(obj).forEach((subKey) => {
          const subItem = obj[subKey];
          if (!subItem || typeof subItem !== 'object') return;

          const resourceType = subItem['sling:resourceType'] || '';

          // Found a text component
          if (resourceType === 'tccc-dam/components/text' && subItem.text) {
            textParts.push(subItem.text);
          }

          // Recurse into nested objects
          extractTextRecursively(subItem);
        });
      }

      extractTextRecursively(item);

      if (textParts.length > 0) {
        panels.push({
          title: panelTitle,
          text: stripHostsFromText(textParts.join('\n')),
          key,
        });
      }
    }
  });

  return panels.length > 0 ? panels : null;
}

// Function to download all imageUrls
async function downloadAllImages(hierarchyData, outputDir) {
  const fs = require('fs');
  const path = require('path');
  const https = require('https');

  // Extract all imageUrls from hierarchy
  function extractImageUrls(obj) {
    const urls = [];
    function traverse(item) {
      if (item.imageUrl) {
        urls.push(item.imageUrl);
      }
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((i) => traverse(i));
      }
    }
    if (Array.isArray(obj)) {
      obj.forEach((item) => traverse(item));
    }
    return urls;
  }

  const imageUrls = extractImageUrls(hierarchyData);
  console.log(`\n🖼️  Found ${imageUrls.length} images to download`);

  // Create images directory
  const imagesDir = path.join(outputDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  let downloaded = 0;
  let failed = 0;
  const failedUrls = []; // Track failed URLs for final report

  // Download function with fallback mechanism
  function downloadImage(imageUrl, index) {
    return new Promise((resolve) => {
      // Extract original filename once at the start
      const originalUrlParts = imageUrl.split('/');
      const originalFilename = originalUrlParts[originalUrlParts.length - 1];
      const originalSafeFilename = sanitizeFileName(originalFilename);

      // Helper function to attempt download with a specific URL
      function attemptDownload(urlToTry, isRetry = false) {
        // Prepend AEM_AUTHOR to the imageUrl
        const fullUrl = AEM_AUTHOR + urlToTry;

        // Always use the original filename, even when using fallback URL
        const safeFilename = originalSafeFilename;
        const filePath = path.join(imagesDir, safeFilename);

        // Skip if file already exists
        if (fs.existsSync(filePath)) {
          console.log(`⏭️  Skipping ${safeFilename} (already exists)`);
          downloaded++;
          resolve();
          return;
        }

        const file = fs.createWriteStream(filePath);

        const request = https.get(fullUrl, {
          headers: {
            Cookie: AUTHOR_AUTH_COOKIE,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        }, (response) => {
        // Clear timeout since we got a response
          request.setTimeout(0);

          // Handle redirects (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
            file.close();
            fs.unlinkSync(filePath); // Delete empty file

            let redirectUrl = response.headers.location;

            // If redirect URL is relative, make it absolute
            if (!redirectUrl.startsWith('http')) {
              const urlObj = new URL(fullUrl);
              redirectUrl = `https://${urlObj.hostname}${redirectUrl}`;
            }

            console.log(`🔄 Following redirect: ${fullUrl} -> ${redirectUrl}`);

            // Check if redirect is to a login page (authentication expired)
            if (redirectUrl.includes('/libs/granite/core/content/login')) {
              failed++;
              failedUrls.push({ url: fullUrl, reason: 'Authentication expired (redirected to login page)', filename: safeFilename });
              console.log('❌ Authentication expired - redirect to login page detected');
              resolve();
              return;
            }

            // Follow the redirect
            const redirectRequest = https.get(redirectUrl, {
              headers: {
                Cookie: AUTHOR_AUTH_COOKIE,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              },
            }, (redirectResponse) => {
              if (redirectResponse.statusCode === 200) {
                const redirectFile = fs.createWriteStream(filePath);
                redirectResponse.pipe(redirectFile);
                redirectFile.on('finish', () => {
                  redirectFile.close();
                  downloaded++;
                  console.log(`✅ Downloaded ${redirectUrl} -> ${safeFilename}`);
                  resolve();
                });
              } else {
                // If redirect failed with 404 and this is the first attempt, try fallback URL
                if (!isRetry && redirectResponse.statusCode === 404) {
                  console.log(`❌ Failed redirect ${redirectUrl} (HTTP ${redirectResponse.statusCode}) - trying fallback...`);

                  // Create fallback URL by removing teaser-{id}- prefix from filename
                  const fallbackUrl = createFallbackUrl(urlToTry);
                  if (fallbackUrl && fallbackUrl !== urlToTry) {
                    console.log(`🔄 Trying fallback: ${fallbackUrl}`);
                    attemptDownload(fallbackUrl, true);
                    return;
                  }

                  // No fallback available, log final failure
                  console.log(`❌ No fallback available for ${redirectUrl}`);
                }

                failed++;
                failedUrls.push({ url: redirectUrl, reason: `HTTP ${redirectResponse.statusCode} (after redirect)`, filename: safeFilename });
                console.log(`❌ Failed redirect ${redirectUrl} (HTTP ${redirectResponse.statusCode})`);
                resolve();
              }
            }).on('error', (err) => {
              failed++;
              failedUrls.push({ url: redirectUrl, reason: `Network error on redirect: ${err.message}`, filename: safeFilename });
              console.log(`❌ Network error on redirect ${redirectUrl}: ${err.message}`);
              resolve();
            });

            // Set timeout for redirect request
            redirectRequest.setTimeout(30000, () => {
              redirectRequest.destroy();
              failed++;
              failedUrls.push({ url: redirectUrl, reason: 'Timeout on redirect (server not responding)', filename: safeFilename });
              console.log(`❌ Timeout on redirect ${redirectUrl} (server not responding)`);
              resolve();
            });
          } else if (response.statusCode === 200) {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              downloaded++;
              console.log(`✅ Downloaded ${fullUrl} -> ${safeFilename}`);
              resolve();
            });
          } else {
          // Handle other non-200 status codes (404, 403, etc.)
            file.close();
            fs.unlinkSync(filePath); // Delete empty file

            // If this is the first attempt and we got a 404, try fallback URL
            if (!isRetry && response.statusCode === 404) {
              console.log(`❌ Failed ${fullUrl} (HTTP ${response.statusCode}) - trying fallback...`);

              // Create fallback URL by removing teaser-{id}- prefix from filename
              const fallbackUrl = createFallbackUrl(urlToTry);
              if (fallbackUrl && fallbackUrl !== urlToTry) {
                console.log(`🔄 Trying fallback: ${fallbackUrl}`);
                attemptDownload(fallbackUrl, true);
                return;
              }
            }

            failed++;
            failedUrls.push({ url: fullUrl, reason: `HTTP ${response.statusCode}`, filename: safeFilename });
            console.log(`❌ Failed ${fullUrl} (HTTP ${response.statusCode})`);
            resolve();
          }
        }).on('error', (err) => {
        // Clear timeout since we got an error response
          request.setTimeout(0);

          // Handle network errors (connection refused, DNS errors, etc.)
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Delete empty file
          }

          // If this is the first attempt, try fallback URL
          if (!isRetry) {
            console.log(`❌ Network error ${fullUrl}: ${err.message} - trying fallback...`);

            // Create fallback URL by removing teaser-{id}- prefix from filename
            const fallbackUrl = createFallbackUrl(urlToTry);
            if (fallbackUrl && fallbackUrl !== urlToTry) {
              console.log(`🔄 Trying fallback: ${fallbackUrl}`);
              attemptDownload(fallbackUrl, true);
              return;
            }
          }

          failed++;
          failedUrls.push({ url: fullUrl, reason: `Network error: ${err.message}`, filename: safeFilename });
          console.log(`❌ Network error ${fullUrl}: ${err.message}`);
          resolve();
        });

        // Set timeout for network issues (server not responding)
        request.setTimeout(30000, () => {
          request.destroy();
          file.close();
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          // If this is the first attempt, try fallback URL
          if (!isRetry) {
            console.log(`❌ Timeout ${fullUrl} (server not responding) - trying fallback...`);

            // Create fallback URL by removing teaser-{id}- prefix from filename
            const fallbackUrl = createFallbackUrl(urlToTry);
            if (fallbackUrl && fallbackUrl !== urlToTry) {
              console.log(`🔄 Trying fallback: ${fallbackUrl}`);
              attemptDownload(fallbackUrl, true);
              return;
            }
          }

          failed++;
          failedUrls.push({ url: fullUrl, reason: 'Timeout (server not responding)', filename: safeFilename });
          console.log(`❌ Timeout ${fullUrl} (server not responding)`);
          resolve();
        });
      }

      // Helper function to create fallback URL by removing teaser-{id}- prefix and 85.1600. pattern
      function createFallbackUrl(originalUrl) {
        // First, remove 85.1600. from the entire URL path
        let fallbackUrl = originalUrl.replace(/85\.1600\./g, '');

        // Then, try to remove teaser-{id}- prefix from filename
        const urlParts = fallbackUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        // Check if filename has teaser-{id}- prefix pattern
        const teaserMatch = filename.match(/^teaser-[a-f0-9]+-(.+)$/);
        if (teaserMatch) {
          // Replace the filename with the version without teaser prefix
          const fallbackFilename = teaserMatch[1];
          urlParts[urlParts.length - 1] = fallbackFilename;
          fallbackUrl = urlParts.join('/');
        }

        // Return the fallback URL if it's different from the original
        return fallbackUrl !== originalUrl ? fallbackUrl : null;
      }

      // Start with the original URL
      attemptDownload(imageUrl);
    });
  }

  // Download all images in parallel for maximum speed
  console.log('🚀 Starting parallel downloads...');

  // Create all download promises
  const downloadPromises = imageUrls.map((url, index) => downloadImage(url, index + 1));

  // Wait for all downloads to complete
  await Promise.all(downloadPromises);

  console.log('✅ All parallel downloads completed!');

  console.log('\n🎉 Download complete!');
  console.log(`   ✅ Successfully downloaded: ${downloaded}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
  }
  console.log(`   📁 Images saved to: ${imagesDir}`);

  // Log all failed URLs
  if (failedUrls.length > 0) {
    console.log('\n❌ FAILED DOWNLOADS:');
    console.log('==================');

    // Check if any failures are due to authentication expiration
    const authFailures = failedUrls.filter((f) => f.reason.includes('Authentication expired'));

    failedUrls.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.url}`);
      console.log(`   Reason: ${failure.reason}`);
      console.log(`   File: ${failure.filename}`);
      console.log('');
    });

    // If authentication expired, exit with error
    if (authFailures.length > 0) {
      console.log('\n🔐 AUTHENTICATION ERROR');
      console.log('======================');
      console.log(`❌ ${authFailures.length} download(s) failed due to expired authentication.`);
      console.log('📋 Your AEM authentication cookie has expired.');
      console.log('🔄 Please refresh your session cookie and try again.');
      console.log('');
      throw new Error('Authentication expired - please refresh your AEM session cookie');
    }
  }
}

// ==============================================================================
// MAIN EXECUTION
// ==============================================================================

// If multiple paths, execute script recursively for each one
if (CONTENT_PATHS.length > 1) {
  console.log(`\n📋 Processing ${CONTENT_PATHS.length} stores from input file...\n`);

  const { execSync } = require('child_process');
  const scriptPath = __filename;

  // Build additional flags to pass to child processes
  const additionalFlags = [];
  if (flags.debug) additionalFlags.push('--debug');
  if (flags.recursive) additionalFlags.push('--recursive');

  for (let i = 0; i < CONTENT_PATHS.length; i++) {
    const currentPath = CONTENT_PATHS[i];
    console.log(`\n\n${'='.repeat(120)}`);
    console.log(`🔄 Processing store ${i + 1}/${CONTENT_PATHS.length}: ${currentPath}`);
    console.log('='.repeat(120));

    try {
      // Execute this script with the current content path
      const command = `node "${scriptPath}" "${currentPath}" ${additionalFlags.join(' ')}`;
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ Completed store ${i + 1}/${CONTENT_PATHS.length}: ${currentPath}`);
    } catch (error) {
      console.error(`❌ Failed to process store ${i + 1}/${CONTENT_PATHS.length}: ${currentPath}`);
      console.error(error.message);
      process.exit(1);
    }
  }

  console.log(`\n\n${'='.repeat(120)}`);
  console.log(`✅ All ${CONTENT_PATHS.length} stores processed successfully!`);
  console.log('='.repeat(120));
  process.exit(0);
}

// Run the main function (single path execution)
main().then(async () => {
  // After successful extraction, download all images (unless SKIP_IMAGES is set)
  const skipImages = process.env.SKIP_IMAGES === 'true' || flags.fetchStoreLinks;
  if (!skipImages) {
    const fs = require('fs');
    const path = require('path');
    const hierarchyPath = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
    if (fs.existsSync(hierarchyPath)) {
      const hierarchyStructure = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
      const hierarchyData = hierarchyStructure.items || [];
      const bannerImages = hierarchyStructure.bannerImages || [];

      // Combine teaser images and banner images for download
      const allImagesToDownload = [...hierarchyData];

      // Add banner images to the download list (they already have imageUrl property)
      if (bannerImages.length > 0) {
        console.log(`\n🖼️  Found ${bannerImages.length} banner image(s) to download`);
        allImagesToDownload.push(...bannerImages);
      }

      // Download all images (teasers + banners) using the existing function
      await downloadAllImages(allImagesToDownload, OUTPUT_DIR);
    }
  } else {
    console.log('\n⏭️  Skipping image downloads');
  }

  // After successful extraction, check for linked content stores (only when --recursive flag is provided)
  if (flags.recursive) {
    const hierarchyFile = path.join(OUTPUT_DIR, 'hierarchy-structure.json');
    console.log('------------------------------------------ Starting recursive extraction of linked content stores... ------------------------------------------');
    await extractLinkedContentStores(hierarchyFile, flags.debug);
    console.log('------------------------------------------ Recursive extraction of linked content stores completed. ------------------------------------------');
  }

  // Force clean exit
  process.exit(0);
}).catch((error) => {
  console.error(`❌ Script failed: ${error.message}`);
  process.exit(1);
});
