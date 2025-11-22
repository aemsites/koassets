/**
 * DA Admin Client - Utility for interacting with DA (Digital Assets) admin API
 *
 * This module provides functions to upload, download, preview, and publish content to DA.
 * All functions support an optional config parameter to use different configuration files.
 *
 * Default Configuration:
 * - By default, loads configuration from 'da.upload.config' in the same directory
 * - Exports DA_ORG, DA_REPO, DA_BRANCH, DA_DEST, etc. for backward compatibility
 *
 * Using Custom Configuration:
 * - Pass a config file path (string) as the last parameter to any function
 * - Or pass a config object directly
 * - Or use loadConfig() to load a config file yourself
 *
 * Examples:
 *   // Using default config (da.upload.config)
 *   await downloadSource('aemsites/koassets/file.html', './local/file.html');
 *
 *   // Using custom config file
 *   await downloadSource('aemsites/koassets/file.html', './local/file.html', 'da.download.config');
 *
 *   // Using config object
 *   const cfg = loadConfig('da.custom.config');
 *   await downloadSource('aemsites/koassets/file.html', './local/file.html', cfg);
 */

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
  // Remove inline comments (# for comments, but preserve // in URLs)
  let cleanValue = rawValue.split('#')[0].trim();
  // Only remove // if it's preceded by whitespace (comment), not part of a URL
  const commentIndex = cleanValue.search(/\s+\/\//);
  if (commentIndex !== -1) {
    cleanValue = cleanValue.substring(0, commentIndex).trim();
  }
  return cleanValue; // Allow empty strings
}

/**
 * Load configuration from a config file
 * @param {string} configFilePath - Path to config file (relative to __dirname or absolute)
 * @returns {Object} Configuration object
 */
function loadConfig(configFilePath) {
  try {
    const configPath = path.isAbsolute(configFilePath)
      ? configFilePath
      : path.join(__dirname, configFilePath);

    const configContent = fs.readFileSync(configPath, 'utf8').trim();

    const daOrgMatch = configContent.match(/DA_ORG=(.*)/);
    const DA_ORG = parseConfigValue(daOrgMatch ? daOrgMatch[1] : null);

    const daRepoMatch = configContent.match(/DA_REPO=(.*)/);
    const DA_REPO = parseConfigValue(daRepoMatch ? daRepoMatch[1] : null);

    const daBranchMatch = configContent.match(/DA_BRANCH=(.*)/);
    const DA_BRANCH = parseConfigValue(daBranchMatch ? daBranchMatch[1] : null);

    const daDestMatch = configContent.match(/DA_DEST=(.*)/);
    const daDestValue = parseConfigValue(daDestMatch ? daDestMatch[1] : null);
    // Strip trailing slash if exists
    const DA_DEST = daDestValue && daDestValue !== '' ? daDestValue.replace(/\/$/, '') : daDestValue;

    const tokenMatch = configContent.match(/DA_BEARER_TOKEN=(.*)/);
    const DA_BEARER_TOKEN = parseConfigValue(tokenMatch ? tokenMatch[1] : null);

    const publishMatch = configContent.match(/PUBLISH=(.*)/);
    const publishValue = parseConfigValue(publishMatch ? publishMatch[1] : null);
    const PUBLISH = publishValue ? publishValue.toLowerCase() === 'true' : false;

    const imagesBaseMatch = configContent.match(/IMAGES_BASE=(.*)/);
    const IMAGES_BASE = parseConfigValue(imagesBaseMatch ? imagesBaseMatch[1] : null);

    const aemAuthorMatch = configContent.match(/AEM_AUTHOR=(.*)/);
    const AEM_AUTHOR = parseConfigValue(aemAuthorMatch ? aemAuthorMatch[1] : null);

    return {
      DA_ORG,
      DA_REPO,
      DA_BRANCH,
      DA_DEST,
      DA_BEARER_TOKEN,
      PUBLISH,
      IMAGES_BASE,
      AEM_AUTHOR,
    };
  } catch (error) {
    throw new Error(`Error loading configuration from ${configFilePath}: ${error.message}`);
  }
}

