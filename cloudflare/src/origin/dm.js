import { ROLE } from '../user';
import { decodeJwt } from 'jose';
import { fetchHelixSheet } from '../util/helixutil';

// create IMS token using Oauth server-to-server credentials
async function createIMSToken(request, clientId, clientSecret, scope) {
  const response = await fetch('https://ims-na1.adobelogin.com/ims/token/v4', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': request.headers.get('user-agent'),
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope,
    }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data.access_token && data.expires_in) {
      return data;
    } else {
      throw new Error(`Failed to generate IMS token: ${JSON.stringify(data)}`);
    }
  } else {
    throw new Error(`Failed to generate IMS token: ${response.status} ${response.statusText} ${await response.text()}`);
  }
}

async function getIMSToken(request, env) {
  try {
    // get cached token
    const { value: token, metadata } = await env.AUTH_TOKENS.getWithMetadata("dm-ims-token");

    // use token until 5 minutes before expiry
    if (token && metadata?.expiration > (Math.floor(Date.now() / 1000) + 5*60)) {
      return token;
    } else {
      const clientId = await env.DM_CLIENT_ID.get();
      const clientSecret = await env.DM_CLIENT_SECRET.get();
      const scope = 'AdobeID,openid';

      const tokenData = await createIMSToken(request, clientId, clientSecret, scope);

      // seconds since epoch
      const expiration = Math.floor(Date.now() / 1000) + tokenData.expires_in;

      // cache token in KV store
      await env.AUTH_TOKENS.put("dm-ims-token", tokenData.access_token, {
        expiration,
        metadata: {
          expiration
        }
      });

      return tokenData.access_token;
    }
  } catch (error) {
    console.error(error);
    return;
  }
}

function setIndexName(search, indexName) {
  // for each request in search.requests
  search.requests?.forEach(request => {
    request.indexName = indexName;
  });
}

function forceSearchFilter(search, constraint) {
  // skip if constraint is empty or not set
  if (!constraint || constraint.length === 0) {
    return;
  }

  for (let i = 0; i < search.requests?.length; i++) {
    const searchReq = search.requests[i];

    const filter = searchReq.params.filters;
    if (!filter || filter.length === 0) {
      searchReq.params.filters = constraint;
    } else if (filter.startsWith('(')) {
      searchReq.params.filters = `${filter} AND ${constraint}`;
    } else {
      searchReq.params.filters = `(${filter}) AND ${constraint}`;
    }
  }
}

function collectionsSearchAuthorization(request, search) {
  const user = request.user;
  const userEmail = user.email?.toLowerCase();

  if (!userEmail) {
    search.requests = [];
    return;
  }

  // Build ACL filter: user must be owner, editor, or viewer
  const aclFilter = [
    `'collectionMetadata.tccc:metadata.tccc:acl.tccc:assetCollectionOwner':'${userEmail}'`,
    `'collectionMetadata.tccc:metadata.tccc:acl.tccc:assetCollectionEditor':'${userEmail}'`,
    `'collectionMetadata.tccc:metadata.tccc:acl.tccc:assetCollectionViewer':'${userEmail}'`,
  ].join(' OR ');

  forceSearchFilter(search, `(${aclFilter})`);
  console.log(`[${userEmail}] collections search filter applied`);
}

async function validateCollectionAccess(collectionId, userEmail, requiredRole, imsToken, dmOrigin) {
  // Fetch collection metadata
  const metadataUrl = `${dmOrigin}/adobe/assets/collections/${collectionId}`;
  const response = await fetch(metadataUrl, {
    headers: {
      'Authorization': `Bearer ${imsToken}`,
      'x-api-key': 'aem-assets-content-hub-1',
    },
  });

  if (!response.ok) {
    return { allowed: false, reason: 'collection not found' };
  }

  const collection = await response.json();
  const acl = collection?.collectionMetadata?.['tccc:metadata']?.['tccc:acl'];

  if (!acl) {
    return { allowed: false, reason: 'no ACL' };
  }

  // Check owner (has all permissions)
  if (acl['tccc:assetCollectionOwner']?.toLowerCase() === userEmail) {
    return { allowed: true, role: 'owner' };
  }

  // Check editor (write permission, also grants read)
  if (Array.isArray(acl['tccc:assetCollectionEditor']) &&
      acl['tccc:assetCollectionEditor'].some((e) => e.toLowerCase() === userEmail)) {
    return { allowed: true, role: 'editor' };
  }

  // Check viewer (read permission only)
  if (requiredRole === 'read' &&
      Array.isArray(acl['tccc:assetCollectionViewer']) &&
      acl['tccc:assetCollectionViewer'].some((e) => e.toLowerCase() === userEmail)) {
    return { allowed: true, role: 'viewer' };
  }

  return { allowed: false, reason: 'not in ACL' };
}

