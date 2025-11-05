#!/usr/bin/env node

/* eslint-disable no-console, max-len, no-await-in-loop */

const fs = require('fs');
const path = require('path');
const {
  createSource, previewSource, publishSource, DA_BRANCH, // eslint-disable-line no-unused-vars
} = require('./da-admin-client.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

// Parse command line arguments
// Usage: ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug]
// Example: ./upload-to-EDS.js 'all-content-stores-sheet.json' 'aemsites/koassets/drafts/tphan/all-content-stores-sheet.json' --preview --publish
const args = process.argv.slice(2);
let localPath;
let daFullPath;
let previewFlag = false;
let publishFlag = false;
let debugFlag = false;

// Parse arguments
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--preview' || arg === '-pr') {
    previewFlag = true;
  } else if (arg === '--publish' || arg === '-pb') {
    publishFlag = true;
  } else if (arg === '--debug' || arg === '-db') {
    debugFlag = true;
  } else if (arg === '--path' || arg === '-p') {
    localPath = args[i + 1];
    i += 1; // Skip next argument since we consumed it
  } else if (arg === '--daFullPath' || arg === '-d') {
    daFullPath = args[i + 1];
    i += 1; // Skip next argument since we consumed it
  } else if (!arg.startsWith('-') && !localPath) {
    // First positional argument is localPath
    localPath = arg;
  } else if (!arg.startsWith('-') && !daFullPath && localPath) {
    // Second positional argument is daFullPath
    daFullPath = arg;
  }
  // --help and -h flags are handled separately below
}

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
 * Upload file or directory to EDS
 * @param {string} localPath - Path to the file or directory to upload from local filesystem, e.g. './generated-documents/all-content-stores.html'
 * @param {string} [daFullPath] - Optional: Full DA path including org/repo, e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 *                                If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}
 * @param {boolean} [previewFlag=false] - Trigger preview after upload
 * @param {boolean} [publishFlag=false] - Trigger publish after preview
 */
