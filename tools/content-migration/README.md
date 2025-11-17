# AEM to EDS Content Migration Guide

This guide provides step-by-step instructions for migrating content stores from AEM (Adobe Experience Manager) to EDS (Edge Delivery Services).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration Setup](#configuration-setup)
3. [Migration Steps](#migration-steps)
4. [Command Reference](#command-reference)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting the migration, ensure you have:

- **Node.js** installed (version 14 or higher)
- **Access to AEM Author instance** with valid authentication cookie
- **DA Live access** with valid bearer token
- **Network access** to both AEM Author and DA Live endpoints

---

## Configuration Setup

### Step 1: Create Configuration File

Copy the example configuration file and customize it for your environment:

```bash
cp da.config.example da.config
```

### Step 2: Update Configuration Values

Edit `da.config` with your credentials and settings:

```bash
DA_ORG=aemsites                    # Your DA organization name
DA_REPO=koassets                   # Your DA repository name
DA_BRANCH=main                     # Target branch (usually 'main')
DA_DEST=drafts/yourname            # Destination folder path
IMAGES_BASE=images/                # Base path for images
AEM_AUTHOR=https://author-...      # Your AEM Author URL

# DA Live Bearer Token
DA_BEARER_TOKEN=Bearer eyJhbG...   # Get from https://da.live

# AEM Author Authentication Cookie
AUTHOR_AUTH_COOKIE=AMCV_...        # Get from browser dev tools
```

**How to get credentials:**

- **DA_BEARER_TOKEN**: 
  1. Open https://da.live in your browser
  2. Open browser DevTools (F12)
  3. Go to Network tab, refresh the page
  4. Find any API request, copy the `Authorization` header value

- **AUTHOR_AUTH_COOKIE**:
  1. Open your AEM Author instance in browser
  2. Open browser DevTools (F12)
  3. Go to Application/Storage → Cookies
  4. Copy all cookie values as a semicolon-separated string

---

## Migration Steps

### Step 1: Discover Content Stores

**Purpose**: Automatically discover all content store links from the main content store and save them to a file.

```bash
node extract-stores-hierarchy.js --fetch-store-links
```

**Output**: Creates `all-store-links.txt` with all discovered content store paths.

**What it does**:
- Scans the default content store (`/content/share/us/en/all-content-stores`)
- Extracts all clickable URLs pointing to other content stores
- Saves the list to `all-store-links.txt` for batch processing

---

### Step 2: Extract Content Hierarchy

**Purpose**: Extract hierarchical content structure and download associated images from AEM.

#### Option A: Process All Content Stores (Recommended)

Process all stores discovered in Step 1:

```bash
node extract-stores-hierarchy.js --input all-store-links.txt
```

#### Option B: Process Individual Content Stores

Extract specific content stores one at a time:

```bash
# Main content store
node extract-stores-hierarchy.js --store /content/share/us/en/all-content-stores

# Specific sub-store
node extract-stores-hierarchy.js --store /content/share/us/en/all-content-stores/global-coca-cola-uplift
```

**Output**: For each content store, creates:
- `DATA/{store-name}/extracted-results/hierarchy-structure.json` - Complete hierarchy data
- `DATA/{store-name}/extracted-results/images/` - Downloaded images
- `DATA/{store-name}/extracted-results/caches/` - Cached API responses

**What it does**:
- Fetches JCR (Java Content Repository) data from AEM
- Parses tabs, accordions, buttons, and text content
- Downloads all teaser and banner images
- Generates structured JSON hierarchy

---

### Step 3: Generate CSV from Hierarchy

**Purpose**: Convert JSON hierarchy into CSV format for easy review and validation.

```bash
node generate-csv-from-hierarchy-json.js
```

**Output**: 
- `DATA/{store-name}/derived-results/hierarchy-structure.csv` for each store

**What it does**:
- Processes all `hierarchy-structure.json` files found
- Converts hierarchical data to flat CSV format
- Transforms URLs to EDS-compatible formats
- Includes columns: type, path, title, imageUrl, linkURL, text, synonym

**CSV Format**:
```csv
type,path,title,imageUrl,linkURL,text,synonym
section-title,Global Assets,Global Assets,,,,
tab,VIS & Design,VIS & Design,,,,
button,VIS & Design >>> Layouts,Layouts,,/search/all?fulltext=...,
accordion,VIS & Design >>> Illustrations,Illustrations,,,"<p><a href=""..."">Santa Graphics</a></p>",
```

---

### Step 4: Generate EDS Documents

**Purpose**: Create EDS-compatible JSON sheets and HTML pages from CSV data.

```bash
node generate-EDS-docs.js
```

**Output**:
- `DATA/generated-eds-docs/{store-name}/{store-name}-sheet.json` - Multi-sheet JSON
- `DATA/generated-eds-docs/{store-name}/{store-name}.html` - EDS page with content-stores block

**What it does**:
- Reads all CSV files from Step 3
- Creates multi-sheet JSON format required by EDS
- Generates HTML pages with proper metadata and block configuration
- Handles main stores and sub-stores differently for proper organization

---

### Step 5: Upload Images to DA Live

**Purpose**: Bulk upload all extracted images to DA Live.

```bash
node upload-images.js -c 10
```

**Flags**:
- `-c, --concurrency <number>` - Number of concurrent uploads (default: 1)
  - Use `1` for sequential (safest, slower)
  - Use `5-10` for faster uploads
  - Higher values may cause rate limiting

**What it does**:
- Auto-discovers all `DATA/*-content-stores/extracted-results/images` directories
- Uploads images to `{DA_ORG}/{DA_REPO}/{DA_DEST}/images/{store-name}/`
- Skips images that already exist (checks before uploading)
- Processes in batches based on concurrency setting

**Example with specific path**:
```bash
# Upload from specific store only
node upload-images.js --path DATA/all-content-stores/extracted-results/images -c 5
```

---

### Step 6: Upload Content to DA Live

**Purpose**: Upload generated JSON sheets and HTML pages to DA Live, with optional preview and publish.

#### Option A: Upload All Stores (Recommended)

Upload all stores from the input file:

```bash
node upload-to-EDS.js --input all-store-links.txt --preview --publish
```

#### Option B: Upload Individual Stores

Upload specific stores one at a time:

```bash
# Main content store
node upload-to-EDS.js --store /content/share/us/en/all-content-stores --preview --publish

# Specific sub-store
node upload-to-EDS.js --store /content/share/us/en/all-content-stores/global-coca-cola-uplift --preview --publish
```

**Available Flags**:

- `--preview` or `-pr` - Trigger preview after upload (always executes)
- `--publish` or `-pb` - Trigger publish after upload (always executes)
- `--reup` or `-r` - Force re-upload even if file exists
- `--dry` or `-dr` - Dry run mode (shows what would be done without actually doing it)

**Flag Behavior**:
- **Without flags**: Only uploads files that don't exist yet
- **With `--preview`**: Always previews the content (no status check)
- **With `--publish`**: Always publishes the content (no status check)
- **With `--reup`**: Always re-uploads files (skips existence check)
- **With `--dry`**: Shows what operations would be performed without executing them

**Examples**:

```bash
# Dry run to see what would be uploaded
node upload-to-EDS.js --input all-store-links.txt --dry

# Upload only (no preview/publish)
node upload-to-EDS.js --input all-store-links.txt

# Upload and preview only
node upload-to-EDS.js --input all-store-links.txt --preview

# Upload, preview, and publish
node upload-to-EDS.js --input all-store-links.txt --preview --publish

# Force re-upload and re-publish everything
node upload-to-EDS.js --input all-store-links.txt --reup --preview --publish

# Test single store with dry run
node upload-to-EDS.js --store /content/share/us/en/all-content-stores/sprite --preview --publish --dry
```

**What it does**:
- Converts content paths to directory names
- Finds corresponding files in `DATA/generated-eds-docs/`
- Uploads JSON sheets and HTML files to DA Live
- Creates preview (if `--preview` flag is set)
- Publishes to live site (if `--publish` flag is set)

**Upload Paths**:
- **Main stores** (all-content-stores, bottler-content-stores):
  - JSON: `{DA_ORG}/{DA_REPO}/{DA_DEST}/{store-name}-sheet.json`
  - HTML: `{DA_ORG}/{DA_REPO}/{DA_DEST}/{store-name}.html`
  
- **Sub-stores** (e.g., all-content-stores-sprite):
  - JSON: `{DA_ORG}/{DA_REPO}/{DA_DEST}/content-stores/{store-name}-sheet.json`
  - HTML: `{DA_ORG}/{DA_REPO}/{DA_DEST}/content-stores/{store-name}.html`

---

## Command Reference

### Extract Content Stores

```bash
# Discover all store links
node extract-stores-hierarchy.js --fetch-store-links

# Process all stores from file
node extract-stores-hierarchy.js --input all-store-links.txt

# Process single store
node extract-stores-hierarchy.js --store /content/share/us/en/all-content-stores

# Options:
--input <file>        Read content paths from file
--store <path>        Specify single content store path
--fetch-store-links   Discover and save all store links
--recursive           Automatically extract linked stores
--debug              Skip recursive extractions (list only)
```

### Generate CSV

```bash
# Process all hierarchy JSON files
node generate-csv-from-hierarchy-json.js

# Process specific file
node generate-csv-from-hierarchy-json.js <input-file> [output-file]
```

### Generate EDS Documents

```bash
# Process all CSV files
node generate-EDS-docs.js

# Process only stores from input file
node generate-EDS-docs.js --input stores.txt
```

### Upload Images

```bash
# Auto-discover and upload all images
node upload-images.js

# Upload with concurrency
node upload-images.js -c 10

# Upload specific store images
node upload-images.js --path DATA/all-content-stores/extracted-results/images

# Options:
-c, --concurrency <number>  Number of concurrent uploads (default: 1)
-p, --path <path>           Path to images directory
-h, --help                  Show help message
```

### Upload to EDS

```bash
# Upload all stores
node upload-to-EDS.js --input all-store-links.txt --preview --publish

# Upload single store
node upload-to-EDS.js --store /content/path --preview --publish

# Options:
-i, --input <file>    Input file with content paths
-s, --store <path>    Single content store path
-pr, --preview        Trigger preview (always executes)
-pb, --publish        Trigger publish (always executes)
-r, --reup           Force re-upload (skip existence check)
-dr, --dry           Dry run mode (show without executing)
-h, --help           Show help message
```

---

## Complete Migration Workflow

Here's the recommended complete workflow for migrating all content stores:

```bash
# 1. Setup configuration
cp da.config.example da.config
# Edit da.config with your credentials

# 2. Discover all content stores
node extract-stores-hierarchy.js --fetch-store-links

# 3. Extract all content and images from AEM
node extract-stores-hierarchy.js --input all-store-links.txt

# 4. Convert hierarchy to CSV format
node generate-csv-from-hierarchy-json.js

# 5. Generate EDS documents (JSON + HTML)
node generate-EDS-docs.js

# 6. Upload all images to DA Live (with 10 concurrent uploads)
node upload-images.js -c 10

# 7. Test with dry run first
node upload-to-EDS.js --input all-store-links.txt --preview --publish --dry

# 8. Upload all content, preview, and publish
node upload-to-EDS.js --input all-store-links.txt --preview --publish
```

---

## Troubleshooting

### Common Issues

**Issue**: `DA_BEARER_TOKEN not found in da.config`
- **Solution**: Make sure you've copied `da.config.example` to `da.config` and filled in your token

**Issue**: `401 Unauthorized` when downloading from AEM
- **Solution**: Your `AUTHOR_AUTH_COOKIE` may have expired. Get a fresh cookie from your browser

**Issue**: `Error uploading file: 403 Forbidden`
- **Solution**: Check that your `DA_BEARER_TOKEN` is valid and has write permissions

**Issue**: Images not downloading
- **Solution**: Check your `AUTHOR_AUTH_COOKIE` is correct and you have network access to AEM Author

**Issue**: Upload shows "already exists" but content is outdated
- **Solution**: Use the `--reup` flag to force re-upload: `node upload-to-EDS.js --input file.txt --reup --preview --publish`

### File Locations

All generated files are stored in the `DATA/` directory:

```
DATA/
├── all-content-stores/
│   ├── extracted-results/
│   │   ├── hierarchy-structure.json
│   │   ├── images/
│   │   └── caches/
│   └── derived-results/
│       └── hierarchy-structure.csv
├── all-content-stores-sprite/
│   └── ...
└── generated-eds-docs/
    ├── all-content-stores/
    │   ├── all-content-stores-sheet.json
    │   └── all-content-stores.html
    └── all-content-stores-sprite/
        ├── all-content-stores-sprite-sheet.json
        └── all-content-stores-sprite.html
```

### Getting Help

Each script has a `--help` flag that shows detailed usage information:

```bash
node extract-stores-hierarchy.js --help
node generate-csv-from-hierarchy-json.js --help
node upload-images.js --help
node upload-to-EDS.js --help
```

---

## Notes

- **Credentials Security**: Never commit `da.config` to version control. It contains sensitive credentials.
- **Performance**: Use concurrency (`-c 10`) for faster image uploads, but be mindful of rate limits.
- **Incremental Updates**: The scripts check for existing files and skip them by default. Use `--reup` to force re-upload.
- **Preview vs Publish**: 
  - Preview makes content visible at `https://{branch}--{repo}--{org}.aem.page/...`
  - Publish makes content visible at `https://{branch}--{repo}--{org}.aem.live/...`
- **Testing**: Always use `--dry` flag first to verify what will be uploaded before doing it for real.

---

## Additional Resources

- **DA Live**: https://da.live
- **AEM Edge Delivery Services**: https://www.aem.live/docs/
- **Content Stores Documentation**: See your project's main documentation

---

*Last updated: November 2025*

