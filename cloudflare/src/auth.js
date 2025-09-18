import { json, Router } from 'itty-router';
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import {
  createSignedCookie,
  deleteCookie,
  isValidUrl,
  setCookie,
  validateSignedCookie,
} from './util/http.js';

/* Configure the URL path prefix for auth flows here */
const AUTH_PREFIX = '/auth';

const COOKIE_SESSION = 'Session';
const COOKIE_STATE = 'State';
const ORIGINAL_URL_PARAM = 'url';

const REQUIRED_ENV_VARS = [
  'MICROSOFT_ENTRA_TENANT_ID',
  'MICROSOFT_ENTRA_CLIENT_ID',
  'MICROSOFT_ENTRA_JWKS_URL',
  'COOKIE_SECRET',
];

async function createSessionJWT(request, idToken, env) {
  const payload = {
    // session id
    sid: crypto.randomUUID(),
    // user id in MS Entra IDP
    sub: idToken.oid,
    name: idToken.name,
    email: idToken.email,
    country: idToken.ctry,
    usertype: idToken.usertype,
  };

  const key = new TextEncoder().encode(await env.COOKIE_SECRET.get());

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    // use current domain as issuer
    .setIssuer(request.uri.origin)
    // use same audience as MS entra IDP app
    .setAudience(env.MICROSOFT_ENTRA_CLIENT_ID)
    .setExpirationTime(env.SESSION_COOKIE_EXPIRATION || '6h')
    .setNotBefore("0m")
    .sign(key);

  return jwt;
}

async function validateSessionJWT(request, env, sessionJWT) {
  try {
    const key = new TextEncoder().encode(await env.COOKIE_SECRET.get());

    const { payload } = await jwtVerify(sessionJWT, key, {
      issuer: request.uri.origin,
      audience: env.MICROSOFT_ENTRA_CLIENT_ID,
      clockTolerance: 5,
    });
    return payload;

  } catch (error) {
    request.error = `Invalid ${COOKIE_SESSION} cookie: ${error.message}`;
    return null;
  }
}

async function validateMicrosoftSignInCallback(request, state) {
  const formData = await request.formData();
  if (formData.has('error')) {
    request.error = `Microsoft OIDC error: ${formData.get('error')} - ${formData.get('error_description')}`;
    return null;
  }

  if (!formData.has('id_token')) {
    request.error = 'Microsoft OIDC error: No id_token in form data';
    return null;
  }

  if (formData.get('state') !== state) {
    request.error = 'OIDC error: Invalid state parameter';
    return null;
  }

  return formData;
}