// Load default configuration from da.upload.config
let defaultConfig;
try {
  defaultConfig = loadConfig('da.upload.config');
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(`❌ ${error.message}`);
  process.exit(1);
}

// Export default config values for backward compatibility
const {
  DA_ORG,
  DA_REPO,
  DA_BRANCH,
  DA_DEST,
  PUBLISH,
  IMAGES_BASE,
  AEM_AUTHOR,
} = defaultConfig;

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
 * Download a source from DA admin to local filesystem
 * @param {string} daFullPath - Full DA path including org/repo,
 *   e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {string} localFilePath - Path to save the downloaded file to local filesystem,
 *   e.g. './downloaded/all-content-stores.html'
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response with statusCode and file path
 */
async function downloadSource(daFullPath, localFilePath, config = null) {
  return new Promise((resolve, reject) => {
    // Load config if string path provided, otherwise use provided config or default
    let cfg = defaultConfig;
    if (config) {
      if (typeof config === 'string') {
        try {
          cfg = loadConfig(config);
        } catch (error) {
          reject(error);
          return;
        }
      } else {
        cfg = config;
      }
    }

    // Check if parent directory exists, create if needed
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Build URL - daFullPath already includes org/repo
    const url = new URL(`${DA_ADMIN_BASE}/source/${daFullPath}`);
    // eslint-disable-next-line no-console
    console.debug(`Downloading from: ${url}`);

    // Make request
    const options = {
      method: 'GET',
      headers: {
        Authorization: cfg.DA_BEARER_TOKEN,
        Connection: 'close',
      },
    };

    const req = https.request(url, options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} - ${res.statusMessage}`));
        return;
      }

      const fileStream = fs.createWriteStream(localFilePath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({
          statusCode: res.statusCode,
          filePath: localFilePath,
        });
      });

      fileStream.on('error', (err) => {
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
        }
        reject(err);
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Create a source in DA admin by uploading a file
 * @param {string} daFullPath - Full DA path including org/repo,
 *   e.g. 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {string} localFilePath - Path to the file to upload from local filesystem,
 *   e.g. './generated-documents/all-content-stores.html'
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response from DA admin
 */
async function createSource(daFullPath, localFilePath, config = null) {
  return new Promise((resolve, reject) => {
    // Load config if string path provided, otherwise use provided config or default
    let cfg = defaultConfig;
    if (config) {
      if (typeof config === 'string') {
        try {
          cfg = loadConfig(config);
        } catch (error) {
          reject(error);
          return;
        }
      } else {
        cfg = config;
      }
    }

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
        Authorization: cfg.DA_BEARER_TOKEN,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        Connection: 'close',
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
 * Make a HLX action request (preview, publish, or status)
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {string} action - The action type ('preview', 'live', or 'status')
 * @param {string} actionName - Human-readable action name for logging
 * @param {string} method - HTTP method to use ('POST' or 'GET'), defaults to 'POST'
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response from HLX endpoint
 */
async function makeHlxRequest(fullPath, action, actionName, method = 'POST', config = null) {
  return new Promise((resolve, reject) => {
    // Load config if string path provided, otherwise use provided config or default
    let cfg = defaultConfig;
    if (config) {
      if (typeof config === 'string') {
        try {
          cfg = loadConfig(config);
        } catch (error) {
          reject(error);
          return;
        }
      } else {
        cfg = config;
      }
    }

    // Build URL - fullPath already includes org/repo/branch
    const url = new URL(`${PREVIEW_BASE}/${action}/${fullPath}`);
    console.debug(`${actionName} a source: ${url}`);

    // Make request
    const options = {
      method,
      headers: {
        Authorization: cfg.DA_BEARER_TOKEN,
        Connection: 'close',
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
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response from preview endpoint
 */
async function previewSource(fullPath, config = null) {
  return makeHlxRequest(fullPath, 'preview', 'Previewing', 'POST', config);
}

/**
 * Publish a source in HLX by triggering a live build
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response from publish endpoint
 */
async function publishSource(fullPath, config = null) {
  return makeHlxRequest(fullPath, 'live', 'Publishing', 'POST', config);
}

/**
 * Get the status of a source in HLX
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<Object>} Response from status endpoint
 */
async function getSourceStatus(fullPath, config = null) {
  return makeHlxRequest(fullPath, 'status', 'Get Source Status', 'GET', config);
}

/**
 * Check if a source has been previewed (preview status is 200)
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<boolean>} True if preview status is 200, false otherwise
 */
async function isSourcePreviewed(fullPath, config = null) {
  try {
    const response = await getSourceStatus(fullPath, config);
    return response.data?.preview?.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a source has been published (publish/live status is 200)
 * @param {string} fullPath - Full path including org/repo/branch, e.g.
 * 'aemsites/koassets/main/drafts/tphan/all-content-stores'. SHOULD HAVE NO HTML EXTENSION.
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<boolean>} True if publish status is 200, false otherwise
 */
async function isSourcePublished(fullPath, config = null) {
  try {
    const response = await getSourceStatus(fullPath, config);
    return response.data?.live?.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Check if an image/file has been uploaded to DA content storage
 * @param {string} fullPath - Full path including org/repo, e.g.
 * 'aemsites/koassets/drafts/tphan/image.png'
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<boolean>} True if the file exists (HEAD request returns 200), false otherwise
 */
async function isImageUploaded(fullPath, config = null) {
  return new Promise((resolve, reject) => {
    // Load config if string path provided, otherwise use provided config or default
    let cfg = defaultConfig;
    if (config) {
      if (typeof config === 'string') {
        try {
          cfg = loadConfig(config);
        } catch (error) {
          reject(error);
          return;
        }
      } else {
        cfg = config;
      }
    }

    const url = new URL(`https://content.da.live/${fullPath}`);
    console.debug(`Checking if file exists: ${url}`);

    const options = {
      method: 'HEAD',
      headers: {
        Authorization: cfg.DA_BEARER_TOKEN,
        Connection: 'close',
      },
    };

    const req = https.request(url, options, (res) => {
      // File exists if status is 200
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      // If request fails, assume file doesn't exist
      resolve(false);
    });

    req.end();
  });
}

