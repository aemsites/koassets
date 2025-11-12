#!/usr/bin/env node

/* eslint-disable no-console, max-len, no-await-in-loop */

const fs = require('fs');
const path = require('path');
const {
  DA_ORG, DA_REPO, DA_DEST, IMAGES_BASE, isImageUploaded,
} = require('./da-admin-client.js');
const { uploadToEDS, sleep } = require('./upload-to-EDS.js');
const { DATA_DIR } = require('./constants.js');

// Parse command line arguments
// Usage: ./upload-images.js [--input <stores-file>] [--path <imagesPath>] [--concurrency <number>] [--debug]
// Example: ./upload-images.js --input stores.txt --concurrency 10
// Example: ./upload-images.js --path all-content-stores/extracted-results/images --concurrency 10
// Example: ./upload-images.js --concurrency 10  (auto-discover with concurrency=10)
// Example: ./upload-images.js (auto-discovers all content stores)
// Example: ./upload-images.js --input stores.txt --debug
const args = process.argv.slice(2);

let imagesPath;
let concurrency = 1;
let storesFile;
let debugFlag = false;

// Parse flags
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--input' || arg === '-i') {
    storesFile = args[i + 1];
    i += 1; // Skip next argument since we consumed it
  } else if (arg === '--path' || arg === '-p') {
    imagesPath = args[i + 1];
    i += 1; // Skip next argument since we consumed it
  } else if (arg === '--concurrency' || arg === '-c') {
    concurrency = parseInt(args[i + 1], 10) || 1;
    i += 1; // Skip next argument since we consumed it
  } else if (arg === '--debug' || arg === '-db') {
    debugFlag = true;
  }
  // --help and -h flags are handled separately below
}

// Debug statistics tracking
const debugStats = {
  totalImages: 0,
  uploaded: [],
  skipped: [],
  failed: [],
};

/**
 * Display debug mode summary
 */
