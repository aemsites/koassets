import { fetchSpreadsheetData, getBlockKeyValues, stripHtmlAndNewlines } from '../../scripts/scripts.js';
import { createOptimizedPicture } from '../../scripts/aem.js';

const PATH_SEPARATOR = ' >>> ';

/**
 * =============================================================================
 * DATA SCHEMA & CONSISTENCY FRAMEWORK
 * =============================================================================
 *
 * This section defines the schema and helper functions to ensure consistency
 * between data normalization and hierarchy reconstruction.
 *
 * PREVENTING INCONSISTENCIES:
 * 1. Single Source of Truth: ROW_SCHEMA defines ALL properties that should
 *    be preserved throughout the data flow
 * 2. Schema-driven Functions: normalizeRow() and copySchemaProperties() both
 *    use ROW_SCHEMA, ensuring they stay in sync
 * 3. Helper Function: copySchemaProperties() eliminates manual property copying
 *    which is error-prone when new properties are added
 *
 * TO ADD A NEW PROPERTY:
 * 1. Add it to ROW_SCHEMA below with type and default value
 * 2. That's it! It will automatically be:
 *    - Normalized in normalizeRow()
 *    - Copied in reconstructHierarchyFromRows()
 *    - Available throughout the component
 *
 * =============================================================================
 */

/**
 * Schema defining all properties that should be preserved across normalization
 * and hierarchy reconstruction. This serves as the single source of truth.
 * Add new properties here and they will automatically be handled consistently.
 */
const ROW_SCHEMA = {
  path: { type: 'string', default: '' },
  title: { type: 'string', default: '' },
  imageUrl: { type: 'string', default: '' },
  linkURL: { type: 'string', default: '' },
  type: { type: 'string', default: '' },
  text: { type: 'string', default: '' },
  synonym: { type: 'string', default: '' },
};

/**
 * Get all property keys from the schema (excluding internal metadata)
 * @returns {string[]} Array of property names
 */
function getSchemaProperties() {
  return Object.keys(ROW_SCHEMA);
}

/**
 * Copy properties from source to target based on schema.
 * Only copies properties defined in ROW_SCHEMA.
 * @param {object} source - Source object
 * @param {object} target - Target object to copy properties to
 * @param {object} options - Options for copying
 * @param {boolean} options.onlyIfTruthy - Only copy if source value is truthy
 */
function copySchemaProperties(source, target, { onlyIfTruthy = false } = {}) {
  getSchemaProperties().forEach((key) => {
    const value = source[key];
    if (onlyIfTruthy) {
      if (value) {
        target[key] = value;
      }
    } else {
      target[key] = value;
    }
  });
}

