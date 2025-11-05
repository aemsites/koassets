const fs = require('fs');
const path = require('path');
const { PATH_SEPARATOR } = require('../constants.js');

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

function extractLinkUrl(item) {
  // Support both old format (linkURL/linkUrl) and new format (linkSources)
  if (item.linkSources && typeof item.linkSources === 'object') {
    // Use clickableUrl for all types (buttons, teasers, links, etc.)
    if (item.linkSources.clickableUrl) {
      return item.linkSources.clickableUrl;
    }
  }
  return item.linkURL ?? item.linkUrl ?? '';
}

function normalizeFlatRow(row) {
  if (!row || typeof row !== 'object') {
    return {
      path: '',
      title: '',
      imageUrl: '',
      linkURL: '',
      text: '',
    };
  }

  // For CSV rows, linkURL is already a plain string
  // For JSON items with linkSources, extractLinkUrl will extract the URL
  const linkValue = extractLinkUrl(row);

  return {
    path: typeof row.path === 'string' ? row.path : '',
    title: typeof row.title === 'string' ? row.title : '',
    imageUrl: typeof row.imageUrl === 'string' ? row.imageUrl : '',
    linkURL: typeof linkValue === 'string' ? linkValue : '',
    text: typeof row.text === 'string' ? row.text : '',
    // Preserve type if present (from CSV with type column)
    ...(row.type && { type: row.type }),
  };
}

function normalizeHierarchyItems(items) {
  if (!Array.isArray(items)) return items;

  return items.map((item) => {
    const normalized = { ...item };

    // Convert linkSources.clickableUrl to linkURL for template compatibility
    const linkUrl = extractLinkUrl(item);
    if (linkUrl) {
      normalized.linkURL = linkUrl;
    }
    // Clean up old linkSources property to avoid confusion
    if (normalized.linkSources) {
      delete normalized.linkSources;
    }

    // Recursively normalize nested items
    if (Array.isArray(normalized.items)) {
      normalized.items = normalizeHierarchyItems(normalized.items);
    }

    return normalized;
  });
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
  const fields = [];
  let currentField = '';
  let inQuotes = false;
  let index = 0;

  while (index < content.length) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 2;
        continue; // eslint-disable-line no-continue
      }

      inQuotes = !inQuotes;
      index += 1;
      continue; // eslint-disable-line no-continue
    }

    if (!inQuotes) {
      if (char === ',') {
        fields.push(currentField);
        currentField = '';
        index += 1;
        continue; // eslint-disable-line no-continue
      }

      if (char === '\n' || char === '\r') {
        if (currentField || fields.length > 0) {
          fields.push(currentField);
          rows.push([...fields]);
          fields.length = 0;
          currentField = '';
        }

        if (char === '\r' && nextChar === '\n') {
          index += 2;
        } else {
          index += 1;
        }

        continue; // eslint-disable-line no-continue
      }
    }

    currentField += char;
    index += 1;
  }

  if (currentField || fields.length > 0) {
    fields.push(currentField);
    rows.push([...fields]);
  }

  if (rows.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = rows[0];
  const dataRows = [];

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i];
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });
    dataRows.push(row);
  }

  return dataRows.map((dataRow) => normalizeFlatRow(dataRow));
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
          title: isLastSegment ? row.title : segment,
          path: pathSegments.slice(0, index + 1).join(PATH_SEPARATOR),
          items: [],
        };

        if (isLastSegment) {
          if (row.imageUrl) newItem.imageUrl = row.imageUrl;
          if (row.linkURL) newItem.linkURL = row.linkURL;
          if (row.text) newItem.text = row.text;
          if (row.type) newItem.type = row.type;
        }

        currentLevel.items.push(newItem);
        existingItem = newItem;
      } else if (isLastSegment) {
        existingItem.title = row.title;
        if (row.imageUrl) existingItem.imageUrl = row.imageUrl;
        if (row.linkURL) existingItem.linkURL = row.linkURL;
        if (row.text) existingItem.text = row.text;
        if (row.type) existingItem.type = row.type;
      }

      if (!existingItem.items) {
        existingItem.items = [];
      }

      currentLevel = existingItem;
    });
  });

  function cleanEmptyItems(obj) {
    if (!obj || !obj.items) return;

    if (obj.items.length === 0) {
      delete obj.items;
      return;
    }

    obj.items.forEach((item) => cleanEmptyItems(item));
  }

  root.items.forEach((item) => cleanEmptyItems(item));

  return root;
}

