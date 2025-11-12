#!/usr/bin/env node

/* eslint-disable no-console, max-len, no-await-in-loop */

const fs = require('fs');
const path = require('path');
const {
  createSource, previewSource, publishSource, DA_BRANCH, // eslint-disable-line no-unused-vars
  isSourceUploaded, isSourcePreviewed, isSourcePublished,
} = require('./da-admin-client.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

// Parse command line arguments
// Usage: ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug] [--force] [--input <file>]
// Example: ./upload-to-EDS.js 'all-content-stores-sheet.json' 'aemsites/koassets/{DA_DEST}/all-content-stores-sheet.json' --preview --publish
// Example: ./upload-to-EDS.js --input stores.txt --preview --publish --debug
// Example: ./upload-to-EDS.js --input stores.txt --preview --publish --force
const args = process.argv.slice(2);
let localPath;
let daFullPath;
let previewFlag = false;
let publishFlag = false;
let debugFlag = false;
let forceFlag = false;
let inputFile;

// Parse arguments
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--preview' || arg === '-pr') {
    previewFlag = true;
  } else if (arg === '--publish' || arg === '-pb') {
    publishFlag = true;
  } else if (arg === '--debug' || arg === '-db') {
    debugFlag = true;
  } else if (arg === '--force' || arg === '-f') {
    forceFlag = true;
  } else if (arg === '--input' || arg === '-i') {
    inputFile = args[i + 1];
    i += 1; // Skip next argument since we consumed it
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
 * Convert content path to directory name
 * @param {string} contentPath - Content path like "/content/share/us/en/all-content-stores/360-integrated-activations"
 * @returns {string} Directory name like "all-content-stores-360-integrated-activations"
 */
function contentPathToDirectoryName(contentPath) {
  // Remove leading/trailing slashes and split
  const parts = contentPath.replace(/^\/+|\/+$/g, '').split('/');

  // Find the index of the main content store (e.g., "all-content-stores")
  const mainStoreIndex = parts.findIndex((part) => part.includes('-content-stores'));

  if (mainStoreIndex === -1) {
    throw new Error(`Invalid content path (no *-content-stores found): ${contentPath}`);
  }

  // Get all parts from main store onwards
  const storeSegments = parts.slice(mainStoreIndex);

  // Join with hyphens to form directory name
  return storeSegments.join('-');
}

/**
 * Read and parse input file containing content paths
 * @param {string} filePath - Path to input file
 * @returns {string[]} Array of content paths
 */
function readInputFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const paths = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (trimmed && !trimmed.startsWith('#')) {
        paths.push(trimmed);
      }
    });

    return paths;
  } catch (error) {
    console.error(`❌ Error reading input file ${filePath}:`, error.message);
    process.exit(1);
    return []; // Never reached, but satisfies linter
  }
}

// Debug statistics tracking
const debugStats = {
  totalFiles: 0,
  uploads: [],
  previews: [],
  publishes: [],
  skippedUploads: [],
  skippedPreviews: [],
  skippedPublishes: [],
};

/**
 * Display debug mode summary
 */
