#!/usr/bin/env node

/* eslint-disable no-console, max-len, no-await-in-loop */

const fs = require('fs');
const path = require('path');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');
const { uploadToEDS, sleep } = require('./upload-to-EDS.js');

// Parse command line arguments
// Usage: ./upload-images.js [--path <imagesPath>] [--concurrency <number>]
// Example: ./upload-images.js --path all-content-stores/extracted-results/images --concurrency 10
// Example: ./upload-images.js --concurrency 10  (auto-discover with concurrency=10)
// Example: ./upload-images.js (auto-discovers all content stores)
const args = process.argv.slice(2);

let imagesPath;
let concurrency = 1;

// Parse flags
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--path' || arg === '-p') {
    imagesPath = args[i + 1];
    i += 1; // Skip next argument since we consumed it
  } else if (arg === '--concurrency' || arg === '-c') {
    concurrency = parseInt(args[i + 1], 10) || 1;
    i += 1; // Skip next argument since we consumed it
  }
  // --help and -h flags are handled separately below
}

/**
 * Upload all images from a local directory to DA
 * @param {string} [imagesPath] - Optional: Relative path to directory containing images (relative to script directory).
 *                                 If not provided, auto-discovers all content stores with extracted-results/images
 * @param {number} [concurrency=1] - Number of concurrent uploads (1 = sequential, higher = more parallel)
 */
// eslint-disable-next-line no-shadow
async function uploadAllImages(imagesPath, concurrency = 1) {
  // If no imagesPath provided, auto-discover all content stores with images
  if (!imagesPath) {
    console.log('\n📸 Auto-discovering content stores with images...');

    // Find all directories matching *-content-stores*/extracted-results/images
    const contentStoresDirs = fs.readdirSync(__dirname, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.includes('-content-stores'))
      .map((entry) => entry.name);

    console.log(`   Found ${contentStoresDirs.length} content stores directories`);

    // Process each content store sequentially
    await contentStoresDirs.reduce(async (promise, contentStoreDir) => {
      await promise;

      const imagesDir = path.join(contentStoreDir, 'extracted-results', 'images');
      const absoluteImagesDir = path.resolve(__dirname, imagesDir);

      if (fs.existsSync(absoluteImagesDir)) {
        console.log(`\n   📁 Processing: ${imagesDir}`);

        // Derive targetDaBasePath: ${DA_ORG}/${DA_REPO}/${DA_DEST}/fragments/.${contentStoreDir}
        const normalizedDest = DA_DEST && DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
        const targetDaBasePath = normalizedDest
          ? `${DA_ORG}/${DA_REPO}/${normalizedDest}/fragments/.${contentStoreDir}`
          : `${DA_ORG}/${DA_REPO}/fragments/.${contentStoreDir}`;

        console.log(`   Target DA path: ${targetDaBasePath}`);

        // Recursively call uploadAllImages with the specific path
        await uploadAllImages(imagesDir, concurrency);
      } else {
        console.log(`   ⚠️ Skipping ${contentStoreDir}: no images directory found`);
      }
    }, Promise.resolve());

    console.log('\n✅ Completed processing all content stores');
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
      targetDaBasePath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/fragments/.${contentStoreName}`;
    } else {
      targetDaBasePath = `${DA_ORG}/${DA_REPO}/fragments/.${contentStoreName}`;
    }
  }

  if (!targetDaBasePath) {
    console.error(`❌ Could not derive target DA path from: ${imagesPath}`);
    return;
  }

  console.log(`\n📸 Uploading all images from: ${imagesPath} (${absoluteImagesPath})`);
  console.log(`   Destination: ${targetDaBasePath}`);
  console.log(`   Concurrency: ${concurrency} ${concurrency === 1 ? '(sequential)' : '(parallel)'}`);

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

      console.log(`      📤 Uploading: ${imageName}`);
      try {
        await uploadToEDS(localImagePath, daImagePath, false, false);
        console.log(`      ✅ Uploaded: ${imageName}`);
        return { imageName, status: 'success' };
      } catch (error) {
        console.error(`      ❌ Error uploading ${imageName}: ${error.message}`);
        return { imageName, status: 'error', error: error.message };
      }
    });

    // Wait for all uploads in this batch to complete
    const batchResults = await Promise.all(batchPromises);
    const batchUploaded = batchResults.filter((r) => r.status === 'success').length;
    const batchFailed = batchResults.filter((r) => r.status === 'error').length;

    totalUploaded += batchUploaded;
    totalFailed += batchFailed;

    console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batchUploaded} uploaded, ${batchFailed} failed`);

    // Small pause between batches to avoid overwhelming server (except for last batch)
    if (batchIndex < imageBatches.length - 1) {
      console.log('   ⏸️  Pausing briefly before next batch...');
      await sleep(500); // 0.5 second pause between batches
    }
  }

  console.log(`\n✅ All uploads completed: ${totalUploaded} successful, ${totalFailed} failed out of ${imageFiles.length} total`);
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
  console.error('  ./upload-images.js [--path <imagesPath>] [--concurrency <number>]');
  console.error('');
  console.error('Options:');
  console.error('  -p, --path <path>          Path to images directory (relative to script location)');
  console.error('                             If not provided, auto-discovers all *-content-stores/extracted-results/images');
  console.error('                             Examples: "all-content-stores/extracted-results/images"');
  console.error('                                       "bottler-content-stores/extracted-results/images"');
  console.error('');
  console.error('  -c, --concurrency <number> Number of concurrent uploads (default: 1)');
  console.error('                             1 = sequential (safest), higher = faster but more load on server');
  console.error('                             Recommended: 1-10');
  console.error('');
  console.error('  -h, --help                 Show this help message');
  console.error('');
  console.error('Destination Path:');
  console.error('  Images are automatically uploaded to:');
  console.error('    {DA_ORG}/{DA_REPO}/{DA_DEST}/fragments/.{content-store-name}/');
  console.error('');
  console.error('  The content store name is extracted from the images path.');
  console.error('  Example: "all-content-stores/extracted-results/images"');
  console.error('    → uploads to: aemsites/koassets/drafts/tphan/fragments/.all-content-stores/');
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
  console.error('  # Upload specific content store (sequential):');
  console.error('  ./upload-images.js --path all-content-stores/extracted-results/images');
  console.error('  ./upload-images.js -p all-content-stores/extracted-results/images');
  console.error('');
  console.error('  # Upload specific content store with 10 concurrent uploads:');
  console.error('  ./upload-images.js --path all-content-stores/extracted-results/images --concurrency 10');
  console.error('  ./upload-images.js -p all-content-stores/extracted-results/images -c 10');
  console.error('');
  console.error('  # Upload bottler content store with 5 concurrent uploads:');
  console.error('  ./upload-images.js -p bottler-content-stores/extracted-results/images -c 5');
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

// Run the upload based on command line arguments
console.log('\n🚀 Starting image upload...');
if (imagesPath) {
  console.log(`   Images Path: ${imagesPath}`);
} else {
  console.log('   Images Path: (auto-discovering all content stores)');
}
console.log(`   Concurrency: ${concurrency}`);

uploadAllImages(imagesPath, concurrency).catch((error) => {
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
