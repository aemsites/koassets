const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

/**
 * Parse config value and remove inline comments
 * @param {string|null} rawValue - Raw value from regex match
 * @returns {string|null} Cleaned value or null
 */
function parseConfigValue(rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  // Remove inline comments (# or //)
  const cleanValue = rawValue.split('#')[0].split('//')[0].trim();
  return cleanValue; // Allow empty strings
}

// Load configuration from da.config
let DA_ORG; let DA_REPO; let DA_BRANCH; let DA_DEST; let DA_BEARER_TOKEN; let PUBLISH;
let IMAGES_BASE;
try {
  const daConfig = fs.readFileSync(path.join(__dirname, 'da.config'), 'utf8').trim();

  const daOrgMatch = daConfig.match(/DA_ORG=(.*)/);
  DA_ORG = parseConfigValue(daOrgMatch ? daOrgMatch[1] : null);

  const daRepoMatch = daConfig.match(/DA_REPO=(.*)/);
  DA_REPO = parseConfigValue(daRepoMatch ? daRepoMatch[1] : null);

  const daBranchMatch = daConfig.match(/DA_BRANCH=(.*)/);
  DA_BRANCH = parseConfigValue(daBranchMatch ? daBranchMatch[1] : null);

  const daDestMatch = daConfig.match(/DA_DEST=(.*)/);
  const daDestValue = parseConfigValue(daDestMatch ? daDestMatch[1] : null);
  // Strip trailing slash if exists
  DA_DEST = daDestValue && daDestValue !== '' ? daDestValue.replace(/\/$/, '') : daDestValue;

  const tokenMatch = daConfig.match(/DA_BEARER_TOKEN=(.*)/);
  DA_BEARER_TOKEN = parseConfigValue(tokenMatch ? tokenMatch[1] : null);

  const publishMatch = daConfig.match(/PUBLISH=(.*)/);
  const publishValue = parseConfigValue(publishMatch ? publishMatch[1] : null);
  PUBLISH = publishValue ? publishValue.toLowerCase() === 'true' : false;

  const imagesBaseMatch = daConfig.match(/IMAGES_BASE=(.*)/);
  IMAGES_BASE = parseConfigValue(imagesBaseMatch ? imagesBaseMatch[1] : null);

  if (!DA_ORG) throw new Error('DA_ORG not found in da.config');
  if (!DA_REPO) throw new Error('DA_REPO not found in da.config');
  if (!DA_BRANCH) throw new Error('DA_BRANCH not found in da.config');
  if (DA_DEST === null) throw new Error('DA_DEST not found in da.config');
  if (!DA_BEARER_TOKEN) throw new Error('DA_BEARER_TOKEN not found in da.config');
  if (!IMAGES_BASE) throw new Error('IMAGES_BASE not found in da.config');
} catch (error) {
  console.error(`❌ Error loading configuration from da.config: ${error.message}`);
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
 * @param {string} daFullPath - Full DA path including org/repo,
 *   e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {string} localFilePath - Path to the file to upload from local filesystem,
 *   e.g. './generated-documents/all-content-stores.html'
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
        Authorization: DA_BEARER_TOKEN,
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
 * Make a HLX action request (preview or publish)
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {string} action - The action type ('preview' or 'live')
 * @param {string} actionName - Human-readable action name for logging
 * @returns {Promise<Object>} Response from HLX endpoint
 */
async function makeHlxRequest(fullPath, action, actionName) {
  return new Promise((resolve, reject) => {
    // Build URL - fullPath already includes org/repo/branch
    const url = new URL(`${PREVIEW_BASE}/${action}/${fullPath}`);
    console.debug(`${actionName} a source: ${url}`);

    // Make request
    const options = {
      method: 'POST',
      headers: {
        Authorization: DA_BEARER_TOKEN,
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
          reject(new Error(`${actionName} request failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Preview a source in HLX by triggering a preview build
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @returns {Promise<Object>} Response from preview endpoint
 */
async function previewSource(fullPath) {
  return makeHlxRequest(fullPath, 'preview', 'Previewing');
}

/**
 * Publish a source in HLX by triggering a live build
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @returns {Promise<Object>} Response from publish endpoint
 */
async function publishSource(fullPath) {
  return makeHlxRequest(fullPath, 'live', 'Publishing');
}

module.exports = {
  DA_ORG,
  DA_REPO,
  DA_BRANCH,
  DA_DEST,
  PUBLISH,
  IMAGES_BASE,
  createSource,
  previewSource,
  publishSource,
};
