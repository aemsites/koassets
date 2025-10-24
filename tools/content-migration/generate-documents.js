/* eslint-disable no-console, max-len */

const fs = require('fs');
const path = require('path');
const { sanitize } = require('./sanitize-utils.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');

const PATH_SEPARATOR = ' > ';

// Extract last token from content path for consistent directory naming
// Default CONTENT_PATH, can be overridden via first command line argument
let CONTENT_PATH = '/content/share/us/en/all-content-stores';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

const lastContentPathToken = CONTENT_PATH.split('/').pop();

// Read the hierarchy JSON and templates
const hierarchyPath = path.join(__dirname, lastContentPathToken, 'extracted-results', 'hierarchy-structure.json');
const mainTemplatePath = path.join(__dirname, 'templates', `${lastContentPathToken}-template.html`);
const tabTemplatePath = path.join(__dirname, 'templates', 'tab-template.html');
const fragmentTemplatePath = path.join(__dirname, 'templates', 'fragment-tabs-template.html');

const hierarchyData = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
let mainTemplateContent = fs.readFileSync(mainTemplatePath, 'utf8');
let tabTemplateContent = fs.readFileSync(tabTemplatePath, 'utf8');
let fragmentTemplateContent = fs.readFileSync(fragmentTemplatePath, 'utf8');

// Replace DA_ORG, DA_REPO, and DA_DEST placeholders in templates
mainTemplateContent = mainTemplateContent.replace(/\$\{DA_ORG\}/g, DA_ORG).replace(/\$\{DA_REPO\}/g, DA_REPO);
tabTemplateContent = tabTemplateContent.replace(/\$\{DA_ORG\}/g, DA_ORG).replace(/\$\{DA_REPO\}/g, DA_REPO);
fragmentTemplateContent = fragmentTemplateContent.replace(/\$\{DA_ORG\}/g, DA_ORG).replace(/\$\{DA_REPO\}/g, DA_REPO);

const cardTemplatePath = path.join(__dirname, 'templates', 'card-template.html');
const fragmentCardsTemplatePath = path.join(__dirname, 'templates', 'fragment-cards-template.html');

let cardTemplateContent = fs.readFileSync(cardTemplatePath, 'utf8');
let fragmentCardsTemplateContent = fs.readFileSync(fragmentCardsTemplatePath, 'utf8');

// Replace DA_ORG, DA_REPO, and DA_DEST placeholders in card templates
cardTemplateContent = cardTemplateContent.replace(/\$\{DA_ORG\}/g, DA_ORG).replace(/\$\{DA_REPO\}/g, DA_REPO);
fragmentCardsTemplateContent = fragmentCardsTemplateContent.replace(/\$\{DA_ORG\}/g, DA_ORG).replace(/\$\{DA_REPO\}/g, DA_REPO);

// Generate tabs blocks from items
const generateTabBlocks = (items, baseIndent, contentIndent) => items
  .map((item) => {
    const sanitizedTitle = sanitize(item.title);
    const indentedTemplate = tabTemplateContent
      .split('\n')
      .map((line) => (line.trim() ? contentIndent + line : line))
      .join('\n');
    return indentedTemplate
      .replace(/\$\{TITLE\}/g, item.title)
      .replace(/\$\{SANITIZED_TITLE\}/g, sanitizedTitle)
      .replace(/\$\{DA_DEST\}/g, DA_DEST)
      .replace(/\$\{PATH\}/g, sanitize(`${lastContentPathToken}/${item.path.replaceAll(PATH_SEPARATOR, '/')}`));
  })
  .join('\n');

// Extract image name from imageUrl
const getImageName = (imageUrl) => {
  const match = imageUrl.match(/([^/]+)$/);
  return match ? match[1] : '';
};

// Generate card blocks from image items
const generateCardBlocks = (imageItems, parentTitle, parentHierarchy, baseIndent, contentIndent) => imageItems
  .filter((item) => item.type === 'image')
  .map((item) => {
    const extractedImageName = getImageName(item.imageUrl || '');
    // Build filename with itemId prepended
    const imageName = sanitize(extractedImageName);
    const sanitizedParentTitle = sanitize(parentTitle);

    if (item.imageUrl) {
      // Generate full card with picture element
      const indentedTemplate = cardTemplateContent
        .split('\n')
        .map((line) => (line.trim() ? contentIndent + line : line))
        .join('\n');
      return indentedTemplate
        .replace(/\$\{DA_DEST\}/g, DA_DEST)
        .replace(/\$\{PATH\}/g, sanitize(`${lastContentPathToken}/${parentHierarchy.replaceAll(PATH_SEPARATOR, '/')}`))
        .replace(/\$\{PARENT_TITLE\}/g, sanitizedParentTitle)
        .replace(/\$\{IMAGE_NAME\}/g, imageName)
        .replace(/\$\{TITLE\}/g, item.title);
    }
    // Log items without imageUrl with full parent hierarchy
    const itemHierarchyPath = parentHierarchy ? `${parentHierarchy}${PATH_SEPARATOR}${parentTitle}` : parentTitle;
    console.log(`⚠  Picture element skipped for: ${itemHierarchyPath}${PATH_SEPARATOR}${item.title} (no imageUrl)`);

    // Generate card without picture element (keep empty div)
    const cardWithoutPicture = `<div>
  <div>
  </div>
  <div>
    <h2><strong>${item.title}</strong></h2>
  </div>
</div>`;
    return cardWithoutPicture
      .split('\n')
      .map((line) => (line.trim() ? contentIndent + line : line))
      .join('\n');
  })
  .join('\n');

