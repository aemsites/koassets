import { json } from 'itty-router';

// user configuration -----------------------------------------
const ALLOWED_EMAIL_DOMAINS = [
  'coca-cola.com',
  'adobe.com',
];

const ALLOWED_SUDO_DOMAINS = [
  'coca-cola.com',
  'adobe.com',
];
// ------------------------------------------------------------

function validateUser(session) {
  if (!session.email) {
    return false;
  }

  const emailDomain = session.email.split('@').pop();

  if (!ALLOWED_EMAIL_DOMAINS.includes(emailDomain.toLowerCase())) {
    console.warn('User denied access because email domain is not allowed:', session.email);
    return false;
  }

  return true;
}

/**
 * Create the user session cookie payload.
 * Called upon login (OIDC callback).
 *
 * @param {Request} request cloudflare request object
 * @param {Object} env cloudflare environment
 * @returns {Object} session or null/undefined if user is not allowed to access this application
 */
export function createSession(request, env) {
  const idToken = request.idToken;
  if (!idToken) {
    return null;
  }

  const session = {
    // user id in MS Entra IDP
    sub: idToken.oid,
    // full name (first + last name)
    name: idToken.name,
    // fields needed for access control
    email: idToken.email?.toLowerCase(),
    country: idToken.ctry,
    usertype: idToken.EmployeeType,
    // company - informational
    company: idToken.Company,
  };

  if (!validateUser(session)) {
    return null;
  }

  return session;
}

function canSudo(user) {
  const emailDomain = user.email.split('@').pop();

  return ALLOWED_SUDO_DOMAINS.includes(emailDomain.toLowerCase());
}

function handleSudo(request, user) {
  user.canSudo = canSudo(user);

  // check for any sudo request
  if (['SUDO_NAME',
       'SUDO_EMAIL',
       'SUDO_COUNTRY',
       'SUDO_USERTYPE'].some(c => request.cookies[c])) {

    // only certain super users are allowed to sudo
    if (!user.canSudo) {
      console.warn('Sudo denied for user:', user.email);
      return user;
    }

    // store original super user data
    user.su = {
      name: user.name,
      email: user.email,
      country: user.country,
      usertype: user.usertype,
    };

    user.name = request.cookies.SUDO_NAME || user.name;
    user.email = request.cookies.SUDO_EMAIL || user.email;
    user.country = request.cookies.SUDO_COUNTRY || user.country;
    user.usertype = request.cookies.SUDO_USERTYPE || user.usertype;
  }

  return user;
}

/**
 * Get the user object from the session cookie payload.
 * Called upon every request after validating the session cookie.
 *
 * @param {Request} request cloudflare request object
 * @param {Object} session session payload from the JWT
 * @returns {Object} user or null/undefined if user is not allowed to access this application
 */
export function getUser(request, session) {
  if (!validateUser(session)) {
    return null;
  }

  return handleSudo(request, session);
}

/**
 * Request handler returning the user information as json API for the frontend.
 *
 * @param {Request} request cloudflare request object
 * @returns {Response} json http response
 */
export function apiUser(request) {
  const user = request.user;
  return json({
    name: user.name,
    email: user.email,
    country: user.country,
    usertype: user.usertype,
    company: user.company,
    canSudo: user.canSudo,
    su: user.su,
    sessionExpiresInSec: user.exp && Math.floor((user.exp * 1000 - Date.now()) / 1000),
  });
}
