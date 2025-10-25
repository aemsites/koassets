export async function fetchHelixSheet(env, path, options) {
  const headers = {};
  if (env.HELIX_ORIGIN_AUTHENTICATION) {
    headers.authorization = `token ${await env.HELIX_ORIGIN_AUTHENTICATION.get()}`;
  }

  let url = `${env.HELIX_ORIGIN}${path}.json`;
  if (options?.params) {
    url += `?${new URLSearchParams(options.params).toString()}`;
  }

  const pushInvalidation = env.HELIX_PUSH_INVALIDATION !== 'disabled';
  if (pushInvalidation) {
    headers['x-push-invalidation'] = 'enabled';
  }

  // console.log('>>>', req.method, req.url /*, req.headers*/);

  const fetchOptions = {
    headers,
  };

  if (pushInvalidation) {
    fetchOptions.cf = {
      // cf doesn't cache html by default: need to override the default behavior
      cacheEverything: true,
    };
  } else {
    // disable caching if no push invalidation is happening
    // e.g. when using workers.dev directly without a domain/zone
    fetchOptions.cache = 'no-store';
  }

  const response = await fetch(url, fetchOptions);

  // TODO: remove after debugging in production (to understand caching headers)
  console.log('fetchHelixSheet response headers:', url, Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    console.error('Failed to fetch spreadsheet:', response.status, response.statusText);
    return;
  }
  const json = await response.json();

  function handleArrays(obj, arrays) {
    arrays?.forEach(array => {
      if (obj[array]) {
        obj[array] = obj[array].split(',').map(item => item.trim());
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
        } else {
          return [name, convertRows(sheet.data, opt)];
        }
      } else {
        return [name, []];
      }
    }));
  } else if (options?.sheet) {
    if (options.sheet.key) {
      return convertToMap(json.data, options.sheet);
    } else {
      return convertRows(json.data, options.sheet);
    }
  }

  // without options return the raw json
  return json;
}