// Find the deepest level containing "type": "image"
const findDeepestImageLevel = (items, currentDepth = 0) => {
  let maxDepth = currentDepth;

  items.forEach((item) => {
    if (item.type === 'image') {
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    if (item.items && item.items.length > 0) {
      maxDepth = Math.max(maxDepth, findDeepestImageLevel(item.items, currentDepth + 1));
    }
  });

  return maxDepth;
};

// Check if all items in a list are images
const allItemsAreImages = (items) => items.every((item) => item.type === 'image');

// Find deepest image level
const deepestImageLevel = findDeepestImageLevel(hierarchyData);
// 1-based: images at level (deepestImageLevel + 1), so 2 levels above = level (deepestImageLevel - 1) in 0-based
const targetGenerateLevel = deepestImageLevel - 2;

// Recursively generate HTML for items at target level (1-based level 1, which is 2 levels above images)
const processHierarchyByLevel = (items, currentDepth = 0, parentPath = '') => {
  items.forEach((item) => {
    // Skip items of type "image"
    if (item.type === 'image') {
      return;
    }

    const sanitizedParent = sanitize(item.title);
    const currentPath = parentPath ? `${parentPath}/${sanitizedParent}` : sanitizedParent;

    // If this item has child items
    if (item.items && item.items.length > 0) {
      // Only generate if current depth matches target level
      if (currentDepth === targetGenerateLevel && !allItemsAreImages(item.items)) {
        // Detect indentation from fragment template
        const tabsDivMatch = fragmentTemplateContent.match(/^(\s*)<div class="tabs">/m);
        const baseIndent = tabsDivMatch ? tabsDivMatch[1] : '      ';
        const contentIndent = `${baseIndent}  `;

        // Generate tab blocks for child items
        const generatedBlocks = generateTabBlocks(item.items, baseIndent, contentIndent);

        // Inject into fragment template
        const outputHtml = fragmentTemplateContent.replace(
          /<div class="tabs">\s*<\/div>/,
          `<div class="tabs">\n${generatedBlocks}\n${baseIndent}</div>`,
        );

        // Create directory for this level
        const outputDir = path.join(__dirname, lastContentPathToken, 'generated-documents', currentPath);
        fs.mkdirSync(outputDir, { recursive: true });

        // Write HTML file
        const fileName = `${sanitizedParent}.html`;
        const outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, outputHtml, 'utf8');

        console.log(`✓ Generated: ${outputPath}`);
      }

      // Always recurse to process deeper levels
      processHierarchyByLevel(item.items, currentDepth + 1, currentPath);
    }
  });
};

// Recursively process all items to find and generate cards for image parents
const processImagesForCardGeneration = (items, parentPath = '', parentHierarchy = '') => {
  items.forEach((item) => {
    if (!item.items || item.items.length === 0) {
      return;
    }

    const sanitizedItem = sanitize(item.title);
    const currentPath = parentPath ? `${parentPath}/${sanitizedItem}` : sanitizedItem;
    const currentHierarchy = parentHierarchy ? `${parentHierarchy}${PATH_SEPARATOR}${item.title}` : item.title;

    // Check if this item has image children
    const imageChildren = item.items.filter((child) => child.type === 'image');

    if (imageChildren.length > 0) {
      // Detect indentation from fragment-cards template
      const tabsDivMatch = fragmentCardsTemplateContent.match(/^(\s*)<div class="cards">/m);
      const baseIndent = tabsDivMatch ? tabsDivMatch[1] : '      ';
      const contentIndent = `${baseIndent}  `;

      // Generate card blocks for image children
      const generatedCards = generateCardBlocks(item.items, item.title, parentHierarchy, baseIndent, contentIndent);

      // Inject into fragment-cards template
      const outputHtml = fragmentCardsTemplateContent.replace(
        /<div class="cards">\s*<\/div>/,
        `<div class="cards">\n${generatedCards}\n${baseIndent}</div>`,
      );

      // Create output directory: grandparent/parent/
      const outputDir = path.join(__dirname, lastContentPathToken, 'generated-documents', currentPath);
      fs.mkdirSync(outputDir, { recursive: true });

      // File name: parent's sanitized title
      const fileName = `${sanitizedItem}.html`;
      const outputPath = path.join(outputDir, fileName);
      fs.writeFileSync(outputPath, outputHtml, 'utf8');

      console.log(`✓ Generated cards: ${outputPath}`);
    }

    // Continue recursing to process deeper levels
    processImagesForCardGeneration(item.items, currentPath, currentHierarchy);
  });
};

console.log(`ℹ  Deepest image level: ${deepestImageLevel} (1-based: ${deepestImageLevel + 1}), generating for 1-based level 1 (0-based depth ${targetGenerateLevel})`);

// Generate main all-content-stores page
const tabsDivMatch = mainTemplateContent.match(/^(\s*)<div class="tabs">/m);
const baseIndent = tabsDivMatch ? tabsDivMatch[1] : '      ';
const contentIndent = `${baseIndent}  `;

const generatedBlocks = generateTabBlocks(hierarchyData, baseIndent, contentIndent);
const outputHtml = mainTemplateContent.replace(
  /<div class="tabs">\s*<\/div>/,
  `<div class="tabs">\n${generatedBlocks}\n${baseIndent}</div>`,
);

// Ensure generated-documents folder exists
const generatedDocsDir = path.join(__dirname, lastContentPathToken, 'generated-documents');
fs.mkdirSync(generatedDocsDir, { recursive: true });

const mainOutputPath = path.join(generatedDocsDir, `${lastContentPathToken}.html`);
fs.writeFileSync(mainOutputPath, outputHtml, 'utf8');
console.log(`✓ Generated: ${mainOutputPath}`);

// Process nested levels
processHierarchyByLevel(hierarchyData);
processImagesForCardGeneration(hierarchyData);

console.log('\n✓ All documents generated successfully!');
