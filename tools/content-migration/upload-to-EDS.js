#!/usr/bin/env node

/* eslint-disable no-console, max-len */

const fs = require('fs');
const path = require('path');
const {
  createSource, previewSource, DA_BRANCH,
} = require('./da-admin-client.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

// Extract last token from content path for consistent directory naming
// Default CONTENT_PATH, can be overridden via first command line argument
let CONTENT_PATH = '/content/share/us/en/all-content-stores';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

const lastContentPathToken = CONTENT_PATH.split('/').pop();

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

      console.log('✅ Preview source triggered');
      console.log(`   Status: ${previewResponse.statusCode}`);
      if (previewResponse.data) {
        console.log('   Response:', JSON.stringify(previewResponse.data, null, 2));
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

  // Process each unique image
  const processedImages = new Set();
  imagesToUpload.forEach(async ({ imageName, srcsetUrl }) => {
    if (processedImages.has(imageName)) {
      return;
    }
    processedImages.add(imageName);

    // Check if image exists in extracted-results/images
    const imagePath = path.join(__dirname, lastContentPathToken, 'extracted-results', 'images', imageName);
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
  });
}

/**
 * Recursively upload all HTML files from generated-documents folder
 */
async function uploadAllGeneratedDocuments() {
  const generatedDocsDir = path.join(__dirname, lastContentPathToken, 'generated-documents');

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

// ========= DRAFTS =========
// uploadToEDS('aemsites/koassets/drafts/tphan/all-content-stores.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/global-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/fanta/fanta.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html');

// ========= LIVE =========
// uploadToEDS('aemsites/koassets/all-content-stores.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/global-initiatives.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html');
// uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html');
uploadToEDS('aemsites/koassets/fragments/all-content-stores/global-initiatives/fanta/fanta.html', '/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html');
