export async function fetchHelixSheet(env, path, options) {
  const headers = {};
  if (env.HELIX_ORIGIN_AUTHENTICATION) {
    headers.authorization = `token ${await env.HELIX_ORIGIN_AUTHENTICATION.get()}`;
  }

  const response = await fetch(`${env.HELIX_ORIGIN}${path}.json`, {
    // TODO: remove this once we have cache invalidation working
    cache: 'no-store',
    headers,
  });
  if (!response.ok) {
    console.error('Failed to fetch spreadsheet:', response.status, response.statusText);
    return;
  }
  const json = await response.json();

  function handleArrays(obj, arrays) {
    arrays?.forEach((array) => {
      if (obj[array]) {
        obj[array] = obj[array].split(',').map((item) => item.trim());
      } else {
        obj[array] = [];
      }
    });
  }

  function convertToMap(rows, options) {
    rows = rows || [];
    return rows.reduce((map, row) => {
      const key = row[options.key];
      if (options.value) {
        map[key] = row[options.value];
      } else {
        map[key] = { ...row };
        handleArrays(map[key], options.arrays);
      }
      return map;
    }, {});
  }

  function convertRows(rows, options) {
    rows = rows || [];
    rows.forEach((row) => {
      handleArrays(row, options.arrays);
    });
    return rows;
  }

  // convert to simpler objects
  if (options?.sheets) {
    return Object.fromEntries(Object.entries(options.sheets).map(([name, opt]) => {
      const sheet = json[name];
      if (sheet) {
        if (opt?.key) {
          return [name, convertToMap(sheet.data, opt)];
        }
        return [name, convertRows(sheet.data, opt)];
      }
      return [name, []];
    }));
  } if (options?.sheet) {
    if (options.sheet.key) {
      return convertToMap(json.data, options.sheet);
    }
    return convertRows(json.data, options.sheet);
  }

  // without options return the raw json
  return json;
}
