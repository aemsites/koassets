const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Load configuration from auth.config
let DA_ORG; let DA_REPO; let DA_BRANCH; let DA_DEST; let
  BEARER_TOKEN;
try {
  const authConfig = fs.readFileSync(path.join(__dirname, 'auth.config'), 'utf8').trim();

  const daOrgMatch = authConfig.match(/DA_ORG=(.*)/);
  DA_ORG = daOrgMatch ? daOrgMatch[1].trim() : null;

  const daRepoMatch = authConfig.match(/DA_REPO=(.*)/);
  DA_REPO = daRepoMatch ? daRepoMatch[1].trim() : null;

  const daBranchMatch = authConfig.match(/DA_BRANCH=(.*)/);
  DA_BRANCH = daBranchMatch ? daBranchMatch[1].trim() : null;

  const daDestMatch = authConfig.match(/DA_DEST=(.*)/);
  DA_DEST = daDestMatch ? daDestMatch[1].trim() : null;

  const tokenMatch = authConfig.match(/BEARER_TOKEN=(.*)/);
  BEARER_TOKEN = tokenMatch ? tokenMatch[1].trim() : null;

  if (!DA_ORG) throw new Error('DA_ORG not found in auth.config');
  if (!DA_REPO) throw new Error('DA_REPO not found in auth.config');
  if (!DA_BRANCH) throw new Error('DA_BRANCH not found in auth.config');
  if (!DA_DEST) throw new Error('DA_DEST not found in auth.config');
  if (!BEARER_TOKEN) throw new Error('BEARER_TOKEN not found in auth.config');
} catch (error) {
  console.error(`❌ Error loading configuration from auth.config: ${error.message}`);
  process.exit(1);
}

const DA_ADMIN_BASE = 'https://admin.da.live';
const PREVIEW_BASE = 'https://admin.hlx.page';

/**
 * Get MIME type based on file extension
 * @param {string} fileName - File name with extension
 * @returns {string} MIME type
 */
function getMimeType(fileName) {
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Create a source in DA admin by uploading a file
 * @param {string} daFullPath - Full DA path including org/repo, e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {string} localFilePath - Path to the file to upload from local filesystem, e.g. './generated-documents/all-content-stores.html'
 * @returns {Promise<Object>} Response from DA admin
 */
async function createSource(daFullPath, localFilePath) {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(localFilePath)) {
      reject(new Error(`File not found: ${localFilePath}`));
      return;
    }

    // Read file data
    const fileData = fs.readFileSync(localFilePath);
    const fileName = path.basename(localFilePath);

    // Build URL - daFullPath already includes org/repo
    const url = new URL(`${DA_ADMIN_BASE}/source/${daFullPath}`);
    console.debug(`Creating a source: ${url}`);

    // Create form data with boundary
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
    const formData = [];

    // Add file to form data
    formData.push(`--${boundary}`);
    formData.push(`Content-Disposition: form-data; name="data"; filename="${fileName}"`);
    formData.push(`Content-Type: ${getMimeType(fileName)}`);
    formData.push('');

    // Combine buffer and string parts
    const beforeFile = Buffer.from(`${formData.join('\r\n')}\r\n`);
    const afterFile = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([beforeFile, fileData, afterFile]);

    // Make request
    const options = {
      method: 'POST',
      headers: {
        Authorization: BEARER_TOKEN,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({
              statusCode: res.statusCode,
              data: data ? JSON.parse(data) : data,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data,
            });
          }
        } else {
          reject(new Error(`DA admin request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Preview a source in HLX by triggering a preview build
 * @param {string} fullPath - Full path including org/repo/branch, e.g. 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @returns {Promise<Object>} Response from preview endpoint
 */
async function previewSource(fullPath) {
  return new Promise((resolve, reject) => {
    // Build URL - fullPath already includes org/repo/branch
    const url = new URL(`${PREVIEW_BASE}/preview/${fullPath}`);
    console.debug(`Previewing a source: ${url}`);

    // Make request
    const options = {
      method: 'POST',
      headers: {
        Authorization: BEARER_TOKEN,
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({
              statusCode: res.statusCode,
              data: data ? JSON.parse(data) : data,
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data,
            });
          }
        } else {
          reject(new Error(`Preview request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  DA_ORG,
  DA_REPO,
  DA_BRANCH,
  DA_DEST,
  createSource,
  previewSource,
};
