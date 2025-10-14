import { ROLE } from '../user';

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
}

function forceSearchFilter(request, search, constraint) {
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

    console.log(`Search filter [${i}] for ${request.user.email}: ${searchReq.params.filters}`);
  }
}

async function searchAuthorization(request) {
  const user = request.user;
  const search = await request.json();

  // RESTRICTED BRAND CHECK
  // TODO: DISABLED until we have the right search index support
  const restrictedBrand = '';

  // INTENDED BOTTLER COUNTRY CHECK
  let intendedBottlerCountry = '';
  // these users can see every bottler country
  if (![ROLE.EMPLOYEE, ROLE.CONTINGENT_WORKER, ROLE.AGENCY].some(r => user.roles.includes(r))) {
    const countries = user.bottlerCountries || [];
    if (user.roles.includes(ROLE.BOTTLER)) {
      countries.push('all-countries');
    }
    if (countries.length > 0) {
      intendedBottlerCountry = `(${countries.map(c => `tccc-intendedBottlerCountry:'${c}'`).join(' OR ')})`;
    } else {
      // should normally not happen, but safety net: ensure no hits
      intendedBottlerCountry = `tccc-intendedBottlerCountry:'___does_not_exist___'`;
    }
  }

  // INTENDED CUSTOMER CHECK
  const intendedCustomer = `(NOT tccc-assetType:'customers'${user.customers.map(c => ` OR tccc-intendedCustomers:'${c}'`).join('')})`;

  // all checks are required (AND)
  const constraint = [restrictedBrand, intendedBottlerCountry, intendedCustomer].filter(c => c).join(' AND ');

  forceSearchFilter(request, search, constraint);

  return JSON.stringify(search);
}

export async function originDynamicMedia(request, env) {
  // incoming url:
  //   <host>/api/adobe/assets/...
  // origin url:
  //   delivery-pXX-eYY.adobeaemcloud.com/adobe/assets/...

  const url = new URL(request.url);

  const dmOrigin = env.DM_ORIGIN;
  if (!dmOrigin.match(/^https:\/\/delivery-p.*-e.*\.adobeaemcloud\.com$/)) {
    return new Response('Invalid DM_ORIGIN', { status: 500 });
  }
  const protocolAndHost = dmOrigin.split('://');
  url.port = '';
  url.protocol = protocolAndHost[0];
  url.host = protocolAndHost[1];

  // remove /api from path
  url.pathname = url.pathname.replace(/^\/api/, '');

  let body = request.body;
  if (url.pathname === '/adobe/assets/search') {
    body = await searchAuthorization(request);
  }

  const req = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: body,
  });

  req.headers.delete('cookie');

  try {
    req.headers.set('x-api-key', await env.DM_CLIENT_ID.get());
    req.headers.set('Authorization', `Bearer ${await getIMSToken(request, env)}`);
  } catch (error) {
    console.error(error);
    return new Response('Unauthorized', { status: 401 });
  }

  req.headers.set('user-agent', req.headers.get('user-agent'));
  req.headers.set('x-forwarded-host', req.headers.get('host'));

  // console.log('>>>', req.method, req.url, req.headers);

  const resp = await fetch(req, {
    method: req.method,
    cf: {
      // cf doesn't cache all file types by default: need to override the default behavior
      // https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#default-cached-file-extensions
      cacheEverything: true,
    },
  });

  // console.log('<<<', resp.status, resp.headers);

  return resp;
}