function displayDebugSummary() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    🐛 DEBUG MODE SUMMARY                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Total images processed: ${debugStats.totalImages}`);

  console.log('\n📤 Upload Operations:');
  if (debugStats.uploaded.length > 0) {
    console.log(`   ✅ Would upload (${debugStats.uploaded.length}):`);
    debugStats.uploaded.forEach((file) => {
      console.log(`      • ${file}`);
    });
  } else {
    console.log('   ✅ Would upload: 0');
  }

  if (debugStats.skipped.length > 0) {
    console.log(`   ⏭️  Already exist (${debugStats.skipped.length}):`);
  } else {
    console.log('   ⏭️  Already exist: 0');
  }

  if (debugStats.failed.length > 0) {
    console.log(`   ❌ Failed checks (${debugStats.failed.length}):`);
    debugStats.failed.forEach((file) => {
      console.log(`      • ${file}`);
    });
  } else {
    console.log('   ❌ Failed checks: 0');
  }

  console.log('\n🎯 Summary:');
  console.log(`   → Would upload: ${debugStats.uploaded.length} images`);
  console.log(`   → Would skip: ${debugStats.skipped.length} images (already exist)`);
  console.log('');
}

/**
 * Extract store directory name from a content path
 * @param {string} contentPath - Content path like "/content/share/us/en/all-content-stores/360-integrated-activations"
 * @returns {string} Store directory name like "all-content-stores-360-integrated-activations"
 */
function extractStoreNameFromPath(contentPath) {
  // Remove leading/trailing slashes and split
  const parts = contentPath.replace(/^\/+|\/+$/g, '').split('/');

  // Find the index of the main content store (e.g., "all-content-stores")
  const mainStoreIndex = parts.findIndex((part) => part.includes('-content-stores'));

  if (mainStoreIndex === -1) {
    // If path doesn't contain -content-stores, assume it's already a directory name
    return contentPath;
  }

  // Get all parts from main store onwards
  const storeSegments = parts.slice(mainStoreIndex);

  // Join with hyphens to form directory name
  return storeSegments.join('-');
}

/**
 * Upload all images from a local directory to DA
 * @param {string} [imagesPath] - Optional: Relative path to directory containing images (relative to script directory).
 *                                 If not provided, auto-discovers all content stores with extracted-results/images
 * @param {number} [concurrency=1] - Number of concurrent uploads (1 = sequential, higher = more parallel)
 * @param {string[]} [storesList] - Optional: List of store paths/names to process (from --input file)
 * @param {boolean} [debug=false] - Debug mode: check status but skip actual uploads
 * @param {boolean} [isTopLevel=true] - Internal: whether this is the top-level call (for summary display)
 */
// eslint-disable-next-line no-shadow
async function uploadAllImages(imagesPath, concurrency = 1, storesList = null, debug = false, isTopLevel = true) {
  // If no imagesPath provided, auto-discover all content stores with images
  if (!imagesPath) {
    console.log('\n📸 Auto-discovering content stores with images...');

    // Find all directories matching *-content-stores*/extracted-results/images
    const dataPath = path.join(__dirname, DATA_DIR);
    let contentStoresDirs = fs.readdirSync(dataPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.includes('-content-stores'))
      .map((entry) => entry.name);

    // If storesList provided, filter to only those stores
    if (storesList && storesList.length > 0) {
      console.log(`   Filtering to ${storesList.length} stores from input file...`);
      const storeNames = storesList.map((store) => extractStoreNameFromPath(store));
      contentStoresDirs = contentStoresDirs.filter((dir) => storeNames.includes(dir));
    }

    console.log(`   Found ${contentStoresDirs.length} content stores directories`);

    // Process each content store sequentially
    await contentStoresDirs.reduce(async (promise, contentStoreDir) => {
      await promise;

      const imagesDir = path.join(DATA_DIR, contentStoreDir, 'extracted-results', 'images');
      const absoluteImagesDir = path.resolve(__dirname, imagesDir);

      if (fs.existsSync(absoluteImagesDir)) {
        console.log(`\n   📁 Processing: ${imagesDir}`);

        // Derive targetDaBasePath: ${DA_ORG}/${DA_REPO}/${DA_DEST}/${FRAGMENTS_BASE}${contentStoreDir}
        const normalizedDest = DA_DEST && DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
        const targetDaBasePath = normalizedDest
          ? `${DA_ORG}/${DA_REPO}/${normalizedDest}/${IMAGES_BASE}${contentStoreDir}`
          : `${DA_ORG}/${DA_REPO}/${IMAGES_BASE}${contentStoreDir}`;

        console.log(`   Target DA path: ${targetDaBasePath}`);

        // Recursively call uploadAllImages with the specific path (not top level)
        await uploadAllImages(imagesDir, concurrency, storesList, debug, false);
      } else {
        console.log(`   ⚠️ Skipping ${contentStoreDir}: no images directory found`);
      }
    }, Promise.resolve());

    console.log('\n✅ Completed processing all content stores');

    // Display debug summary if in debug mode
    if (debug) {
      displayDebugSummary();
    }
    return;
  }

  // Resolve relative path to absolute path
  const absoluteImagesPath = path.resolve(__dirname, imagesPath);

  // Extract content store name from path for targetDaBasePath
  const pathMatch = imagesPath.match(/([^/]*-content-stores[^/]*)/);
  const contentStoreName = pathMatch ? pathMatch[1] : null;

  // Derive targetDaBasePath
  let targetDaBasePath = null;
  if (contentStoreName) {
    const normalizedDest = DA_DEST && DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
    if (normalizedDest) {
      targetDaBasePath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/${IMAGES_BASE}${contentStoreName}`;
    } else {
      targetDaBasePath = `${DA_ORG}/${DA_REPO}/${IMAGES_BASE}${contentStoreName}`;
    }
  }

  if (!targetDaBasePath) {
    console.error(`❌ Could not derive target DA path from: ${imagesPath}`);
    return;
  }

  console.log(`\n📸 Uploading all images from: ${imagesPath} (${absoluteImagesPath})`);
  console.log(`   Destination: ${targetDaBasePath}`);
  console.log(`   Concurrency: ${concurrency} ${concurrency === 1 ? '(sequential)' : '(parallel)'}`);
  if (debug) {
    console.log('   🐛 Debug mode: Will check status but skip actual uploads');
  }

  // Check if images directory exists
  if (!fs.existsSync(absoluteImagesPath)) {
    console.error(`❌ Images directory not found: ${absoluteImagesPath}`);
    return;
  }

  // Get all files in the images directory
  const files = fs.readdirSync(absoluteImagesPath, { withFileTypes: true });

  // Filter for image files (common image extensions)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
  const imageFiles = files
    .filter((file) => file.isFile())
    .filter((file) => {
      const ext = path.extname(file.name).toLowerCase();
      return imageExtensions.includes(ext);
    })
    .map((file) => file.name);

  if (imageFiles.length === 0) {
    console.log('   ⚠️ No image files found in directory');
    return;
  }

  console.log(`   Found ${imageFiles.length} image files to upload`);

  // Helper function to split array into chunks
  const chunkArray = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  // Split images into batches based on concurrency
  const imageBatches = chunkArray(imageFiles, concurrency);
  let totalUploaded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  console.log(`   Processing ${imageBatches.length} batch(es) of up to ${concurrency} images each`);

  // Process each batch
  for (let batchIndex = 0; batchIndex < imageBatches.length; batchIndex += 1) {
    const batch = imageBatches[batchIndex];
    console.log(`\n   📦 Batch ${batchIndex + 1}/${imageBatches.length}: uploading ${batch.length} images...`);

    // Upload all images in current batch concurrently
    const batchPromises = batch.map(async (imageName) => {
      const localImagePath = path.join(absoluteImagesPath, imageName);
      // Ensure targetDaBasePath ends with / and construct full DA path for this image
      const normalizedDaPath = targetDaBasePath.endsWith('/') ? targetDaBasePath : `${targetDaBasePath}/`;
      const daImagePath = `${normalizedDaPath}${imageName}`;

      try {
        // Track total images in debug mode
        if (debug) {
          debugStats.totalImages += 1;
        }

        // Check if image already exists
        const alreadyExists = await isImageUploaded(daImagePath);

        if (alreadyExists) {
          console.log(`      ⏭️  Already exists: ${imageName}`);
          if (debug) {
            debugStats.skipped.push(daImagePath);
          }
          return { imageName, status: 'skipped' };
        }

        if (debug) {
          console.log(`      🐛 [DEBUG] Would upload: ${imageName}`);
          debugStats.uploaded.push(daImagePath);
          return { imageName, status: 'success' };
        }

        console.log(`      📤 Uploading: ${imageName}`);
        await uploadToEDS(localImagePath, daImagePath, false, false);
        console.log(`      ✅ Uploaded: ${imageName}`);
        return { imageName, status: 'success' };
      } catch (error) {
        console.error(`      ❌ Error uploading ${imageName}: ${error.message}`);
        if (debug) {
          debugStats.failed.push(`${daImagePath} (${error.message})`);
        }
        return { imageName, status: 'error', error: error.message };
      }
    });

    // Wait for all uploads in this batch to complete
    const batchResults = await Promise.all(batchPromises);
    const batchUploaded = batchResults.filter((r) => r.status === 'success').length;
    const batchSkipped = batchResults.filter((r) => r.status === 'skipped').length;
    const batchFailed = batchResults.filter((r) => r.status === 'error').length;

    totalUploaded += batchUploaded;
    totalSkipped += batchSkipped;
    totalFailed += batchFailed;

    console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batchUploaded} uploaded, ${batchSkipped} skipped, ${batchFailed} failed`);

    // Small pause between batches to avoid overwhelming server (except for last batch)
    if (batchIndex < imageBatches.length - 1) {
      console.log('   ⏸️  Pausing briefly before next batch...');
      await sleep(500); // 0.5 second pause between batches
    }
  }

  console.log(`\n✅ All uploads completed: ${totalUploaded} uploaded, ${totalSkipped} skipped, ${totalFailed} failed out of ${imageFiles.length} total`);

  // Display debug summary if in debug mode (only for top-level calls)
  if (debug && isTopLevel) {
    displayDebugSummary();
  }
}

// Display help
function showHelp() {
  console.error('');
  console.error('📸 Upload Images to EDS - Bulk Image Upload Tool');
  console.error('');
  console.error('Description:');
  console.error('  Uploads images from content store directories to DA (Digital Assets).');
  console.error('  Can auto-discover all content stores or upload from a specific path.');
  console.error('');
  console.error('Usage:');
  console.error('  ./upload-images.js [--input <stores-file>] [--path <imagesPath>] [--concurrency <number>] [--debug]');
  console.error('');
  console.error('Options:');
  console.error('  -i, --input <file>         Stores file (one content path per line, # for comments)');
  console.error('                             If provided, only processes stores listed in the file');
  console.error('                             Example content paths: "/content/share/us/en/all-content-stores"');
  console.error('                             Can also use directory names: "all-content-stores-360-integrated-activations"');
  console.error('');
  console.error('  -p, --path <path>          Path to images directory (relative to script location)');
  console.error('                             If not provided, auto-discovers all DATA/*-content-stores/extracted-results/images');
  console.error('                             Examples: "DATA/all-content-stores/extracted-results/images"');
  console.error('                                       "DATA/bottler-content-stores/extracted-results/images"');
  console.error('');
  console.error('  -c, --concurrency <number> Number of concurrent uploads (default: 1)');
  console.error('                             1 = sequential (safest), higher = faster but more load on server');
  console.error('                             Recommended: 1-10');
  console.error('');
  console.error('  -db, --debug               Debug mode: Check status but skip actual uploads');
  console.error('                             Shows what would be uploaded without making changes');
  console.error('');
  console.error('  -h, --help                 Show this help message');
  console.error('');
  console.error('Destination Path:');
  console.error('  Images are automatically uploaded to:');
  console.error(`    {DA_ORG}/{DA_REPO}/{DA_DEST}/${IMAGES_BASE}{content-store-name}/`);
  console.error('');
  console.error('  The content store name is extracted from the images path.');
  console.error('  Example: "DATA/all-content-stores/extracted-results/images"');
  console.error(`    → uploads to: aemsites/koassets/drafts/tphan/${IMAGES_BASE}all-content-stores/`);
  console.error('');
  console.error('Examples:');
  console.error('');
  console.error('  # Auto-discover and upload all content stores (sequential):');
  console.error('  ./upload-images.js');
  console.error('');
  console.error('  # Auto-discover all content stores with 10 concurrent uploads:');
  console.error('  ./upload-images.js --concurrency 10');
  console.error('  ./upload-images.js -c 10');
  console.error('');
  console.error('  # Upload only stores from input file:');
  console.error('  ./upload-images.js --input stores.txt');
  console.error('  ./upload-images.js -i stores.txt -c 10');
  console.error('');
  console.error('  # Upload specific content store (sequential):');
  console.error('  ./upload-images.js --path DATA/all-content-stores/extracted-results/images');
  console.error('  ./upload-images.js -p DATA/all-content-stores/extracted-results/images');
  console.error('');
  console.error('  # Upload specific content store with 10 concurrent uploads:');
  console.error('  ./upload-images.js --path DATA/all-content-stores/extracted-results/images --concurrency 10');
  console.error('  ./upload-images.js -p DATA/all-content-stores/extracted-results/images -c 10');
  console.error('');
  console.error('  # Upload bottler content store with 5 concurrent uploads:');
  console.error('  ./upload-images.js -p DATA/bottler-content-stores/extracted-results/images -c 5');
  console.error('');
  console.error('Notes:');
  console.error('  - Images are uploaded without preview/publish flags');
  console.error('  - Supported formats: jpg, jpeg, png, gif, webp, svg, bmp, tiff');
  console.error('  - Batches are processed with a 0.5s pause between them');
  console.error('  - Configuration loaded from da.config file (DA_ORG, DA_REPO, DA_DEST)');
  console.error('');
}

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Read stores file if provided
let storesList = null;
if (storesFile) {
  console.log(`\n📄 Reading stores from file: ${storesFile}`);
  try {
    const fileContent = fs.readFileSync(storesFile, 'utf8');
    storesList = [];
    fileContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed && !trimmed.startsWith('#')) {
        storesList.push(trimmed);
      }
    });
    console.log(`   Found ${storesList.length} store(s) in file\n`);
  } catch (error) {
    console.error(`❌ Error reading stores file ${storesFile}:`, error.message);
    process.exit(1);
  }
}

// Run the upload based on command line arguments
console.log('\n🚀 Starting image upload...');
if (imagesPath) {
  console.log(`   Images Path: ${imagesPath}`);
} else if (storesList) {
  console.log('   Images Path: (auto-discovering stores from input file)');
} else {
  console.log('   Images Path: (auto-discovering all content stores)');
}
console.log(`   Concurrency: ${concurrency}`);
console.log(`   Debug: ${debugFlag}`);

uploadAllImages(imagesPath, concurrency, storesList, debugFlag)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });

// ============================================ USAGE EXAMPLES ============================================
// uploadAllImages(imagesPath, concurrency)
//
// Auto-discover all content stores:
// uploadAllImages(); // Auto-discovers all *-content-stores/extracted-results/images
// uploadAllImages(null, 10); // Auto-discovers with 10 concurrent uploads
//
// Specific path examples:
// uploadAllImages('all-content-stores/extracted-results/images', 10); // 10 concurrent uploads
// uploadAllImages('bottler-content-stores/extracted-results/images', 1); // Sequential (safe)
// uploadAllImages('all-content-stores__ramadan-2025/extracted-results/images', 5); // 5 concurrent
//
// Command line examples:
// ./upload-images.js
// ./upload-images.js --concurrency 10
// ./upload-images.js --path all-content-stores/extracted-results/images --concurrency 10
// ./upload-images.js -p bottler-content-stores/extracted-results/images -c 5