async function searchAuthorization(request, env, search) {
  const user = request.user;

  // Algolia search request. Enforce a filter that ensures only authorized assets are returned
  // https://www.algolia.com/doc/api-reference/api-parameters/filters

  // if user roles is empty, make the search return nothing
  if (user.roles.length === 0) {
    search.requests = [];
    return;
  }

  // RESTRICTED BRAND CHECK
  const restrictedBrands = await fetchHelixSheet(env, '/config/access/restricted-brands', { params: { limit: 1 } });
  // determine all restricted brands that the user has no access to
  const deniedBrands = restrictedBrands?.[':names']?.filter(b => !user.brands.includes(b)) || [];
  const brandCheck = `${deniedBrands.map(b => `NOT tccc-brand._tagIDs:'tccc:brand/${b}'`).join(' AND ')}`;

  // INTENDED BOTTLER COUNTRY CHECK
  let bottlerCountryCheck = '';
  // these users can see every bottler country
  if (![ROLE.EMPLOYEE, ROLE.CONTINGENT_WORKER, ROLE.AGENCY].some(r => user.roles.includes(r))) {
    const countries = user.bottlerCountries || [];
    // bottlers can see content intended for all countries
    if (user.roles.includes(ROLE.BOTTLER)) {
      countries.push('all-countries');
    }
    if (countries.length > 0) {
      // only allow countries the user has access to
      bottlerCountryCheck = `(${countries.map(c => `tccc-intendedBottlerCountry:'${c}'`).join(' OR ')})`;
    } else {
      // should normally not happen, but safety net to ensure no hits
      bottlerCountryCheck = `tccc-intendedBottlerCountry:'___does_not_exist___'`;
    }
  }

  // INTENDED CUSTOMER CHECK
  const customerCheck = `(NOT tccc-assetType:'customers'${user.customers.map(c => ` OR tccc-intendedCustomers:'${c}'`).join('')})`;

  // all checks are required (AND)
  const constraint = [bottlerCountryCheck, customerCheck, brandCheck].filter(c => c).join(' AND ');
  console.log(`[${request.user.email}] authz filter: ${constraint}`);

  forceSearchFilter(search, constraint);
}

export async function originDynamicMedia(request, env) {
  // incoming url:
  //   <host>/api/adobe/assets/...
  // origin url:
  //   delivery-pXX-eYY.adobeaemcloud.com/adobe/assets/...

  const dmOrigin = env.DM_ORIGIN;
  const match = dmOrigin.match(/^https:\/\/(delivery-p(.*)-e(.*)\.adobeaemcloud\.com)$/);
  if (!match) {
    return new Response('Invalid DM_ORIGIN', { status: 500 });
  }

  const envId = `${match[2]}-${match[3]}`;

  const url = new URL(request.url);
  url.protocol = 'https';
  url.host = match[1];
  url.port = '';

  // remove /api from path
  url.pathname = url.pathname.replace(/^\/api/, '');

  const headers = new Headers(request.headers);
  let body = request.body;

  // set DM authorization
  const imsToken = await getIMSToken(request, env);
  if (!imsToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (url.pathname.startsWith('/adobe/assets/collections')) {
    headers.set('x-api-key', 'aem-assets-content-hub-1');
  } else {
    headers.set('x-api-key', await env.DM_CLIENT_ID.get());
  }
  headers.set('Authorization', `Bearer ${imsToken}`);
  headers.delete('cookie');

  // rewrite search requests
  if (url.pathname.startsWith('/adobe/assets/search')) {
    headers.set('x-ch-request', 'search');

    // support referencing the technical account user id in queries
    const imsUserId = decodeJwt(imsToken).user_id;
    body = await request.text();
    body = body.replaceAll('{{SYSTEM_USER_ID}}', imsUserId);

    const search = JSON.parse(body);

    if (url.pathname === '/adobe/assets/search-collections') {
      collectionsSearchAuthorization(request, search);
      url.pathname = '/adobe/assets/search';
      setIndexName(search, `${envId}_collections`);
    } else {
      await searchAuthorization(request, env, search);
      setIndexName(search, envId);
    }

    body = JSON.stringify(search);
  }

  // access to experimental APIs
  headers.set('x-adobe-accept-experimental', '1');

  // general proxying best practices
  headers.set('user-agent', headers.get('user-agent'));
  headers.set('x-forwarded-host', headers.get('host'));

  // Authorization check for individual collection operations
  if (url.pathname.match(/^\/adobe\/assets\/collections\/[^/]+$/)) {
    const collectionId = url.pathname.split('/').pop();
    const requiredRole = (request.method === 'GET') ? 'read' : 'write';

    const access = await validateCollectionAccess(
      collectionId,
      request.user.email?.toLowerCase(),
      requiredRole,
      imsToken,
      dmOrigin,
    );

    if (!access.allowed) {
      console.warn(`[${request.user.email}] denied ${request.method} on collection ${collectionId}: ${access.reason}`);
      return new Response('Forbidden', { status: 403 });
    }

    console.log(`[${request.user.email}] allowed ${request.method} on collection ${collectionId} as ${access.role}`);
  }

  // Authorization check for collection items endpoint
  if (url.pathname.match(/^\/adobe\/assets\/collections\/[^/]+\/items$/)) {
    const collectionId = url.pathname.split('/')[4];
    const requiredRole = (request.method === 'GET') ? 'read' : 'write';

    const access = await validateCollectionAccess(
      collectionId,
      request.user.email?.toLowerCase(),
      requiredRole,
      imsToken,
      dmOrigin,
    );

    if (!access.allowed) {
      console.warn(`[${request.user.email}] denied ${request.method} on collection items ${collectionId}: ${access.reason}`);
      return new Response('Forbidden', { status: 403 });
    }

    console.log(`[${request.user.email}] allowed ${request.method} on collection items ${collectionId} as ${access.role}`);
  }

  // console.log('>>>', request.method, url, headers);

  const response = await fetch(url, {
    method: request.method,
    headers: headers,
    body: body,
    cf: {
      // cf doesn't cache all file types by default: need to override the default behavior
      // https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#default-cached-file-extensions
      cacheEverything: true,
    },
  });

  // console.log('<<<', response.status, response.headers);

  return response;
}
