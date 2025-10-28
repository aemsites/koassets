/* eslint-disable no-console, max-len */

const fs = require('fs');
const path = require('path');
const { sanitize, sanitizeFileName } = require('./sanitize-utils.js');
const { DA_ORG, DA_REPO, DA_DEST } = require('./da-admin-client.js');
const { PATH_SEPARATOR } = require('./constants');

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
// let CONTENT_PATH = '/content/share/us/en/all-content-stores/global-coca-cola-uplift';

// Override CONTENT_PATH if provided as first command line argument
[, , CONTENT_PATH = CONTENT_PATH] = process.argv;

const hierarchicalDirName = createHierarchicalDirName(CONTENT_PATH);
const lastContentPathToken = CONTENT_PATH.split('/').pop(); // Keep for template naming

// Read the hierarchy JSON and templates
const hierarchyPath = path.join(__dirname, hierarchicalDirName, 'extracted-results', 'hierarchy-structure.json');
const mainTemplatePath = path.join(__dirname, 'templates', `${lastContentPathToken}-template.html`);
const tabTemplatePath = path.join(__dirname, 'templates', 'tab-template.html');
const fragmentTemplatePath = path.join(__dirname, 'templates', 'fragment-tabs-template.html');

const hierarchyStructure = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
const hierarchyData = hierarchyStructure.items || [];
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

    // Properly sanitize hierarchical path
    const sanitizedPath = `${lastContentPathToken}/${item.path.split(PATH_SEPARATOR).map(sanitize).join('/')}`;
    return indentedTemplate
      .replace(/\$\{DA_DEST\}/g, DA_DEST)
      .replace(/\$\{PATH\}/g, sanitizedPath)
      .replace(/\$\{SANITIZED_TITLE\}/g, sanitizedTitle)
      .replace(/\$\{TITLE\}/g, item.title);
  })
  .join('\n');

// Extract image name from imageUrl
const getImageName = (imageUrl) => {
  const match = imageUrl.match(/([^/]+)$/);
  return match ? match[1] : '';
};