function loadHierarchyData(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.json') {
    const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    if (Array.isArray(rawData)) {
      const rows = rawData.map((row) => normalizeFlatRow(row));
      const hierarchy = reconstructHierarchyFromRows(rows);
      const rawBaseName = path.basename(inputPath, path.extname(inputPath));
      const { baseName: sanitizedBaseName, isEds } = normalizeEdsBaseName(rawBaseName);
      const baseNameOverride = isEds ? sanitizedBaseName : undefined;
      const sourceLabelOverride = isEds ? 'EDS' : 'CSV';
      const outputVariant = isEds ? 'eds' : 'csv';

      return {
        hierarchyData: hierarchy,
        sourceType: 'json',
        meta: {
          rowCount: rows.length,
          itemCount: hierarchy.items ? hierarchy.items.length : 0,
          renderVariant: 'csv',
          sourceLabelOverride,
          outputVariant,
          baseNameOverride,
        },
      };
    }

    if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.items)) {
        // Normalize the hierarchy to convert linkSources.clickableUrl to linkURL
        const normalizedData = {
          ...rawData,
          items: normalizeHierarchyItems(rawData.items),
        };
        return {
          hierarchyData: normalizedData,
          sourceType: 'json',
          meta: {
            itemCount: normalizedData.items.length,
          },
        };
      }

      // Some structures may wrap rows under a known property (e.g. "rows")
      if (Array.isArray(rawData.rows)) {
        const rows = rawData.rows.map((row) => normalizeFlatRow(row));
        const hierarchy = reconstructHierarchyFromRows(rows);
        const rawBaseName = path.basename(inputPath, path.extname(inputPath));
        const { baseName: sanitizedBaseName, isEds } = normalizeEdsBaseName(rawBaseName);
        const baseNameOverride = isEds ? sanitizedBaseName : undefined;
        const sourceLabelOverride = isEds ? 'EDS' : 'CSV';
        const outputVariant = isEds ? 'eds' : 'csv';

        return {
          hierarchyData: hierarchy,
          sourceType: 'json',
          meta: {
            rowCount: rows.length,
            itemCount: hierarchy.items ? hierarchy.items.length : 0,
            renderVariant: 'csv',
            sourceLabelOverride,
            outputVariant,
            baseNameOverride,
          },
        };
      }
    }

    throw new Error('Unsupported JSON structure: expected an object with items[] or an array of flat rows.');
  }

  if (ext === '.csv') {
    const rows = readCsv(inputPath);
    const hierarchy = reconstructHierarchyFromRows(rows);
    return {
      hierarchyData: hierarchy,
      sourceType: 'csv',
      meta: {
        rowCount: rows.length,
        itemCount: hierarchy.items ? hierarchy.items.length : 0,
      },
    };
  }

  throw new Error(`Unsupported input type: ${ext}. Expected .json or .csv`);
}

function deriveViewerTitle(inputPath, sourceType, options = {}) {
  const { baseNameOverride, sourceLabelOverride } = options;
  const baseName = baseNameOverride || path.basename(inputPath, path.extname(inputPath));
  const titleParts = baseName
    .split(/[-_.]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const baseTitle = titleParts.join(' ');
  const sourceLabel = (sourceLabelOverride || sourceType || '').toUpperCase();
  return `${baseTitle} (from ${sourceLabel})`;
}

function buildViewerHtml(templatePath, hierarchyData, viewerTitle, dirName = '') {
  const template = fs.readFileSync(templatePath, 'utf8');
  const dataStart = template.indexOf('let hierarchyData = ');

  if (dataStart === -1) {
    throw new Error('Template missing hierarchyData placeholder');
  }

  const beforeData = template.substring(0, dataStart);
  const afterDataStart = template.indexOf(';', dataStart) + 1;
  const afterData = template.substring(afterDataStart);

  const newHtml = `${beforeData}let hierarchyData = ${JSON.stringify(hierarchyData, null, 0)};${afterData}`;

  return newHtml
    .replace(/<title>.*?<\/title>/, `<title>${viewerTitle}</title>`)
    .replace(/<h1>.*?<\/h1>/, `<h1>🗂️ ${viewerTitle}</h1>`)
    .replace(/<p id="viewer-subtitle">.*?<\/p>/, `<p id="viewer-subtitle">${dirName}</p>`);
}

function getOutputHtmlPath(inputPath, sourceType, options = {}) {
  const { baseNameOverride, sourceTypeOverride } = options;
  const dir = path.dirname(inputPath);
  const baseName = baseNameOverride || path.basename(inputPath, path.extname(inputPath));
  const variant = sourceTypeOverride || sourceType;
  return path.join(dir, `${baseName}.from-${variant}.html`);
}

function normalizeEdsBaseName(rawBaseName) {
  const patterns = [/\.from-eds$/i, /\.eds$/i];
  // eslint-disable-next-line no-restricted-syntax
  for (const pattern of patterns) {
    if (pattern.test(rawBaseName)) {
      return {
        baseName: rawBaseName.replace(pattern, ''),
        isEds: true,
      };
    }
  }
  return { baseName: rawBaseName, isEds: false };
}

module.exports = {
  buildViewerHtml,
  deriveViewerTitle,
  getOutputHtmlPath,
  loadHierarchyData,
};
