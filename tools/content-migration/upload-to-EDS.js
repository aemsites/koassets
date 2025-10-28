#!/usr/bin/env node

/* eslint-disable no-console, max-len */

const fs = require('fs');
const path = require('path');
const {
  createSource, previewSource, publishSource, DA_BRANCH, PUBLISH,
} = require('./da-admin-client.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

// Create hierarchical directory name function
function createHierarchicalDirName(contentPath) {
  const pathParts = contentPath.split('/').filter((p) => p);
  const contentName = pathParts[pathParts.length - 1];
  const parentName = pathParts[pathParts.length - 2];

  // Special case: if contentName is 'all-content-stores', always use just that name
  if (contentName === 'all-content-stores') {
    return contentName;
  }

  // If no parent, or parent is not 'all-content-stores', use just the content name
  if (!parentName || parentName !== 'all-content-stores') {
    return contentName;
  }

  // Use double underscore to show hierarchy: parent__child (only for all-content-stores children)
  return `${parentName}__${contentName}`;
}

// Default CONTENT_PATH, can be overridden via first command line argument
let CONTENT_PATH = '/content/share/us/en/all-content-stores';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

const hierarchicalDirName = createHierarchicalDirName(CONTENT_PATH);
const lastContentPathToken = CONTENT_PATH.split('/').pop(); // Keep for compatibility

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Upload file to EDS
 * @param {string} daFullPath - Full DA path including org/repo, e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {string} localFilePath - Path to the file to upload from local filesystem, e.g. './generated-documents/all-content-stores.html'
 * @param {boolean} [skipPreview=false] - Skip preview trigger (for images)
 */
async function uploadToEDS(daFullPath, localFilePath, skipPreview = false) {
  // Check if file exists
  if (!fs.existsSync(localFilePath)) {
    console.error(`❌ File not found: ${localFilePath}`);
    process.exit(1);
  }

  try {
    // Step 1: Check if the file contains srcset references and upload images first
    const fileContent = fs.readFileSync(localFilePath, 'utf8');
    if (fileContent.includes('srcset')) {
      // eslint-disable-next-line no-use-before-define
      await uploadImagesFromSrcset(fileContent);
    }

    // Step 2: Upload the file
    console.log('📤 Uploading file to DA...');
    console.log(`   File: ${localFilePath}`);
    console.log(`   Destination path: ${daFullPath}`);

    const response = await createSource(daFullPath, localFilePath);
    await sleep(1000); // Pause 1 second after create source

    console.log('✅ Successfully uploaded file');
    console.log(`   Status: ${response.statusCode}`);
    if (response.data) {
      console.log('   Response:', JSON.stringify(response.data, null, 2));
    }

    // Step 3: Only trigger preview for HTML files, skip for images
    if (!skipPreview) {
      console.log('📋 Triggering preview source...');
      // Build full path with branch for preview: org/repo/branch/dest
      // daFullPath is: org/repo/dest, so extract the dest part and reconstruct
      const orgRepo = daFullPath.split('/').slice(0, 2).join('/');
      const destOnly = daFullPath.split('/').slice(2).join('/').replace(/\.[^/.]+$/, '');
      const fullPreviewPath = `${orgRepo}/${DA_BRANCH}/${destOnly}`;
      const previewResponse = await previewSource(fullPreviewPath);
      await sleep(1000); // Pause 1 second after preview source

      console.log('✅ Preview source triggered');
      console.log(`   Status: ${previewResponse.statusCode}`);
      if (previewResponse.data) {
        console.log('   Response:', JSON.stringify(previewResponse.data, null, 2));
      }

      // Only publish if PUBLISH constant is true
      if (PUBLISH) {
        console.log('📋 Triggering publish source...');
        const publishResponse = await publishSource(fullPreviewPath);
        await sleep(1000); // Pause 1 second after publish source

        console.log('✅ Publish source triggered');
        console.log(`   Status: ${publishResponse.statusCode}`);
        if (publishResponse.data) {
          console.log('   Response:', JSON.stringify(publishResponse.data, null, 2));
        }
      } else {
        console.log('ℹ️ Publish skipped (PUBLISH=false in config)');
      }
    }
  } catch (error) {
    console.error(`❌ Error uploading file: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Extract and upload images referenced in srcset attributes
 * @param {string} htmlContent - HTML file content
 */
async function uploadImagesFromSrcset(htmlContent) {
  console.log('\n📸 Processing images from srcset...');

  // Extract all srcset URLs
  const srcsetRegex = /srcset="([^"]+)"/g;
  const srcsetMatches = htmlContent.match(srcsetRegex) || [];
  const imagesToUpload = [];

  srcsetMatches.forEach((srcsetAttr) => {
    const srcsetUrl = srcsetAttr.replace(/srcset="|"/g, '');
    const imageName = srcsetUrl.split('/').pop();
    imagesToUpload.push({ imageName, srcsetUrl });
  });

  // Process each unique image sequentially to avoid overwhelming the server
  const processedImages = new Set();
  await imagesToUpload.reduce(async (promise, { imageName, srcsetUrl }) => {
    await promise;

    if (processedImages.has(imageName)) {
      return;
    }
    processedImages.add(imageName);

    // Check if image exists in extracted-results/images
    const imagePath = path.join(__dirname, hierarchicalDirName, 'extracted-results', 'images', imageName);
    if (fs.existsSync(imagePath)) {
      // Extract DA path from srcset URL (remove https://content.da.live/)
      const daPath = srcsetUrl.replace(/^https:\/\/content\.da\.live\//, '');
      console.log(`   Uploading image: ${imageName}`);
      try {
        await uploadToEDS(daPath, imagePath, true); // Pass true to skip preview for images
        // console.log(`uploadToEDS('${daPath}', '${imagePath}', true)`);
      } catch (error) {
        console.error(`   ❌ Error uploading image ${imageName}: ${error.message}`);
      }
    } else {
      console.log(`   ⚠ Image not found: ${imageName}`);
    }
  }, Promise.resolve());
}

/**
 * Upload all images from a local directory to DA
 * @param {string} imagesPath - Relative path to directory containing images (relative to script directory)
 * @param {string} daFullPath - DA destination path (e.g., 'aemsites/koassets/fragments/all-content-stores/.coca-cola/')
 */
async function uploadAllImages(imagesPath, daFullPath) {
  // Resolve relative path to absolute path
  const absoluteImagesPath = path.resolve(__dirname, imagesPath);

  console.log(`\n📸 Uploading all images from: ${imagesPath} (${absoluteImagesPath})`);
  console.log(`   Destination: ${daFullPath}`);

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

  // Upload images sequentially to avoid overwhelming the server
  await imageFiles.reduce(async (promise, imageName) => {
    await promise;

    const localImagePath = path.join(absoluteImagesPath, imageName);
    // Ensure daFullPath ends with / and construct full DA path for this image
    const normalizedDaPath = daFullPath.endsWith('/') ? daFullPath : `${daFullPath}/`;
    const daImagePath = `${normalizedDaPath}${imageName}`;

    console.log(`   📤 Uploading: ${imageName}`);
    try {
      await uploadToEDS(daImagePath, localImagePath, true); // Skip preview for images
      console.log(`   ✅ Uploaded: ${imageName}`);
    } catch (error) {
      console.error(`   ❌ Error uploading ${imageName}: ${error.message}`);
    }
  }, Promise.resolve());

  console.log(`\n✅ Completed uploading ${imageFiles.length} images from ${imagesPath}`);
}

/**
 * Recursively upload all HTML files from generated-documents folder
 */
async function uploadAllGeneratedDocuments() {
  const generatedDocsDir = path.join(__dirname, hierarchicalDirName, 'generated-documents');

  console.log('\n📁 Uploading all generated documents...\n');

  /**
   * Recursively process files in directory
   * @param {string} dir - Directory to process
   * @param {number} depth - Current depth (0 = top level)
   */
  async function processDirectory(dir, depth = 0) {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    await files.reduce(async (promise, file) => {
      await promise;

      if (file.isDirectory()) {
        // Recursively process subdirectories
        await processDirectory(path.join(dir, file.name), depth + 1);
      } else if (file.name.endsWith('.html')) {
        const filePath = path.join(dir, file.name);
        const filename = file.name;

        // Calculate relative path from generated-documents
        const relativeDir = path.relative(generatedDocsDir, dir);
        const relativePath = relativeDir ? `${relativeDir}/` : '';

        // Determine DA destination path
        let daDestPath;
        if (depth === 0) {
          // Top-level files: remove '/fragments' from DA_DEST
          const destWithoutFragments = DA_DEST.replace(/\/?fragments$/, '');
          daDestPath = destWithoutFragments ? `${DA_ORG}/${DA_REPO}/${destWithoutFragments}/${relativePath}${filename}` : `${DA_ORG}/${DA_REPO}/${relativePath}${filename}`; // DON'T add lastContentPathToken
        } else {
          // Nested files: use DA_DEST as-is
          daDestPath = `${DA_ORG}/${DA_REPO}/${DA_DEST}/${lastContentPathToken}/${relativePath}${filename}`;
        }

        console.log(`\n📄 Uploading: ${filename} (depth: ${depth})`);
        try {
          console.log(`uploadToEDS('${daDestPath}', '${filePath}');`);
          // await uploadToEDS(daDestPath, filePath);
        } catch (error) {
          console.error(`   ❌ Error uploading ${filename}: ${error.message}`);
        }
      }
    }, Promise.resolve());
  }

  // Start processing from generated-documents root
  await processDirectory(generatedDocsDir);
  console.log('\n✅ All documents processed!');
}

// Run the upload
// uploadAllGeneratedDocuments();

// ============================================ DRAFTS ============================================
// uploadToEDS('aemsites/koassets/drafts/tphan/all-content-stores.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/global-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/fanta/fanta.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html');

// ============================================ LIVE ============================================

// ALL CONTENT STORES
// uploadToEDS('aemsites/koassets/all-content-stores.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html');

// GLOBAL INITIATIVES
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/global-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/fanta/fanta.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/sprite/sprite.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/sprite/sprite.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/powerade/powerade.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/powerade/powerade.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/minute-maid/minute-maid.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/minute-maid/minute-maid.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/schweppes/schweppes.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/schweppes/schweppes.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/fuze-tea/fuze-tea.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fuze-tea/fuze-tea.html');

// REGIONAL INITIATIVES
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/regional-initiatives/regional-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/regional-initiatives/regional-initiatives.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/regional-initiatives/naou/naou.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/regional-initiatives/naou/naou.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/regional-initiatives/europe/europe.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/regional-initiatives/europe/europe.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/regional-initiatives/latam/latam.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/regional-initiatives/latam/latam.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/regional-initiatives/australia/australia.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/regional-initiatives/australia/australia.html');

// PAST INITIATIVES
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/past-initiatives/past-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/past-initiatives/past-initiatives.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/past-initiatives/coca-cola/coca-cola.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/past-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/past-initiatives/sprite/sprite.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/past-initiatives/sprite/sprite.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/past-initiatives/fanta/fanta.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/past-initiatives/fanta/fanta.html');

// BRANDS
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/brands/brands.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/brands/brands.html');

// ESSENTIALS
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/essentials/essentials.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/essentials/essentials.html');

// CUSTOMERS
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/customers/customers.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/customers/customers.html');

// ============================================ BULK IMAGE UPLOADS ============================================

// Upload all images from extracted-results/images to a specific DA location
uploadAllImages('all-content-stores/extracted-results/images', 'aemsites/koassets/fragments/.all-content-stores/');

// Example: Upload images for specific brand folders (using hierarchicalDirName for dynamic paths)
// uploadAllImages(`${hierarchicalDirName}/extracted-results/images`, 'aemsites/koassets/fragments/all-content-stores/.coca-cola/');
// uploadAllImages(`${hierarchicalDirName}/extracted-results/images`, 'aemsites/koassets/fragments/all-content-stores/.fanta/');
// uploadAllImages(`${hierarchicalDirName}/extracted-results/images`, 'aemsites/koassets/fragments/all-content-stores/.sprite/');