function splitPathSegments(pathStr) {
  if (!pathStr) return [];

  if (pathStr.includes(PATH_SEPARATOR)) {
    return pathStr
      .split(PATH_SEPARATOR)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  return pathStr
    .split('>')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

/**
 * Normalize a row object to ensure all schema properties exist with correct types.
 * Uses ROW_SCHEMA as the single source of truth for properties.
 * @param {object} row - Raw row data from spreadsheet
 * @returns {object} Normalized row with all schema properties
 */
function normalizeRow(row) {
  if (!row || typeof row !== 'object') {
    // Return default values from schema
    const normalized = {};
    getSchemaProperties().forEach((key) => {
      normalized[key] = ROW_SCHEMA[key].default;
    });
    return normalized;
  }

  const normalized = {};

  getSchemaProperties().forEach((key) => {
    const schema = ROW_SCHEMA[key];
    let value = row[key];

    // Handle aliases if defined in schema
    if (!value && schema.aliases) {
      schema.aliases.some((alias) => {
        if (row[alias]) {
          value = row[alias];
          return true;
        }
        return false;
      });
    }

    // Type checking and default value
    if (schema.type === 'string') {
      normalized[key] = typeof value === 'string' ? value : schema.default;
    } else {
      normalized[key] = value ?? schema.default;
    }
  });

  return normalized;
}

function reconstructHierarchyFromRows(rows) {
  const root = { items: [] };
  let currentSection = null; // Track the current section-title

  rows.forEach((row) => {
    // If this is a section-title, create it at root level and set as current section
    if (row.type === 'section-title') {
      const sectionItem = {
        title: row.title || row.path,
        path: row.path,
        items: [],
      };
      // Copy all schema properties
      copySchemaProperties(row, sectionItem, { onlyIfTruthy: true });
      sectionItem.title = row.title || row.path;

      root.items.push(sectionItem);
      currentSection = sectionItem;
      return;
    }

    // For non-section-title items, determine where to place them
    const pathSegments = splitPathSegments(row.path);
    if (pathSegments.length === 0) return;

    // If we have a current section, add items as children of that section
    // Otherwise, add to root
    let currentLevel = currentSection || root;

    pathSegments.forEach((segment, index) => {
      const isLastSegment = index === pathSegments.length - 1;
      const trimmedSegment = segment.trim();

      let existingItem = currentLevel.items.find(
        (item) => item.title && item.title.trim() === trimmedSegment,
      );

      if (!existingItem) {
        const newItem = {
          title: isLastSegment ? (row.title || trimmedSegment) : segment,
          path: pathSegments.slice(0, index + 1).join(PATH_SEPARATOR),
          items: [],
        };

        if (isLastSegment) {
          // Copy all schema properties from row to newItem (only if truthy)
          copySchemaProperties(row, newItem, { onlyIfTruthy: true });
          // Ensure title is set correctly
          newItem.title = row.title || trimmedSegment;
        }

        currentLevel.items.push(newItem);
        existingItem = newItem;
      } else if (isLastSegment) {
        // Copy all schema properties from row to existingItem (only if truthy)
        copySchemaProperties(row, existingItem, { onlyIfTruthy: true });
        // Ensure title is set correctly
        existingItem.title = row.title || trimmedSegment;
      }

      if (!existingItem.items) existingItem.items = [];
      currentLevel = existingItem;
    });
  });

  function cleanEmptyItems(item) {
    if (!item || !item.items) return;
    if (item.items.length === 0) {
      delete item.items;
      return;
    }
    item.items.forEach((child) => cleanEmptyItems(child));
  }

  root.items.forEach((item) => cleanEmptyItems(item));
  return root;
}

function countItems(data) {
  if (!data || !data.items) return 0;
  return data.items.reduce((count, item) => {
    if (item.title && item.title.toLowerCase().startsWith('accordion')) {
      return count + countItems(item);
    }
    return count + 1 + countItems(item);
  }, 0);
}

function createViewerElement(contentStoresData) {
  // Reconstruct hierarchy directly from raw data
  const hierarchyData = reconstructHierarchyFromRows(
    contentStoresData.map((row) => normalizeRow(row)),
  );

  const root = document.createElement('div');
  root.className = 'content-stores';

  const container = document.createElement('div');
  container.className = 'container';

  const controls = document.createElement('div');
  controls.className = 'controls';

  const searchBox = document.createElement('div');
  searchBox.className = 'search-box';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by title...';
  searchInput.setAttribute('aria-label', 'Search content stores by title');
  searchBox.appendChild(searchInput);

  const searchIcon = document.createElement('span');
  searchIcon.className = 'search-icon';
  searchIcon.textContent = '';
  searchBox.appendChild(searchIcon);

  const searchClearIcon = document.createElement('span');
  searchClearIcon.className = 'search-clear-icon';
  searchClearIcon.setAttribute('aria-label', 'Clear search');
  searchBox.appendChild(searchClearIcon);

  controls.appendChild(searchBox);

  const actionButtons = document.createElement('div');
  actionButtons.className = 'action-buttons';

  const expandAllBtn = document.createElement('button');
  expandAllBtn.className = 'action-btn primary-button';
  expandAllBtn.type = 'button';
  expandAllBtn.textContent = 'Expand All';
  actionButtons.appendChild(expandAllBtn);

  const collapseAllBtn = document.createElement('button');
  collapseAllBtn.className = 'action-btn primary-button';
  collapseAllBtn.type = 'button';
  collapseAllBtn.textContent = 'Collapse All';
  actionButtons.appendChild(collapseAllBtn);

  controls.appendChild(actionButtons);

  const stats = document.createElement('div');
  stats.className = 'stats';
  const statsText = document.createElement('span');
  statsText.textContent = 'Loading...';
  stats.appendChild(statsText);
  controls.appendChild(stats);

  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = 'Loading...';

  container.appendChild(controls);
  container.appendChild(content);
  root.appendChild(container);

  let filteredData = hierarchyData;
  const expandedNodes = new Set();
  let currentSearch = '';
  let expandAllMode = false;

  function updateStats() {
    statsText.textContent = `${countItems(filteredData)} items found`;
  }

  function filterItem(item, searchTerm) {
    if (!item) return null;

    const hadChildren = item.items && item.items.length > 0;
    const isParent = hadChildren;

    // If no search term, return everything
    if (!searchTerm) {
      return { ...item, hadChildren };
    }

    // Check if item matches in title, text content, or synonym
    const titleMatches = item.title && item.title.toLowerCase().includes(searchTerm);

    // Strip HTML tags from text before searching (only search visible text)
    let visibleText = '';
    if (item.text) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = item.text;
      visibleText = tempDiv.textContent || tempDiv.innerText || '';
    }
    const textMatches = visibleText && visibleText.toLowerCase().includes(searchTerm);

    // Check if synonym matches - split by comma and check each term
    let synonymMatches = false;
    if (item.synonym) {
      const synonymTerms = item.synonym.split(',').map((term) => term.trim().toLowerCase());
      synonymMatches = synonymTerms.some((term) => term.includes(searchTerm));
    }

    const matchesSearch = titleMatches || textMatches || synonymMatches;

    // Recursively filter children
    const filteredChildren = item.items
      ? item.items.map((child) => filterItem(child, searchTerm)).filter(Boolean)
      : [];

    const hasMatchingDescendants = filteredChildren.length > 0;

    // If this item matches the search
    if (matchesSearch) {
      if (isParent) {
        // Parent matches: show itself + ALL its children (unfiltered)
        return {
          ...item,
          items: item.items || [],
          hadChildren,
        };
      }
      // Leaf item matches: show itself only (ancestors will be added by parent logic)
      return {
        ...item,
        items: [],
        hadChildren,
      };
    }

    // If this item doesn't match but has matching descendants
    // Show this item as an ancestor with only the filtered children
    if (hasMatchingDescendants) {
      return {
        ...item,
        items: filteredChildren,
        hadChildren,
      };
    }

    return null;
  }

  function filterData(data, searchTerm) {
    if (!data || !data.items) return { items: [] };
    return {
      ...data,
      items: data.items.map((item) => filterItem(item, searchTerm)).filter(Boolean),
    };
  }

  function cleanRichContent(html) {
    // Create a temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove empty paragraphs and elements with only whitespace
    const paragraphs = temp.querySelectorAll('p');
    paragraphs.forEach((p) => {
      const textContent = p.textContent.trim();
      const hasOnlyWhitespace = textContent === '';
      if (hasOnlyWhitespace) {
        p.remove();
      }
    });

    return temp.innerHTML;
  }

  function toggleNode(path, nodeElement) {
    const expandIcon = nodeElement.querySelector('.expand-icon');
    const willExpand = !expandedNodes.has(path);

    // When manually toggling, exit expand-all mode
    expandAllMode = false;

    if (willExpand) {
      expandedNodes.add(path);
      nodeElement.classList.add('expanded');
      if (expandIcon) expandIcon.classList.add('expanded');
    } else {
      expandedNodes.delete(path);
      nodeElement.classList.remove('expanded');
      if (expandIcon) expandIcon.classList.remove('expanded');
    }

    let nextElement = nodeElement.nextElementSibling;
    while (nextElement && (nextElement.classList.contains('rich-content') || nextElement.classList.contains('tree-children'))) {
      if (willExpand) {
        nextElement.classList.add('expanded');
      } else {
        nextElement.classList.remove('expanded');
      }
      nextElement = nextElement.nextElementSibling;
    }
  }

  function createTreeItem(item) {
    const treeItem = document.createElement('div');
    treeItem.className = 'tree-item';

    // Add data attribute for item type
    if (item.type) {
      treeItem.dataset.itemType = item.type;
    }

    // For type 'text', only display the text content without title
    if (item.type === 'text') {
      if (item.text) {
        const richContent = document.createElement('div');
        richContent.className = 'rich-content';
        richContent.innerHTML = cleanRichContent(item.text);
        treeItem.appendChild(richContent);
      }
      return treeItem;
    }

    const hasChildren = item.items && item.items.length > 0;
    const hasTextList = item.text && (item.text.includes('<a') || (item.text.match(/<p>/g) || []).length > 1);
    // Accordion type items should always be expandable if they have text content
    const isAccordionWithText = item.type === 'accordion' && item.text && item.text.trim() !== '';
    // Use hadChildren to preserve original parent status even when filtered
    const wasParent = item.hadChildren || false;
    const hasExpandable = hasChildren || hasTextList || isAccordionWithText || wasParent;
    // Title type items are expanded by default
    let isExpanded;
    if (item.type === 'section-title') {
      isExpanded = true;
    } else if (expandAllMode) {
      isExpanded = hasExpandable;
    } else {
      isExpanded = expandedNodes.has(item.path);
    }
    const hasLink = item.linkURL && item.linkURL.trim() !== '';

    // Add leaf-item class for items without children (for inline display)
    if (!hasExpandable) {
      treeItem.classList.add('leaf-item');
    }

    // Add button-item class for button types (for inline display and equal widths)
    if (item.type === 'button') {
      treeItem.classList.add('button-item');
    }

    const treeNode = document.createElement('div');
    treeNode.className = 'tree-node';
    if (isExpanded) treeNode.classList.add('expanded');

    // Add type-specific classes
    if (item.type === 'button') {
      treeNode.classList.add('type-button');
      // Add disabled class if button has no link
      if (!hasLink) {
        treeNode.classList.add('disabled');
      }
    } else if (item.type === 'section-title') {
      treeNode.classList.add('type-section-title');
    }

    treeNode.dataset.path = item.path;
    treeNode.dataset.hasChildren = hasExpandable ? 'true' : 'false';
    treeNode.dataset.hasTextList = hasTextList ? 'true' : 'false';
    treeNode.dataset.linkURL = hasLink ? item.linkURL : '';
    // Add synonym as hidden data attribute for search
    if (item.synonym) {
      treeNode.dataset.synonym = item.synonym;
    }

    // Only create expand icon if item has expandable content (but not for section-title type)
    if (hasExpandable && item.type !== 'section-title') {
      const expandIcon = document.createElement('span');
      expandIcon.className = 'expand-icon';
      if (isExpanded) expandIcon.classList.add('expanded');
      expandIcon.textContent = '▶';
      treeNode.appendChild(expandIcon);
    }

    if (item.imageUrl) {
      const picture = createOptimizedPicture(item.imageUrl, item.title || '', true, [{ width: '100' }], true);
      const img = picture.querySelector('img');
      if (img) {
        img.className = 'item-image';
      }
      treeNode.appendChild(picture);
    }

    // Create title element - h2 for section-title type, span or anchor for others
    let nodeTitle;
    if (item.type === 'section-title') {
      nodeTitle = document.createElement('h2');
      nodeTitle.className = 'node-title';
      // Create id from title (lowercase, replace spaces/special chars with hyphens)
      const titleId = (item.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      nodeTitle.id = titleId;
      // Wrap title text in <strong>
      const strong = document.createElement('strong');
      strong.textContent = item.title || '';
      nodeTitle.appendChild(strong);
    } else if (hasLink) {
      // Use anchor tag for items with links to show URL in status bar
      nodeTitle = document.createElement('a');
      nodeTitle.className = 'node-title has-link';
      nodeTitle.href = item.linkURL;
      nodeTitle.target = '_blank';
      nodeTitle.rel = 'noopener noreferrer';
      nodeTitle.textContent = item.title || '';
    } else {
      nodeTitle = document.createElement('span');
      nodeTitle.className = 'node-title';
      nodeTitle.textContent = item.title || '';
    }
    treeNode.appendChild(nodeTitle);

    // Don't add click handler for section-title type items (they're always expanded)
    if (item.type !== 'section-title') {
      treeNode.addEventListener('click', (event) => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          return;
        }

        // For teaser items, entire node is clickable if it has a link
        if (item.type === 'teaser' && hasLink) {
          // Let the anchor tag handle the navigation
          if (event.target === nodeTitle) {
            return; // Allow default anchor behavior
          }
          window.open(item.linkURL, '_blank');
          return;
        }

        // For other items with links, clicking the title opens the link
        if (event.target === nodeTitle && hasLink) {
          return; // Allow default anchor behavior
        }

        // Prevent anchor default when clicking elsewhere on the node
        if (hasLink && event.target !== nodeTitle) {
          event.preventDefault();
        }

        if (!hasExpandable) return;
        toggleNode(item.path, treeNode);
      });
    }

    treeItem.appendChild(treeNode);

    if (item.text) {
      const richContent = document.createElement('div');
      richContent.className = 'rich-content';
      // Always make text expandable/collapsible (add tree-children class)
      if (hasTextList || isAccordionWithText || item.type === 'tab') {
        richContent.classList.add('tree-children');
        if (isExpanded) richContent.classList.add('expanded');
      }
      // Clean empty lines from accordion content
      const cleanedText = (item.type === 'accordion') ? cleanRichContent(item.text) : item.text;
      richContent.innerHTML = cleanedText;
      treeItem.appendChild(richContent);
    }

    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      if (isExpanded) childrenContainer.classList.add('expanded');

      // Check if all children are leaf items (no grandchildren), excluding text type items
      const nonTextChildren = item.items.filter((child) => child.type !== 'text');
      const allChildrenAreLeaves = nonTextChildren.length > 0 && nonTextChildren.every(
        (child) => !child.items || child.items.length === 0,
      );
      // Apply grid layout if all non-text children are leaf items
      if (allChildrenAreLeaves) {
        childrenContainer.classList.add('has-grid');
      }

      item.items.forEach((child) => {
        childrenContainer.appendChild(createTreeItem(child));
      });

      treeItem.appendChild(childrenContainer);
    }

    return treeItem;
  }

  function renderTree() {
    content.innerHTML = '';

    if (!filteredData || !filteredData.items || filteredData.items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '3rem';
      emptyState.style.color = '#666';
      emptyState.innerHTML = '<h3>🔍 No results found</h3><p>Try adjusting your search or filter criteria</p>';
      content.appendChild(emptyState);
      return;
    }

    const fragment = document.createDocumentFragment();
    filteredData.items.forEach((item) => {
      fragment.appendChild(createTreeItem(item));
    });
    content.appendChild(fragment);
  }

  function expandAllItems(items) {
    items.forEach((item) => {
      const hasChildren = item.items && item.items.length > 0;
      const hasTextList = item.text && (item.text.includes('<a') || (item.text.match(/<p>/g) || []).length > 1);
      const isAccordionWithText = item.type === 'accordion' && item.text && item.text.trim() !== '';
      if (hasChildren || hasTextList || isAccordionWithText) {
        expandedNodes.add(item.path);
      }
      if (hasChildren) expandAllItems(item.items);
    });
  }

  function filterAndRender() {
    filteredData = filterData(hierarchyData, currentSearch);
    updateStats();
    renderTree();
  }

  searchInput.addEventListener('input', (event) => {
    currentSearch = event.target.value.toLowerCase();
    if (currentSearch) {
      searchClearIcon.classList.add('visible');
      // Auto expand all when searching
      expandAllMode = true;
    } else {
      searchClearIcon.classList.remove('visible');
    }
    filterAndRender();
  });

  // Handle Escape key to clear search
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      searchClearIcon.click();
    }
  });

  searchClearIcon.addEventListener('click', () => {
    searchInput.value = '';
    currentSearch = '';
    searchClearIcon.classList.remove('visible');
    // Reset to show all items
    filteredData = hierarchyData;
    updateStats();
    renderTree();
    searchInput.focus();
  });

  expandAllBtn.addEventListener('click', () => {
    expandAllMode = true;
    if (filteredData && filteredData.items) {
      expandAllItems(filteredData.items);
      renderTree();
    }
  });

  collapseAllBtn.addEventListener('click', () => {
    expandAllMode = false;
    expandedNodes.clear();
    renderTree();
  });

  filteredData = hierarchyData;
  updateStats();
  renderTree();

  return root;
}

export default async function decorate(block) {
  let sheetPath = '';
  let sheetName = '';

  const blockKeyValues = getBlockKeyValues(block);

  sheetPath = stripHtmlAndNewlines(blockKeyValues.sheetPath);
  sheetName = stripHtmlAndNewlines(blockKeyValues.sheetName);

  if (!sheetPath) {
    block.textContent = '';
    block.appendChild(document.createTextNode('Content Stores configuration is missing the data path.'));
    return;
  }

  const contentStores = await fetchSpreadsheetData(sheetPath.toLowerCase().trim());
  const normalizedSheetName = sheetName?.toLowerCase()?.trim();
  const contentStoresData = contentStores?.[normalizedSheetName]?.data
    || contentStores?.data
    || [];

  const viewerElement = createViewerElement(contentStoresData);

  block.textContent = '';
  block.appendChild(viewerElement);
}