async function validateIdToken(request, rawIdToken, env, nonce) {
  const jwksUrl = env.MICROSOFT_ENTRA_JWKS_URL || 'https://login.microsoftonline.com/common/discovery/keys';
  const JWKS = createRemoteJWKSet(new URL(jwksUrl));

  try {
    // validate id_token signature and expiry
    const { payload } = await jwtVerify(rawIdToken, JWKS, {
      audience: env.MICROSOFT_ENTRA_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/v2.0`,
    });

    console.log('User login:', payload);

    // validate nonce
    if (payload.nonce !== nonce) {
      request.error = `OIDC error: Invalid nonce in id_token: ${payload.nonce}`;
      return null;
    }
    // validate tenant
    if (payload.tid !== env.MICROSOFT_ENTRA_TENANT_ID) {
      request.error = `OIDC error: Invalid tenant (tid) in id_token: ${payload.tid}`;
      return null;
    }
    return payload;

  } catch (error) {
    request.error = `OIDC error: Invalid id_token: ${error.message}`;
    return null;
  }
}

function unauthorized(request) {
  if (request.error) {
    console.error(request.error);
    return new Response(`Unauthorized - ${request.error}`, { status: 401 });
  }
  return new Response('Unauthorized', { status: 401 });
}

function redirect(url, status = 302) {
  const response = new Response(null, { status });
  response.headers.set('Location', url);
  return response;

  // TODO: use one of these redirect tricks below to get the original page into the browser history?

  // also redirect() which does HTTP 302 redirect

  // const page = `<meta http-equiv="refresh" content="1;url=${targetUrl}">`;
  // // const page = `<script>window.location.href = "${targetUrl}";</script>`;
  // // const redirectPage = `
  // // <html>
  // //   <head>
  // //     <title>${request.url}</title>
  // //   </head>
  // //   <body>
  // //     <script>
  // //       window.location.assign("${targetUrl}");
  // //     </script>
  // //   </body>
  // // </html>
  // // `;
  // return new Response(page, {
  //   headers: {
  //     'Content-Type': 'text/html',
  //   },
  // });
}

function redirectToLoginPage(request, env, page = env.LOGIN_PAGE) {
  // build login page url
  const loginPage = new URL(request.uri.origin);
  loginPage.pathname = page || `${AUTH_PREFIX}/login`;

  // with original url path and query string as parameter
  const originalUrl = new URL(request.url);
  const url = originalUrl.pathname + originalUrl.search;
  if (url !== '/') {
    loginPage.searchParams.append(ORIGINAL_URL_PARAM, url);
  }

  const response = redirect(loginPage.href);

  // ensure session cookie is deleted (might be set but invalid)
  deleteCookie(response, COOKIE_SESSION);

  return response;
}

// middleware to check if user is authenticated
export async function withAuthentication(request, env) {
  request.uri = new URL(request.url);

  if (env.DISABLE_AUTHENTICATION) {
    request.session = {};
    console.warn('Authentication is disabled because DISABLE_AUTHENTICATION is set');
    return;
  }

  const sessionJWT = request.cookies[COOKIE_SESSION];
  if (!sessionJWT) {
    console.log('No session cookie found');
    return redirectToLoginPage(request, env);
  }

  const session = await validateSessionJWT(request, env, sessionJWT);
  if (!session) {
    console.error(request.error);
    // if session cookie was found but invalid, user was previously logged in,
    // so let's send them straight to the MS login page which might auto-login them
    return redirectToLoginPage(request, env, `${AUTH_PREFIX}/login`);
  }

  // authenticated
  request.session = session;
}

// router for dedicated login & logout flows
export const authRouter = Router({
  base: AUTH_PREFIX,
  route: `${AUTH_PREFIX}/*`,
  before: [
    (request, env) => {
      request.uri = new URL(request.url);

      const missing = REQUIRED_ENV_VARS.filter((v) => !env[v]);
      if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        return new Response('Service Unavailable', { status: 503 });
      }
    }
  ],
});

authRouter
  .get('/login', async (request, env) => {
    // build redirect_uri
    const redirectUrl = new URL(request.uri.origin);
    redirectUrl.pathname = `${AUTH_PREFIX}/callback`;

    // find the original url
    const url = new URL(request.url);
    // first look for an explicit query parameter (if present)
    let originalUrl = url.searchParams.get(ORIGINAL_URL_PARAM);
    if (!originalUrl) {
      // fallback to Referer header
      const referer = isValidUrl(request.headers.get('Referer'));
      if (referer && referer.origin === request.uri.origin) {
        // extract the original url from the Referer header
        originalUrl = referer.searchParams.get(ORIGINAL_URL_PARAM);
      }
    }

    const state = {
      // pass over original url inside the state parameter as that's the only way to pass back user data
      state: crypto.randomUUID() + (originalUrl ? `|${originalUrl}` : ''),
      nonce: crypto.randomUUID(),
    };

    // redirect to MS login page
    const authorizeUrl = `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: env.MICROSOFT_ENTRA_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: redirectUrl.href,
        response_mode: 'form_post',
        scope: 'openid profile',
        state: state.state,
        nonce: state.nonce,
      });

    const response = redirect(authorizeUrl);

    const userAgent = request.headers.get('User-Agent');

    // store state in signed cookie
    await createSignedCookie(response, await env.COOKIE_SECRET.get(), COOKIE_STATE, state, {
      // SameSite=None in order to appear later in /auth/callback which is cross-site because it originates from the OIDC provider
      SameSite: 'None',
      // Chrome wants Secure with SameSite=None and ignores it for http://localhost. Safari does not like Secure on http://localhost (non SSL)
      Secure: userAgent?.includes('Chrome') || userAgent?.includes('Firefox') || request.uri.hostname !== 'localhost',
      // extra safe guarding, 10 minutes for the login flow should be enough
      MaxAge: 60 * 10,
    });
    return response;
  })

  .post('/callback', async (request, env) => {
    const state = await validateSignedCookie(request, await env.COOKIE_SECRET.get(), COOKIE_STATE);
    if (!state) {
      return unauthorized(request);
    }

    const formData = await validateMicrosoftSignInCallback(request, state.state);
    if (!formData) {
      return unauthorized(request);
    }

    const idToken = await validateIdToken(request, formData.get('id_token'), env, state.nonce);
    if (!idToken) {
      return unauthorized(request);
    }

    const sessionJWT = await createSessionJWT(request, idToken, env);

    let redirectUrl = `${request.uri.origin}/`;
    // get original redirect url from state parameter (if present)
    const originalUrl = state.state.split('|')[1];
    if (originalUrl?.startsWith('/')
        && originalUrl !== env.LOGIN_PAGE
        && originalUrl !== `${AUTH_PREFIX}/login`) {
      redirectUrl = originalUrl;
    }

    const response = redirect(redirectUrl);
    // set session cookie
    setCookie(response, COOKIE_SESSION, sessionJWT, {
      // SameSite=Lax because this request is considered cross-site because it originates from the OIDC provider
      SameSite: 'Lax',
      // Safari does not like Secure on http://localhost (non SSL)
      Secure: request.uri.hostname !== 'localhost',
    });
    // remove temporary cookies
    deleteCookie(response, COOKIE_STATE);
    return response;
  })

  .get('/user', withAuthentication, (request) => {
    const user = request.session;
    return json({
      name: user.name,
      email: user.email,
      country: user.country,
      usertype: user.usertype,
      sessionExpiresInSec: user.exp && Math.floor((user.exp * 1000 - Date.now()) / 1000),
    });
  })

  .get('/logout', withAuthentication, (request, env) => {
    console.log('User logout:', request.session);

    // redirect to MS logout page
    const logoutUrl = `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/oauth2/logout?` +
      new URLSearchParams({
        post_logout_redirect_uri: `${request.uri.origin}/`,
      });

    const response = redirect(logoutUrl);
    deleteCookie(response, COOKIE_SESSION);
    return response;
  })

  .all('*', () => new Response('Not Found', { status: 404 }));
