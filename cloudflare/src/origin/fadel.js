async function createFadelToken(request, env) {
  const user = await env.FADEL_USER.get();
  const password = await env.FADEL_PASSWORD.get();

  const response = await fetch(`${env.FADEL_ORIGIN}/rc-api/authenticate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': request.headers.get('user-agent'),
    },
    body: JSON.stringify({ authRequestToken: btoa(`${user}:${password}`) }),
  });

  if (response.ok) {
    const data = await response.json();
    if (data.accessToken && data.expiryDate) {
      return data;
    } else {
      throw new Error(`Failed to generate Fadel token: ${JSON.stringify(data)}`);
    }
  } else {
    throw new Error(`Failed to generate Fadel token: ${response.status} ${response.statusText} ${await response.text()}`);
  }
}

async function getFadelToken(request, env) {
  // get cached token
  const { value: token, metadata } = await env.AUTH_TOKENS.getWithMetadata("fadel-token");

  // use token until 5 minutes before expiry
  if (token && metadata?.expiryDate > (Date.now() + 5*60*1000)) {
    return token;
  } else {
    const tokenData = await createFadelToken(request, env);

    // cache token in KV store
    await env.AUTH_TOKENS.put("fadel-token", tokenData.accessToken, {
      expiration: tokenData.expiryDate / 1000,
      metadata: {
        expiryDate: tokenData.expiryDate
      }
    });

    return tokenData.accessToken;
  }
}

export async function originFadel(request, env) {
  const url = new URL(request.url);

  const origin = env.FADEL_ORIGIN;
  const protocolAndHost = origin.split('://');
  url.port = '';
  url.protocol = protocolAndHost[0];
  url.host = protocolAndHost[1];

  // remove /api/fadel from path
  url.pathname = url.pathname.replace(/^\/api\/fadel/, '');

  const req = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  req.headers.delete('cookie');

  try {
    req.headers.set('authorization', await getFadelToken(request, env));
  } catch (error) {
    console.error(error);
    return new Response('Unauthorized', { status: 401 });
  }
  req.headers.set('user-agent', req.headers.get('user-agent'));
  req.headers.set('x-forwarded-host', req.headers.get('host'));

  // console.log('>>>', req.method, req.url, req.headers);

  const resp = await fetch(req, {
    method: req.method
  });

  // console.log('<<<', resp.status, resp.headers);

  return resp;
}