function displayDebugSummary() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    🐛 DEBUG MODE SUMMARY                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 Total files processed: ${debugStats.totalFiles}`);

  console.log('\n📤 Upload Operations:');
  if (debugStats.uploads.length > 0) {
    console.log(`   ✅ Would upload (${debugStats.uploads.length}):`);
    debugStats.uploads.forEach((file) => {
      console.log(`      • ${file}`);
    });
  } else {
    console.log('   ✅ Would upload: 0');
  }

  if (debugStats.skippedUploads.length > 0) {
    console.log(`   ⏭️  Already exist (${debugStats.skippedUploads.length}):`);
    // debugStats.skippedUploads.forEach((file) => {
    //   console.log(`      • ${file}`);
    // });
  } else {
    console.log('   ⏭️  Already exist: 0');
  }

  console.log('\n📋 Preview Operations:');
  if (debugStats.previews.length > 0) {
    console.log(`   ✅ Would preview (${debugStats.previews.length}):`);
    debugStats.previews.forEach((file) => {
      console.log(`      • ${file}`);
    });
  } else {
    console.log('   ✅ Would preview: 0');
  }

  if (debugStats.skippedPreviews.length > 0) {
    console.log(`   ⏭️  Already previewed (${debugStats.skippedPreviews.length}):`);
    // debugStats.skippedPreviews.forEach((file) => {
    //   console.log(`      • ${file}`);
    // });
  } else {
    console.log('   ⏭️  Already previewed: 0');
  }

  console.log('\n🚀 Publish Operations:');
  if (debugStats.publishes.length > 0) {
    console.log(`   ✅ Would publish (${debugStats.publishes.length}):`);
    debugStats.publishes.forEach((file) => {
      console.log(`      • ${file}`);
    });
  } else {
    console.log('   ✅ Would publish: 0');
  }

  if (debugStats.skippedPublishes.length > 0) {
    console.log(`   ⏭️  Already published (${debugStats.skippedPublishes.length}):`);
    // debugStats.skippedPublishes.forEach((file) => {
    //   console.log(`      • ${file}`);
    // });
  } else {
    console.log('   ⏭️  Already published: 0');
  }

  const totalOperations = debugStats.uploads.length + debugStats.previews.length + debugStats.publishes.length;
  const totalSkipped = debugStats.skippedUploads.length + debugStats.skippedPreviews.length + debugStats.skippedPublishes.length;

  console.log('\n🎯 Total Operations Summary:');
  console.log(`   → Would perform: ${totalOperations} operations`);
  console.log(`   → Would skip: ${totalSkipped} operations (already done)`);
  console.log('');
}

/**
 * Upload file or directory to EDS
 * @param {string} localPath - Path to the file or directory to upload from local filesystem, e.g. './generated-documents/all-content-stores.html'
 * @param {string} [daFullPath] - Optional: Full DA path including org/repo, e.g. 'aemsites/koassets/{DA_DEST}/all-content-stores.html'
 *                                If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}
 * @param {boolean} [previewFlag=false] - Trigger preview after upload
 * @param {boolean} [publishFlag=false] - Trigger publish after preview
 * @param {boolean} [forceFlag=false] - Force upload/preview/publish without status checks
 */
// eslint-disable-next-line no-shadow
async function uploadToEDS(localPath, daFullPath, previewFlag = false, publishFlag = false, forceFlag = false) {
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
      // Check if localPath starts with DATA/generated-eds-docs/ and transform accordingly
      const normalizedLocalPath = localPath.replace(/\\/g, '/');
      const dataGenDocsPrefix = 'DATA/generated-eds-docs/';

      if (normalizedLocalPath.includes(dataGenDocsPrefix)) {
        // Strip DATA/generated-eds-docs/ prefix and construct DA path
        const relativePath = normalizedLocalPath.substring(
          normalizedLocalPath.indexOf(dataGenDocsPrefix) + dataGenDocsPrefix.length,
        );
        // Remove trailing slash if present
        const cleanRelativePath = relativePath.replace(/\/$/, '');
        // Use DA_DEST if available
        if (DA_DEST) {
          const normalizedDest = DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
          baseDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/${cleanRelativePath}`;
        } else {
          baseDaPath = `${DA_ORG}/${DA_REPO}/${cleanRelativePath}`;
        }
      } else if (DA_DEST) {
        // Default behavior: use DA_DEST
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
        await uploadToEDS(entryPath, subDaPath, previewFlag, publishFlag, forceFlag);
      } else {
        // Process file
        const fileDaPath = `${baseDaPath}/${entry.name}`;
        await uploadToEDS(entryPath, fileDaPath, previewFlag, publishFlag, forceFlag);
      }
    }, Promise.resolve());

    console.log(`✅ Completed processing directory: ${localPath}`);
    return;
  }

  // If localPath is a file, construct path with filename if not provided
  let targetDaPath = daFullPath;
  if (!targetDaPath) {
    // Check if localPath starts with DATA/generated-eds-docs/ and transform accordingly
    const normalizedLocalPath = localPath.replace(/\\/g, '/');
    const dataGenDocsPrefix = 'DATA/generated-eds-docs/';

    if (normalizedLocalPath.includes(dataGenDocsPrefix)) {
      // Strip DATA/generated-eds-docs/ prefix and construct DA path
      const relativePath = normalizedLocalPath.substring(
        normalizedLocalPath.indexOf(dataGenDocsPrefix) + dataGenDocsPrefix.length,
      );

      // Check if this is a file from a store subdirectory (not root files)
      // Root files: all-content-stores-sheet.json, all-content-stores.html
      // Store subdirectory files: all-content-stores-{name}/all-content-stores-{name}-sheet.json
      const pathParts = relativePath.split('/');
      const dirName = pathParts[0];
      const isStoreSubdir = pathParts.length === 2
        && dirName !== 'all-content-stores'
        && (dirName.startsWith('all-content-stores-') || dirName.startsWith('bottler-content-stores-'));

      // Use DA_DEST if available
      if (DA_DEST) {
        const normalizedDest = DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
        if (isStoreSubdir) {
          // For store files, flatten to content-stores/filename
          const filename = pathParts[1];
          targetDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/content-stores/${filename}`;
        } else {
          // For root files, keep at root level
          targetDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/${relativePath}`;
        }
      } else if (isStoreSubdir) {
        const filename = pathParts[1];
        targetDaPath = `${DA_ORG}/${DA_REPO}/content-stores/${filename}`;
      } else {
        targetDaPath = `${DA_ORG}/${DA_REPO}/${relativePath}`;
      }
    } else {
      // Default behavior: use basename with DA_DEST
      const basename = path.basename(localPath);
      if (DA_DEST) {
        // Remove leading slash from DA_DEST if present
        const normalizedDest = DA_DEST.startsWith('/') ? DA_DEST.substring(1) : DA_DEST;
        targetDaPath = `${DA_ORG}/${DA_REPO}/${normalizedDest}/${basename}`;
      } else {
        targetDaPath = `${DA_ORG}/${DA_REPO}/${basename}`;
      }
    }
  }

  // If localPath is a file, proceed with upload
  const localFilePath = localPath;

  // Track file count in debug mode
  if (debugFlag) {
    debugStats.totalFiles += 1;
  }

  try {
    // Build full path with branch for preview/publish checks: org/repo/branch/dest
    const orgRepo = targetDaPath.split('/').slice(0, 2).join('/');
    let destOnly = targetDaPath.split('/').slice(2).join('/');
    // Only strip extension for HTML files
    if (destOnly.match(/\.html?$/i)) {
      destOnly = destOnly.replace(/\.[^/.]+$/, '');
    }
    const fullPath = `${orgRepo}/${DA_BRANCH}/${destOnly}`;

    // Step 1: Upload the file
    console.log('\n\n📤 Uploading file to DA...');
    console.log(`   File: ${localFilePath}`);
    console.log(`   Destination path: ${targetDaPath}`);
    const previewArg = previewFlag ? ' --preview' : '';
    const publishArg = publishFlag ? ' --publish' : '';
    const debugArg = debugFlag ? ' --debug' : '';
    const forceArg = forceFlag ? ' --force' : '';
    console.log(`   Command: node upload-to-EDS.js '${localFilePath}' '${targetDaPath}'${previewArg}${publishArg}${debugArg}${forceArg}`);

    let needsUpload = true;
    let alreadyPreviewed = false;
    let alreadyPublished = false;

    // Check status for all files (unless force flag is set)
    if (forceFlag) {
      console.log('⚡ Force mode enabled - skipping status checks');
      needsUpload = true;
      alreadyPreviewed = false;
      alreadyPublished = false;
    } else {
      console.log('🔍 Checking source status...');
      // isSourceUploaded needs targetDaPath (with extension, without branch)
      needsUpload = !(await isSourceUploaded(targetDaPath));
      if (!needsUpload) {
        console.log('   ℹ️  Source already uploaded');
        // Check preview and publish status
        if (previewFlag || publishFlag) {
          alreadyPreviewed = await isSourcePreviewed(fullPath);
          if (alreadyPreviewed) {
            console.log('   ℹ️  Source already previewed');
          }
        }
        if (publishFlag) {
          alreadyPublished = await isSourcePublished(fullPath);
          if (alreadyPublished) {
            console.log('   ℹ️  Source already published');
          }
        }
      }
    }

    // Track statistics and show summary in debug mode
    if (debugFlag) {
      // Track what would be done
      if (needsUpload) debugStats.uploads.push(targetDaPath);
      else debugStats.skippedUploads.push(targetDaPath);

      if (previewFlag) {
        if (!alreadyPreviewed) debugStats.previews.push(fullPath);
        else debugStats.skippedPreviews.push(fullPath);
      }

      if (publishFlag) {
        if (!alreadyPublished) debugStats.publishes.push(fullPath);
        else debugStats.skippedPublishes.push(fullPath);
      }

      console.log('\n🐛 [DEBUG] Operations that would be performed without --debug:');
      const operations = [];
      if (needsUpload) operations.push('UPLOAD');
      if (previewFlag && !alreadyPreviewed) operations.push('PREVIEW');
      if (publishFlag && !alreadyPublished) operations.push('PUBLISH');

      if (operations.length === 0) {
        console.log('   ℹ️  None - all operations already completed or not requested');
      } else {
        console.log(`   → ${operations.join(' + ')}`);
      }
      console.log('');
    }

    // Upload only if needed
    if (needsUpload) {
      if (debugFlag) {
        console.log('🐛 [DEBUG] Would upload file to:', targetDaPath);
      } else {
        const response = await createSource(targetDaPath, localFilePath);
        await sleep(1000); // Pause 1 second after create source

        console.log('✅ Successfully uploaded file');
        console.log(`   Status: ${response.statusCode}`);
        if (response.data) {
          console.log('   Response:', JSON.stringify(response.data, null, 2));
        }
      }
    } else {
      console.log('⏭️  Skipping upload (already exists)');
    }

    // Step 2: Trigger preview if requested and not already previewed
    if (previewFlag && !alreadyPreviewed) {
      if (debugFlag) {
        console.log('🐛 [DEBUG] Would trigger preview for:', fullPath);
      } else {
        console.log('📋 Triggering preview source...');
        console.log(`   Full preview path: ${fullPath}`);
        const previewResponse = await previewSource(fullPath);
        await sleep(1000); // Pause 1 second after preview source

        console.log('✅ Preview source triggered');
        console.log(`   Status: ${previewResponse.statusCode}`);
        if (previewResponse.data) {
          console.log('   Response:', JSON.stringify(previewResponse.data, null, 2));
        }
      }
    } else if (previewFlag && alreadyPreviewed) {
      console.log('⏭️  Skipping preview (already previewed)');
    }

    // Step 3: Trigger publish if requested and not already published
    if (publishFlag && !alreadyPublished) {
      if (debugFlag) {
        console.log('🐛 [DEBUG] Would trigger publish for:', fullPath);
      } else {
        console.log('📋 Triggering publish source...');
        console.log(`   Full publish path: ${fullPath}`);
        const publishResponse = await publishSource(fullPath);
        await sleep(1000); // Pause 1 second after publish source

        console.log('✅ Publish source triggered');
        console.log(`   Status: ${publishResponse.statusCode}`);
        if (publishResponse.data) {
          console.log('   Response:', JSON.stringify(publishResponse.data, null, 2));
        }
      }
    } else if (publishFlag && alreadyPublished) {
      console.log('⏭️  Skipping publish (already published)');
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
    console.error('  ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug] [--force]');
    console.error('  ./upload-to-EDS.js --input <file> [--preview] [--publish] [--debug] [--force]');
    console.error('');
    console.error('Arguments:');
    console.error('  localPath     - Path to local file or directory (e.g., "./file.json" or "./my-folder")');
    console.error('                  If a directory, all files will be uploaded recursively');
    console.error('  daFullPath    - Optional: Full DA path including org/repo (e.g., "aemsites/koassets/{DA_DEST}/file.html")');
    console.error('                  If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}');
    console.error('');
    console.error('Options:');
    console.error('  -i, --input <file>         Input file with content paths (one per line, # for comments)');
    console.error('                             Example line: /content/share/us/en/all-content-stores');
    console.error('  -p, --path <path>          Path to local file or directory (alternative to positional)');
    console.error('  -d, --daFullPath <path>    Full DA destination path (alternative to positional)');
    console.error('  -pr, --preview             Trigger preview after upload (default: false)');
    console.error('  -pb, --publish             Trigger publish after upload (default: false)');
    console.error('  -db, --debug               Debug mode: skip actual DA operations (default: false)');
    console.error('  -f, --force                Force mode: skip status checks, always upload/preview/publish (default: false)');
    console.error('  -h, --help                 Show this help message');
    console.error('');
    console.error('Examples (single file):');
    console.error('  ./upload-to-EDS.js "file.html" --preview');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html" --preview');
    console.error('  ./upload-to-EDS.js --path "file.html" --daFullPath "aemsites/koassets/{DA_DEST}/file.html" --preview --publish');
    console.error('  ./upload-to-EDS.js -p "file.html" -d "aemsites/koassets/{DA_DEST}/file.html" -pr -pb');
    console.error('');
    console.error('Examples (directory):');
    console.error('  ./upload-to-EDS.js "generated-docs" "aemsites/koassets/{DA_DEST}/docs"');
    console.error('  ./upload-to-EDS.js "my-folder" --preview');
    console.error('');
    console.error('Examples (debug mode):');
    console.error('  ./upload-to-EDS.js "file.html" --debug');
    console.error('  ./upload-to-EDS.js "file.html" --preview --publish --debug');
    console.error('');
    console.error('Examples (input file):');
    console.error('  ./upload-to-EDS.js --input stores.txt --preview --publish');
    console.error('  ./upload-to-EDS.js -i stores.txt --preview --publish --debug');
    console.error('');
    console.error('Examples (positional arguments):');
    console.error('  ./upload-to-EDS.js "file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html" --preview --publish');
    console.error('');
    console.error('Examples (force mode):');
    console.error('  ./upload-to-EDS.js "file.html" --preview --publish --force');
    console.error('  ./upload-to-EDS.js --input stores.txt --preview --publish --force');
    console.error('');
    console.error('Notes:');
    console.error('  - By default, files are uploaded without preview/publish (use flags to enable)');
    console.error('  - Preview and publish are independent - either or both can be enabled');
    console.error('  - Debug mode skips all DA operations - useful for testing without actual uploads');
    console.error('  - Force mode skips status checks and always performs upload/preview/publish operations');
    console.error('  - For HTML files, extensions are stripped during preview/publish path construction');
    console.error('  - Configuration loaded from da.config file (DA_ORG, DA_REPO, DA_DEST)');
    console.error('');
    process.exit(0);
  }

  // Run the upload based on command line arguments
  if (inputFile) {
    // Process input file with content paths
    console.log('\n🚀 Starting upload from input file...');
    console.log(`   Input File: ${inputFile}`);
    console.log(`   Preview: ${previewFlag}`);
    console.log(`   Publish: ${publishFlag}`);
    console.log(`   Debug: ${debugFlag}`);
    console.log(`   Force: ${forceFlag}`);

    const contentPaths = readInputFile(inputFile);
    console.log(`\n📋 Found ${contentPaths.length} content path(s) in input file\n`);

    // Process each content path sequentially
    (async () => {
      for (let i = 0; i < contentPaths.length; i += 1) {
        const contentPath = contentPaths[i];
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📍 [${i + 1}/${contentPaths.length}] Processing: ${contentPath}`);
        console.log('='.repeat(80));

        try {
          // Convert content path to directory name
          const dirName = contentPathToDirectoryName(contentPath);

          // Determine if this is all-content-stores or another store
          const isAllContentStores = dirName === 'all-content-stores';
          const generatedDocsDir = path.join(__dirname, 'DATA', 'generated-eds-docs');

          let targetPath;
          let matchingFiles = [];

          if (isAllContentStores) {
            // all-content-stores: files at root of generated-eds-docs/
            // Look for: all-content-stores-sheet.json and all-content-stores.html
            targetPath = generatedDocsDir;
            if (fs.existsSync(targetPath)) {
              const entries = fs.readdirSync(targetPath, { withFileTypes: true });
              matchingFiles = entries
                .filter((entry) => entry.isFile() && entry.name.startsWith('all-content-stores'))
                .map((entry) => path.join(targetPath, entry.name));
            }
          } else {
            // Other stores: look in subdirectory DATA/generated-eds-docs/{dirName}/
            targetPath = path.join(generatedDocsDir, dirName);
            if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
              const entries = fs.readdirSync(targetPath, { withFileTypes: true });
              matchingFiles = entries
                .filter((entry) => entry.isFile())
                .map((entry) => path.join(targetPath, entry.name));
            }
          }

          // Check if files were found
          if (matchingFiles.length === 0) {
            const searchPath = isAllContentStores
              ? 'DATA/generated-eds-docs/all-content-stores*'
              : `DATA/generated-eds-docs/${dirName}/`;
            console.log(`   ⚠️  Skipping: No files found at: ${searchPath}`);
            continue; // eslint-disable-line no-continue
          }

          console.log(`   📁 Found ${matchingFiles.length} file(s) in ${isAllContentStores ? 'root' : `${dirName}/`}`);

          // Upload each matching file
          await matchingFiles.reduce(async (promise, filePath) => {
            await promise;
            const fileName = path.basename(filePath);
            console.log(`      📄 ${fileName}`);
            await uploadToEDS(filePath, null, previewFlag, publishFlag, forceFlag);
          }, Promise.resolve());
        } catch (error) {
          console.error(`   ❌ Error processing ${contentPath}: ${error.message}`);
        }
      }

      // Display debug summary if in debug mode
      if (debugFlag) {
        displayDebugSummary();
      }

      process.exit(0);
    })().catch((error) => {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    });
  } else if (localPath) {
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
    console.log(`   Force: ${forceFlag}`);

    uploadToEDS(localPath, daFullPath, previewFlag, publishFlag, forceFlag).then(() => {
      // Display debug summary if in debug mode
      if (debugFlag) {
        displayDebugSummary();
      }
    }).catch((error) => {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    });
  } else {
    console.error('❌ Error: Missing required arguments');
    console.error('');
    console.error('Usage:');
    console.error('  ./upload-to-EDS.js <localPath> [daFullPath] [--preview] [--publish] [--debug] [--force]');
    console.error('');
    console.error('Arguments:');
    console.error('  localPath     - Path to local file or directory (e.g., "./file.json" or "./my-folder")');
    console.error('                  If a directory, all files will be uploaded recursively');
    console.error('  daFullPath    - Optional: Full DA path including org/repo (e.g., "aemsites/koassets/{DA_DEST}/file.html")');
    console.error('                  If not provided, constructed as: {DA_ORG}/{DA_REPO}/{DA_DEST}/{filename}');
    console.error('');
    console.error('Options:');
    console.error('  -p, --path <path>          Path to local file or directory (alternative to positional)');
    console.error('  -d, --daFullPath <path>    Full DA destination path (alternative to positional)');
    console.error('  -pr, --preview             Trigger preview after upload (default: false)');
    console.error('  -pb, --publish             Trigger publish after upload (default: false)');
    console.error('  -db, --debug               Debug mode: skip actual DA operations (default: false)');
    console.error('  -f, --force                Force mode: skip status checks, always upload/preview/publish (default: false)');
    console.error('  -h, --help                 Show this help message');
    console.error('');
    console.error('Examples (single file):');
    console.error('  ./upload-to-EDS.js "file.html" --preview');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html" --preview');
    console.error('  ./upload-to-EDS.js --path "file.html" --daFullPath "aemsites/koassets/{DA_DEST}/file.html" --preview --publish');
    console.error('  ./upload-to-EDS.js -p "file.html" -d "aemsites/koassets/{DA_DEST}/file.html" -pr -pb');
    console.error('');
    console.error('Examples (directory):');
    console.error('  ./upload-to-EDS.js "generated-docs" "aemsites/koassets/{DA_DEST}/docs"');
    console.error('  ./upload-to-EDS.js "my-folder" --preview');
    console.error('');
    console.error('Examples (positional arguments):');
    console.error('  ./upload-to-EDS.js "file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html"');
    console.error('  ./upload-to-EDS.js "file.html" "aemsites/koassets/{DA_DEST}/file.html" --preview --publish');
    process.exit(1);
  }
}

// ============================================ FUNCTION USAGE EXAMPLES ============================================
// uploadToEDS(localPath, daFullPath, previewFlag, publishFlag)
//
// Single file examples:
// uploadToEDS('file.html', 'aemsites/koassets/{DA_DEST}/file.html', true, true); // With preview and publish
// uploadToEDS('file.html', 'aemsites/koassets/{DA_DEST}/file.html', true, false); // With preview only
// uploadToEDS('image.png', 'aemsites/koassets/{DA_DEST}/image.png', false, false); // Upload only (no preview/publish)
//
// Directory examples (uploads all files recursively):
// uploadToEDS('generated-docs', 'aemsites/koassets/{DA_DEST}/docs', false, false); // Upload directory
// uploadToEDS('my-folder', 'aemsites/koassets/{DA_DEST}/my-folder', true, false); // Upload with preview

// ============================================ DRAFTS ============================================
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/all-content-stores.html', 'aemsites/koassets/{DA_DEST}/all-content-stores.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/global-initiatives.html', 'aemsites/koassets/{DA_DEST}/fragments/all-content-stores/global-initiatives/global-initiatives.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/coca-cola/coca-cola.html', 'aemsites/koassets/{DA_DEST}/fragments/all-content-stores/global-initiatives/coca-cola/coca-cola.html');
// uploadToEDS('/Users/tphan/Work/Git/aem/assets/ASTRA/koassets/tools/content-migration/all-content-stores/generated-documents/global-initiatives/fanta/fanta.html', 'aemsites/koassets/{DA_DEST}/fragments/all-content-stores/global-initiatives/fanta/fanta.html');
// uploadToEDS('all-content-stores-sheet.json', 'aemsites/koassets/{DA_DEST}/all-content-stores-sheet.json');

// ============================================ LIVE ============================================

// Note: For bulk image uploads, use the upload-images.js script instead
