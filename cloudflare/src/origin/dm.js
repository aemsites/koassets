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

  req.headers.set('user-agent', req.headers.get('user-agent'));
  req.headers.set('x-forwarded-host', req.headers.get('host'));

  if (env.DM_CLIENT_ID) {
    req.headers.set('x-api-key', await env.DM_CLIENT_ID.get());
  }

  if (env.DM_ACCESS_TOKEN) {
    req.headers.set('Authorization', `Bearer ${await env.DM_ACCESS_TOKEN.get()}`);
  }

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