// Generate card blocks from teaser items (items with images)
const generateCardBlocks = (imageItems, parentTitle, parentHierarchy, baseIndent, contentIndent) => imageItems
  .filter((item) => item.type === 'teaser')
  .map((item) => {
    const extractedImageName = getImageName(item.imageUrl || '');
    // Build filename with itemId prepended
    const imageName = sanitizeFileName(extractedImageName);
    const sanitizedParentTitle = sanitize(parentTitle);

    if (item.imageUrl) {
      // Generate full card with picture element
      const indentedTemplate = cardTemplateContent
        .split('\n')
        .map((line) => (line.trim() ? contentIndent + line : line))
        .join('\n');
      // For card images, always use simple path structure with dot prefix (like .coca-cola)
      // Brand-specific cards should NEVER include parent directory prefixes
      const fullPath = item.path.split(PATH_SEPARATOR).map(sanitize).join('/');
      const pathTokens = fullPath.split('/');
      const sanitizedParentIndex = pathTokens.findIndex((token) => token === sanitizedParentTitle);
      const tokensAboveParent = sanitizedParentIndex > 0 ? pathTokens.slice(0, sanitizedParentIndex) : [];
      const pathAboveParent = tokensAboveParent.join('/');
      const sanitizedPath = pathAboveParent ? `${lastContentPathToken}/${pathAboveParent}` : lastContentPathToken;
      return indentedTemplate
        .replace(/\$\{DA_DEST\}/g, DA_DEST)
        .replace(/\$\{PATH\}/g, sanitizedPath)
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

// Find the deepest level containing "type": "teaser" (items with images)
const findDeepestImageLevel = (items, currentDepth = 0) => {
  let maxDepth = currentDepth;

  items.forEach((item) => {
    if (item.type === 'teaser') {
      maxDepth = Math.max(maxDepth, currentDepth);
    }
    if (item.items && item.items.length > 0) {
      maxDepth = Math.max(maxDepth, findDeepestImageLevel(item.items, currentDepth + 1));
    }
  });

  return maxDepth;
};

// Check if all items in a list are teasers (leaf items with images)
const allItemsAreImages = (items) => items.every((item) => item.type === 'teaser');

// Check if an item has any descendants at the target depth or deeper
const hasContentAtTargetDepth = (item, targetDepth, currentDepth = 0) => {
  if (currentDepth >= targetDepth) {
    return true;
  }
  if (item.items && item.items.length > 0) {
    return item.items.some((child) => hasContentAtTargetDepth(child, targetDepth, currentDepth + 1));
  }
  return false;
};

// Find deepest image level
const deepestImageLevel = findDeepestImageLevel(hierarchyData);
// 1-based: images at level (deepestImageLevel + 1), so 2 levels above = level (deepestImageLevel - 1) in 0-based
let targetGenerateLevel = deepestImageLevel - 2;

// If no images found, generate all root-level items (depth 0)
if (deepestImageLevel === 0) {
  console.log('\n📍 No images found in hierarchy. Generating all root-level items.');
  targetGenerateLevel = 0;
} else {
  console.log(`ℹ  Deepest image level: ${deepestImageLevel} (1-based: ${deepestImageLevel + 1}), generating for 1-based level 1 (0-based depth ${targetGenerateLevel})`);
}

// Recursively generate HTML for items at target level (1-based level 1, which is 2 levels above images)
const processHierarchyByLevel = (items, currentDepth = 0, parentPath = '') => {
  items.forEach((item) => {
    // Skip items of type "teaser" (these are leaf items with images)
    if (item.type === 'teaser') {
      return;
    }

    // Skip items of type "section" as requested by user
    if (item.type === 'section') {
      // Still recurse to process children, but don't generate files for sections
      if (item.items && item.items.length > 0) {
        processHierarchyByLevel(item.items, currentDepth, parentPath);
      }
      return;
    }

    const sanitizedParent = sanitize(item.title);
    const currentPath = parentPath ? `${parentPath}/${sanitizedParent}` : sanitizedParent;

    // If this item has child items
    if (item.items && item.items.length > 0) {
      // Debug: show what we're evaluating
      const notAllImages = !allItemsAreImages(item.items);
      const hasContent = hasContentAtTargetDepth(item, targetGenerateLevel, currentDepth);
      console.log(`\n  📋 Item: "${item.title}" | Depth: ${currentDepth} | Target: ${targetGenerateLevel} | HasContent@Target: ${hasContent} | HasNonImages: ${notAllImages}`);

      // Generate only items at depth 0 that have children, skip items without content at target level
      if (currentDepth === 0 && notAllImages) {
        // At root level, generate all items with non-image children
        console.log('    ✓ Generating root-level item');
      } else if (currentDepth === targetGenerateLevel && notAllImages) {
        // At target depth, also generate
        console.log('    ✓ Generating at target depth');
      }

      // Only generate at root level (depth 0) - no duplicate nested generation
      const shouldGenerate = (currentDepth === 0 && hasContent);

      if (shouldGenerate) {
        // Check if this item has teaser children (direct or one level deeper)
        const directTeaserChildren = item.items.filter((child) => child.type === 'teaser');
        let hasDirectTeasers = directTeaserChildren.length > 0;

        // Check if this item has non-teaser children (containers/brands that need navigation)
        const hasNonTeaserChildren = item.items.some((child) => child.type !== 'teaser');

        // If no direct teasers, check one level deeper (for sections like Brands that have container > teasers structure)
        if (!hasDirectTeasers && item.items.length > 0) {
          const childrenWithTeasers = item.items.some((child) => child.items && child.items.some((grandchild) => grandchild.type === 'teaser'));
          hasDirectTeasers = childrenWithTeasers;
        }

        console.log(`    📋 "${item.title}" has ${directTeaserChildren.length} direct teasers, ${item.items.length} total children, hasDirectTeasers: ${hasDirectTeasers}, hasNonTeaserChildren: ${hasNonTeaserChildren}`);

        if (hasDirectTeasers && !hasNonTeaserChildren) {
          // Generate cards template for sections with direct teaser children
          const tabsDivMatch = fragmentCardsTemplateContent.match(/^(\s*)<div class="cards">/m);
          const baseIndent = tabsDivMatch ? tabsDivMatch[1] : '      ';
          const contentIndent = `${baseIndent}  `;

          // Generate card blocks for teaser children (handle nested structure)
          let allTeasers = [];
          if (directTeaserChildren.length > 0) {
            // Direct teasers
            allTeasers = item.items;
          } else {
            // Teasers are nested one level deeper - flatten them
            item.items.forEach((child) => {
              if (child.items) {
                allTeasers = allTeasers.concat(child.items);
              }
            });
          }
          const generatedCards = generateCardBlocks(allTeasers, item.title, null, baseIndent, contentIndent);

          // Inject into fragment-cards template
          const outputHtml = fragmentCardsTemplateContent.replace(
            /<div class="cards">\s*<\/div>/,
            `<div class="cards">\n${generatedCards}\n${baseIndent}</div>`,
          );

          // Create directory for this level
          const outputDir = path.join(__dirname, lastContentPathToken, 'generated-documents', currentPath);
          fs.mkdirSync(outputDir, { recursive: true });

          // Write HTML file
          const fileName = `${sanitizedParent}.html`;
          const outputPath = path.join(outputDir, fileName);
          fs.writeFileSync(outputPath, outputHtml, 'utf8');

          console.log(`    ✓ Generated cards: ${outputPath}`);
        } else if (hasNonTeaserChildren) {
          // Generate tabs template for navigation sections
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

          console.log(`    ✓ Generated tabs: ${outputPath}`);
        }
      }

      // Always recurse to process deeper levels
      processHierarchyByLevel(item.items, currentDepth + 1, currentPath);

      // Generate brand-specific card files for any depth that has teaser children (excluding depth 0)
      if (currentDepth > 0 && item.items && item.items.length > 0) {
        const teaserChildren = item.items.filter((child) => child.type === 'teaser');
        if (teaserChildren.length > 0) {
          // Generate cards template for this specific brand
          const tabsDivMatch = fragmentCardsTemplateContent.match(/^(\s*)<div class="cards">/m);
          const baseIndent = tabsDivMatch ? tabsDivMatch[1] : '      ';
          const contentIndent = `${baseIndent}  `;

          const generatedCards = generateCardBlocks(item.items, item.title, null, baseIndent, contentIndent);
          const outputHtml = fragmentCardsTemplateContent.replace(
            /<div class="cards">\s*<\/div>/,
            `<div class="cards">\n${generatedCards}\n${baseIndent}</div>`,
          );

          const outputDir = path.join(__dirname, lastContentPathToken, 'generated-documents', currentPath);
          fs.mkdirSync(outputDir, { recursive: true });
          const fileName = `${sanitize(item.title)}.html`;
          const outputPath = path.join(outputDir, fileName);
          fs.writeFileSync(outputPath, outputHtml, 'utf8');

          console.log(`    ✓ Generated brand cards: ${outputPath}`);
        }
      }
    }
  });
};

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
// Note: Card generation is now handled within processHierarchyByLevel, no separate call needed

console.log('\n✓ All documents generated successfully!');
