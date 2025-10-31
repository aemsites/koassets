import { fetchSpreadsheetData } from '../../scripts/scripts.js';
import { createOptimizedPicture } from '../../scripts/aem.js';

const PATH_SEPARATOR = ' >>> ';

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

function normalizeRow(row) {
  if (!row || typeof row !== 'object') {
    return {
      path: '',
      title: '',
      imageUrl: '',
      linkURL: '',
      text: '',
    };
  }

  const linkValue = row.linkURL ?? row.linkUrl ?? '';

  return {
    path: typeof row.path === 'string' ? row.path : '',
    title: typeof row.title === 'string' ? row.title : '',
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '',
    linkURL: typeof linkValue === 'string' ? linkValue : '',
    text: typeof row.text === 'string' ? row.text : '',
  };
}

function reconstructHierarchyFromRows(rows) {
  const root = { items: [] };

  rows.forEach((row) => {
    const pathSegments = splitPathSegments(row.path);
    if (pathSegments.length === 0) return;

    let currentLevel = root;

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
          if (row.imageUrl) newItem.imageUrl = row.imageUrl;
          if (row.linkURL) newItem.linkURL = row.linkURL;
          if (row.text) newItem.text = row.text;
        }

        currentLevel.items.push(newItem);
        existingItem = newItem;
      } else if (isLastSegment) {
        existingItem.title = row.title || trimmedSegment;
        if (row.imageUrl) existingItem.imageUrl = row.imageUrl;
        if (row.linkURL) existingItem.linkURL = row.linkURL;
        if (row.text) existingItem.text = row.text;
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

function normalizeEdsBaseName(rawBaseName) {
  const patterns = [/\.from-eds$/i, /\.eds$/i];
  const matchedPattern = patterns.find((pattern) => pattern.test(rawBaseName));
  if (matchedPattern) {
    return {
      baseName: rawBaseName.replace(matchedPattern, ''),
      isEds: true,
    };
  }
  return { baseName: rawBaseName, isEds: false };
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function deriveViewerMeta(sheetPath) {
  if (!sheetPath) {
    return {
      viewerTitle: 'Content Stores (from EDS)',
      baseTitle: 'Content Stores',
    };
  }

  const cleanedPath = sheetPath.replace(/\.(json|csv)$/i, '');
  const segments = cleanedPath.split('/').filter((segment) => segment && segment.length > 0);
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : cleanedPath;
  const { baseName, isEds } = normalizeEdsBaseName(lastSegment);

  const titleParts = baseName
    .split(/[-_.]+/)
    .filter((part) => part.length > 0)
    .map((part) => capitalize(part));

  const baseTitle = titleParts.length > 0 ? titleParts.join(' ') : 'Content Stores';

  let sourceLabel = 'JSON';
  if (isEds) {
    sourceLabel = 'EDS';
  } else if (/\.csv$/i.test(sheetPath)) {
    sourceLabel = 'CSV';
  }

  return {
    viewerTitle: `${baseTitle} (from ${sourceLabel})`,
    baseTitle,
  };
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

function createViewerElement(hierarchyData) {
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
    const matchesSearch = !searchTerm
      || (item.title && item.title.toLowerCase().includes(searchTerm));
    const hadChildren = item.items && item.items.length > 0;
    const filteredChildren = item.items
      ? item.items.map((child) => filterItem(child, searchTerm)).filter(Boolean)
      : [];
    if (matchesSearch) {
      return { ...item, items: filteredChildren, hadChildren };
    }
    if (filteredChildren.length > 0) {
      return { ...item, items: filteredChildren, hadChildren };
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

    const hasChildren = item.items && item.items.length > 0;
    const hasTextList = item.text && (item.text.includes('<a') || (item.text.match(/<p>/g) || []).length > 1);
    // Use hadChildren to preserve original parent status even when filtered
    const wasParent = item.hadChildren || false;
    const hasExpandable = hasChildren || hasTextList || wasParent;
    const isExpanded = expandAllMode ? hasExpandable : expandedNodes.has(item.path);
    const hasLink = item.linkURL && item.linkURL.trim() !== '';

    const treeNode = document.createElement('div');
    treeNode.className = 'tree-node';
    if (isExpanded) treeNode.classList.add('expanded');
    treeNode.dataset.path = item.path;
    treeNode.dataset.hasChildren = hasExpandable ? 'true' : 'false';
    treeNode.dataset.hasTextList = hasTextList ? 'true' : 'false';
    treeNode.dataset.linkUrl = hasLink ? item.linkURL : '';

    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    if (isExpanded) expandIcon.classList.add('expanded');
    expandIcon.textContent = '▶';
    if (!hasExpandable) {
      expandIcon.style.visibility = 'hidden';
    }
    treeNode.appendChild(expandIcon);

    if (item.imageUrl) {
      const picture = createOptimizedPicture(item.imageUrl, item.title || '', true, [{ width: '100' }], true);
      const img = picture.querySelector('img');
      if (img) {
        img.className = 'item-image';
      }
      treeNode.appendChild(picture);
    }

    const nodeTitle = document.createElement('span');
    nodeTitle.className = 'node-title';
    if (hasLink) nodeTitle.classList.add('has-link');
    nodeTitle.textContent = item.title || '';
    treeNode.appendChild(nodeTitle);

    treeNode.addEventListener('click', (event) => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      if (event.target === nodeTitle && hasLink) {
        window.open(item.linkURL, '_blank');
        return;
      }

      if (!hasExpandable) return;
      toggleNode(item.path, treeNode);
    });

    treeItem.appendChild(treeNode);

    if (item.text) {
      const richContent = document.createElement('div');
      richContent.className = 'rich-content';
      if (hasTextList) {
        richContent.classList.add('tree-children');
        if (isExpanded) richContent.classList.add('expanded');
      }
      richContent.innerHTML = item.text;
      treeItem.appendChild(richContent);
    }

    if (hasChildren) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      if (isExpanded) childrenContainer.classList.add('expanded');
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
      if (hasChildren || hasTextList) {
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
    } else {
      searchClearIcon.classList.remove('visible');
    }
    filterAndRender();
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

  [...block.children].forEach((row) => {
    const divs = row.children;
    if (divs.length >= 1) {
      const firstCell = divs[0]?.textContent?.trim();
      if (firstCell) sheetPath = firstCell;
    }
    if (divs.length >= 2) {
      const secondCell = divs[1]?.textContent?.trim();
      if (secondCell) sheetName = secondCell;
    }
  });

  if (!sheetPath) {
    block.textContent = '';
    block.appendChild(document.createTextNode('Content Stores configuration is missing the data path.'));
    return;
  }

  const contentStores = await fetchSpreadsheetData(sheetPath, sheetName);
  const contentStoresData = Array.isArray(contentStores?.data)
    ? contentStores.data.map((row) => normalizeRow(row))
    : [];

  const hierarchyData = reconstructHierarchyFromRows(contentStoresData);
  const { viewerTitle, baseTitle } = deriveViewerMeta(sheetPath);

  const viewerElement = createViewerElement(hierarchyData, viewerTitle, baseTitle);

  block.textContent = '';
  block.appendChild(viewerElement);
}