/**
 * Check if a source has been uploaded to DA admin
 * @param {string} daFullPath - Full DA path including org/repo (with extension), e.g.
 * 'aemsites/koassets/drafts/tphan/all-content-stores.html'
 * @param {Object|string} [config] - Optional: Config object or path to config file
 * @returns {Promise<boolean>} True if the source exists in DA admin, false otherwise
 */
async function isSourceUploaded(daFullPath, config = null) {
  return new Promise((resolve, reject) => {
    // Load config if string path provided, otherwise use provided config or default
    let cfg = defaultConfig;
    if (config) {
      if (typeof config === 'string') {
        try {
          cfg = loadConfig(config);
        } catch (error) {
          reject(error);
          return;
        }
      } else {
        cfg = config;
      }
    }

    const url = new URL(`${DA_ADMIN_BASE}/source/${daFullPath}`);
    console.debug(`Checking if source exists: ${url}`);

    const options = {
      method: 'HEAD',
      headers: {
        Authorization: cfg.DA_BEARER_TOKEN,
        Connection: 'close',
      },
    };

    const req = https.request(url, options, (res) => {
      // Source exists if status is 200
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      // If request fails, assume source doesn't exist
      resolve(false);
    });

    req.end();
  });
}

module.exports = {
  // Config values from default config file (backward compatibility)
  DA_ORG,
  DA_REPO,
  DA_BRANCH,
  DA_DEST,
  PUBLISH,
  IMAGES_BASE,
  AEM_AUTHOR,
  // Config loading utility
  loadConfig,
  // DA admin functions
  downloadSource,
  createSource,
  previewSource,
  publishSource,
  getSourceStatus,
  isSourcePreviewed,
  isSourcePublished,
  isImageUploaded,
  isSourceUploaded,
};
