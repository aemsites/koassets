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

  const req = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
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