// eslint-disable-next-line no-shadow
async function uploadToEDS(localPath, daFullPath, previewFlag = false, publishFlag = false) {
  // Check if path exists
  if (!fs.existsSync(localPath)) {
    console.error(`❌ Path not found: ${localPath}`);
    process.exit(1);
  }

  // Check if localPath is a directory
  const stats = fs.statSync(localPath);
  if (stats.isDirectory()) {
    console.log(`\n📁 Processing directory: ${localPath}`);

    // If daFullPath not provided, construct base path from DA config (without directory name)
    let baseDaPath = daFullPath;
    if (!baseDaPath) {
      if (DA_DEST) {
        // Remove leading slash from DA_DEST if present
        const normalizedDest = DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
        baseDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}`;
      } else {
        baseDaPath = `${DA_ORG}/${DA_REPO}`;
      }
    }

    // Read all files and subdirectories
    const entries = fs.readdirSync(localPath, { withFileTypes: true });

    // Process each entry sequentially
    await entries.reduce(async (promise, entry) => {
      await promise;

      const entryPath = path.join(localPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectory
        const subDaPath = `${baseDaPath}/${entry.name}`;
        await uploadToEDS(entryPath, subDaPath, previewFlag, publishFlag);
      } else {
        // Process file
        const fileDaPath = `${baseDaPath}/${entry.name}`;
        await uploadToEDS(entryPath, fileDaPath, previewFlag, publishFlag);
      }
    }, Promise.resolve());

    console.log(`✅ Completed processing directory: ${localPath}`);
    return;
  }

  // If localPath is a file, construct path with filename if not provided
  let targetDaPath = daFullPath;
  if (!targetDaPath) {
    const basename = path.basename(localPath);
    if (DA_DEST) {
      // Remove leading slash from DA_DEST if present
      const normalizedDest = DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
      targetDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/${basename}`;
    } else {
      targetDaPath = `${DA_ORG}/${DA_REPO}/${basename}`;
    }
  }

  // If localPath is a file, proceed with upload
  const localFilePath = localPath;

  try {
    // Step 1: Upload the file
    console.log('\n\n📤 Uploading file to DA...');
    console.log(`   File: ${localFilePath}`);
    console.log(`   Destination path: ${targetDaPath}`);
    const previewArg = previewFlag ? ' --preview' : '';
    const publishArg = publishFlag ? ' --publish' : '';
    const debugArg = debugFlag ? ' --debug' : '';
    console.log(`   Command: node upload-to-EDS.js '${localFilePath}' '${targetDaPath}'${previewArg}${publishArg}${debugArg}`);

    if (debugFlag) {
      console.log('🐛 Debug mode: Skipping actual DA operations (upload/preview/publish)');
    } else {
      const response = await createSource(targetDaPath, localFilePath);
      await sleep(1000); // Pause 1 second after create source

      console.log('✅ Successfully uploaded file');
      console.log(`   Status: ${response.statusCode}`);
      if (response.data) {
        console.log('   Response:', JSON.stringify(response.data, null, 2));
      }

      // Step 2: Trigger preview if requested
      if (previewFlag) {
        console.log('📋 Triggering preview source...');
        // Build full path with branch for preview: org/repo/branch/dest
        // targetDaPath is: org/repo/dest, so extract the dest part and reconstruct
        const orgRepo = targetDaPath.split('/').slice(0, 2).join('/');
        let destOnly = targetDaPath.split('/').slice(2).join('/');
        // Only strip extension for HTML files
        if (destOnly.match(/\.html?$/i)) {
          destOnly = destOnly.replace(/\.[^/.]+$/, '');
        }
        const fullPreviewPath = `${orgRepo}/${DA_BRANCH}/${destOnly}`;
        console.log(`   Full preview path: ${fullPreviewPath}`);
        const previewResponse = await previewSource(fullPreviewPath);
        await sleep(1000); // Pause 1 second after preview source

        console.log('✅ Preview source triggered');
        console.log(`   Status: ${previewResponse.statusCode}`);
        if (previewResponse.data) {
          console.log('   Response:', JSON.stringify(previewResponse.data, null, 2));
        }
      }

      // Step 3: Trigger publish if requested
      if (publishFlag) {
        console.log('📋 Triggering publish source...');
        // Build full path with branch for publish: org/repo/branch/dest
        const orgRepo = targetDaPath.split('/').slice(0, 2).join('/');
        let destOnly = targetDaPath.split('/').slice(2).join('/');
        // Only strip extension for HTML files
        if (destOnly.match(/\.html?$/i)) {
          destOnly = destOnly.replace(/\.[^/.]+$/, '');
        }
        const fullPublishPath = `${orgRepo}/${DA_BRANCH}/${destOnly}`;
        console.log(`   Full publish path: ${fullPublishPath}`);
        const publishResponse = await publishSource(fullPublishPath);
        await sleep(1000); // Pause 1 second after publish source

        console.log('✅ Publish source triggered');
        console.log(`   Status: ${publishResponse.statusCode}`);
        if (publishResponse.data) {
          console.log('   Response:', JSON.stringify(publishResponse.data, null, 2));
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error uploading file: ${error.message}`);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = { uploadToEDS, sleep };

// Only run the command-line interface if this script is executed directly
if (require.main === module) {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.error('');
    console.error('📤 Upload to EDS - File/Directory Upload Tool');
    console.error('');
    console.error('Description:');
    console.error('  Uploads files or directories to DA (Digital Assets) with optional preview and publish.');
    console.error('');
    console.error('Usage:');
    console.error('  ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug]');
    console.error('');
    console.error('Arguments:');
    console.error('  localPath     - Path to local file or directory (e.g., "./file.json" or "./my-folder")');
    console.error('                  If a directory, all files will be uploaded recursively');
    console.error('  daFullPath    - Optional: Full DA path including org/repo (e.g., "aemsites/koassets/drafts/tphan/file.html")');
    console.error('                  If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}');
    console.error('');
    console.error('Options:');
    console.error('  -p, --path <path>          Path to local file or directory (alternative to positional)');
    console.error('  -d, --daFullPath <path>    Full DA destination path (alternative to positional)');
    console.error('  -pr, --preview             Trigger preview after upload (default: false)');
    console.error('  -pb, --publish             Trigger publish after upload (default: false)');
    console.error('  -db, --debug               Debug mode: skip actual DA operations (default: false)');
    console.error('  -h, --help                 Show this help message');
    console.error('');
    console.error('Examples (single file):');
    console.error('  ./upload-to-EDS.js "file.html" --preview');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html" --preview');
    console.error('  ./upload-to-EDS.js --path "file.html" --daFullPath "aemsites/koassets/drafts/tphan/file.html" --preview --publish');
    console.error('  ./upload-to-EDS.js -p "file.html" -d "aemsites/koassets/drafts/tphan/file.html" -pr -pb');
    console.error('');
    console.error('Examples (directory):');
    console.error('  ./upload-to-EDS.js "generated-docs" "aemsites/koassets/drafts/tphan/docs"');
    console.error('  ./upload-to-EDS.js "my-folder" --preview');
    console.error('');
    console.error('Examples (debug mode):');
    console.error('  ./upload-to-EDS.js "file.html" --debug');
    console.error('  ./upload-to-EDS.js "file.html" --preview --publish --debug');
    console.error('');
    console.error('Examples (positional arguments):');
    console.error('  ./upload-to-EDS.js "file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html" --preview --publish');
    console.error('');
    console.error('Notes:');
    console.error('  - By default, files are uploaded without preview/publish (use flags to enable)');
    console.error('  - Preview and publish are independent - either or both can be enabled');
    console.error('  - Debug mode skips all DA operations - useful for testing without actual uploads');
    console.error('  - For HTML files, extensions are stripped during preview/publish path construction');
    console.error('  - Configuration loaded from da.config file (DA_ORG, DA_REPO, DA_DEST)');
    console.error('');
    process.exit(0);
  }

  // Run the upload based on command line arguments
  if (localPath) {
    console.log('\n🚀 Starting upload with command line arguments...');
    console.log(`   Local Path: ${localPath}`);
    if (daFullPath) {
      console.log(`   DA Full Path: ${daFullPath}`);
    } else {
      console.log('   DA Full Path: (auto-constructed from config)');
    }
    console.log(`   Preview: ${previewFlag}`);
    console.log(`   Publish: ${publishFlag}`);
    console.log(`   Debug: ${debugFlag}`);
    uploadToEDS(localPath, daFullPath, previewFlag, publishFlag);
  } else {
    console.error('❌ Error: Missing required arguments');
    console.error('');
    console.error('Usage:');
    console.error('  ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug]');
    console.error('');
    console.error('Arguments:');
    console.error('  localPath     - Path to local file or directory (e.g., "./file.json" or "./my-folder")');
    console.error('                  If a directory, all files will be uploaded recursively');
    console.error('  daFullPath    - Optional: Full DA path including org/repo (e.g., "aemsites/koassets/drafts/tphan/file.html")');
    console.error('                  If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}');
    console.error('');
    console.error('Options:');
    console.error('  -p, --path <path>          Path to local file or directory (alternative to positional)');
    console.error('  -d, --daFullPath <path>    Full DA destination path (alternative to positional)');
    console.error('  -pr, --preview             Trigger preview after upload (default: false)');
    console.error('  -pb, --publish             Trigger publish after upload (default: false)');
    console.error('  -db, --debug               Debug mode: skip actual DA operations (default: false)');
    console.error('  -h, --help                 Show this help message');
    console.error('');
    console.error('Examples (single file):');
    console.error('  ./upload-to-EDS.js "file.html" --preview');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html" --preview');
    console.error('  ./upload-to-EDS.js --path "file.html" --daFullPath "aemsites/koassets/drafts/tphan/file.html" --preview --publish');
    console.error('  ./upload-to-EDS.js -p "file.html" -d "aemsites/koassets/drafts/tphan/file.html" -pr -pb');
    console.error('');
    console.error('Examples (directory):');
    console.error('  ./upload-to-EDS.js "generated-docs" "aemsites/koassets/drafts/tphan/docs"');
    console.error('  ./upload-to-EDS.js "my-folder" --preview');
    console.error('');
    console.error('Examples (positional arguments):');
    console.error('  ./upload-to-EDS.js "file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/drafts/tphan/file.html" --preview --publish');
    process.exit(1);
  }
}

// ============================================ FUNCTION USAGE EXAMPLES ============================================
// uploadToEDS(localPath, daFullPath, previewFlag, publishFlag)
//
// Single file examples:
// uploadToEDS('file.html', 'aemsites/koassets/drafts/tphan/file.html', true, true); // With preview and publish
// uploadToEDS('file.html', 'aemsites/koassets/drafts/tphan/file.html', true, false); // With preview only
// uploadToEDS('image.png', 'aemsites/koassets/drafts/tphan/image.png', false, false); // Upload only (no preview/publish)
//
// Directory examples (uploads all files recursively):
// uploadToEDS('generated-docs', 'aemsites/koassets/drafts/tphan/docs', false, false); // Upload directory
// uploadToEDS('my-folder', 'aemsites/koassets/drafts/tphan/my-folder', true, false); // Upload with preview

// ============================================ DRAFTS ============================================
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html', 'aemsites/koassets/drafts/tphan/all-content-stores.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html', 'aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/global-initiatives.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html', 'aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html', 'aemsites/koassets/drafts/tphan/fragments/all-content-stores/global-initiatives/fanta/fanta.html');
// uploadToEDS('all-content-stores-sheet.json', 'aemsites/koassets/drafts/tphan/all-content-stores-sheet.json');

// ============================================ LIVE ============================================

// Note: For bulk image uploads, use the upload-images.js script instead
