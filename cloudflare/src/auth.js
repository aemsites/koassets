import { json, Router } from 'itty-router';
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import {
  createSignedCookie,
  deleteCookie,
  isValidUrl,
  setCookie,
  validateSignedCookie,
} from './utils-http.js';

const COOKIE_SESSION = 'Session';
const COOKIE_STATE = 'State';
const COOKIE_ORIGINAL_URL = 'OriginalURL';

const REQUIRED_ENV_VARS = [
  'MICROSOFT_ENTRA_TENANT_ID',
  'MICROSOFT_ENTRA_CLIENT_ID',
  'MICROSOFT_ENTRA_CLIENT_SECRET',
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

  const key = new TextEncoder().encode(env.COOKIE_SECRET);

  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    // use current domain as issuer
    .setIssuer(request.origin)
    // use same audience as MS entra IDP app
    .setAudience(env.MICROSOFT_ENTRA_CLIENT_ID)
    .setExpirationTime(env.SESSION_COOKIE_EXPIRATION || '6h')
    .setNotBefore("0m")
    .sign(key);

  return jwt;
}

async function validateSessionJWT(request, env, sessionJWT) {
  try {
    const key = new TextEncoder().encode(env.COOKIE_SECRET);

    const { payload } = await jwtVerify(sessionJWT, key, {
      issuer: request.origin,
      audience: env.MICROSOFT_ENTRA_CLIENT_ID,
      clockTolerance: 5,
    });
    return payload;

  } catch (error) {
    console.error(`Error validating ${COOKIE_SESSION} cookie: ${error.message}`);
    return null;
  }
}

async function validateMicrosoftSignInCallback(request, state) {
  const formData = await request.formData();
  if (formData.has('error')) {
    console.error('Microsoft login error:', formData);
    return null;
  }

  if (!formData.has('id_token')) {
    console.error('No id_token in form data');
    return null;
  }

  if (formData.get('state') !== state.state) {
    console.error('Invalid state parameter');
    return null;
  }

  return formData;
}

async function validateIdToken(rawIdToken, env, nonce) {
  const JWKS = createRemoteJWKSet(new URL(env.MICROSOFT_ENTRA_JWKS_URL));

  try {
    // validate id_token signature and expiry
    const { payload } = await jwtVerify(rawIdToken, JWKS, {
      audience: env.MICROSOFT_ENTRA_CLIENT_ID,
      issuer: `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/v2.0`,
    });

    console.log('User login:', payload);

    // validate nonce
    if (payload.nonce !== nonce) {
      console.error('Invalid nonce in id_token:', payload.nonce);
      return null;
    }
    // validate tenant
    if (payload.tid !== env.MICROSOFT_ENTRA_TENANT_ID) {
      console.error('Invalid tenant (tid) in id_token:', payload.tid);
      return null;
    }
    return payload;

  } catch (error) {
    console.error('Error validating id_token:', error.message);
    return null;
  }
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

function redirectToLoginPage(request, env) {
  const response = redirect(`${request.origin}${env.LOGIN_PAGE || '/public/welcome'}`);

  // set a cookie to remember the original url
  setCookie(response, COOKIE_ORIGINAL_URL, request.url, {
    // SameSite=None in order to appear later in /auth/callback which is cross-site because it originates from the OIDC provider
    SameSite: 'None',
    // Chrome wants Secure with SameSite=None and ignores it for http://localhost. Safari does not like Secure on http://localhost (non SSL)
    Secure: request.headers.get('User-Agent')?.includes('Chrome') || request.hostname !== 'localhost',
  });
  return response;
}

// middleware to check if user is authenticated
export async function withAuthentication(request, env) {
  const url = new URL(request.url);
  request.origin = url.origin;
  request.hostname = url.hostname;

  const sessionJWT = request.cookies[COOKIE_SESSION];
  if (!sessionJWT) {
    console.info('No session cookie found');
    return redirectToLoginPage(request, env);
  }

  const session = await validateSessionJWT(request, env, sessionJWT);
  if (!session) {
    // TODO: redirect to login page upon invalid session cookie?
    return new Response('Unauthorized', { status: 401 });
  }

  request.session = session;
}

// router for dedicated login & logout flows
export const authRouter = Router({
  before: [
    (request, env) => {
      const url = new URL(request.url);
      request.origin = url.origin;
      request.hostname = url.hostname;

      const missing = REQUIRED_ENV_VARS.filter((v) => !env[v]);
      if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        return new Response('Service Unavailable', { status: 503 });
      }
    }
  ],
  finally: [
    (response) => {
      console.log('Response headers:', response.headers);
    }
  ]
});

authRouter
  .get('/auth/login', async (request, env) => {
    const state = {
      state: crypto.randomUUID(),
      nonce: crypto.randomUUID(),
    };

    // redirect to MS login page
    const authorizeUrl = `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: env.MICROSOFT_ENTRA_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: `${request.origin}/auth/callback`,
        response_mode: 'form_post',
        scope: 'openid profile',
        state: state.state,
        nonce: state.nonce,
      });

    const response = redirect(authorizeUrl);
    // store state in signed cookie
    await createSignedCookie(response, env.COOKIE_SECRET, COOKIE_STATE, state, {
      // SameSite=None in order to appear later in /auth/callback which is cross-site because it originates from the OIDC provider
      SameSite: 'None',
      // Chrome wants Secure with SameSite=None and ignores it for http://localhost. Safari does not like Secure on http://localhost (non SSL)
      Secure: request.headers.get('User-Agent')?.includes('Chrome') || request.hostname !== 'localhost',
      // extra safe guarding, 10 minutes for the login flow should be enough
      MaxAge: 60 * 10,
    });
    return response;
  })

  .post('/auth/callback', async (request, env) => {
    const state = await validateSignedCookie(request, env.COOKIE_SECRET, COOKIE_STATE);
    if (!state) {
      return new Response('Unauthorized - missing or invalid state cookie', { status: 401 });
    }

    const formData = await validateMicrosoftSignInCallback(request, state);
    if (!formData) {
      return new Response('Unauthorized - error from Microsoft callback', { status: 401 });
    }

    const idToken = await validateIdToken(formData.get('id_token'), env, state.nonce);
    if (!idToken) {
      return new Response('Unauthorized - invalid id_token', { status: 401 });
    }

    const sessionJWT = await createSessionJWT(request, idToken, env);

    // get original redirect url from cookie
    let redirectUrl = `${request.origin}/`;
    const originalUrl = isValidUrl(request.cookies[COOKIE_ORIGINAL_URL]);
    // ensure it is same server and protocol
    if (originalUrl && originalUrl.origin === request.origin) {
      redirectUrl = originalUrl.href;
    }

    const response = redirect(redirectUrl);
    // set session cookie
    setCookie(response, COOKIE_SESSION, sessionJWT, {
      // SameSite=Lax because this request is considered cross-site because it originates from the OIDC provider
      SameSite: 'Lax',
      // Safari does not like Secure on http://localhost (non SSL)
      Secure: request.hostname !== 'localhost',
    });
    // remove temporary cookies
    deleteCookie(response, COOKIE_STATE);
    deleteCookie(response, COOKIE_ORIGINAL_URL);
    return response;
  })

  .get('/auth/user', withAuthentication, (request) => {
    const user = request.session;
    return json({
      name: user.name,
      email: user.email,
      country: user.country,
      usertype: user.usertype,
    });
  })

  .get('/auth/logout', (request, env) => {
    console.log('User logout:', request.session);

    // redirect to MS logout page
    const logoutUrl = `https://login.microsoftonline.com/${env.MICROSOFT_ENTRA_TENANT_ID}/oauth2/logout?` +
      new URLSearchParams({
        post_logout_redirect_uri: `${request.origin}/`,
      });

    const response = redirect(logoutUrl);
    deleteCookie(response, COOKIE_SESSION);
    return response;
  })

  .all('*', () => new Response('Not Found', { status: 404 }));
