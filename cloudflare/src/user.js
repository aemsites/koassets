import { json } from 'itty-router';
import { fetchHelixSheet } from './util/helixutil.js';

export const ROLE = {
  EMPLOYEE: 'employee',
  CONTINGENT_WORKER: 'contingent-worker',
  AGENCY: 'agency',
  BOTTLER: 'bottler',
};

function getEmailDomain(email) {
  return email.split('@').pop().toLowerCase();
}

function pushUnique(array, items) {
  items = Array.isArray(items) ? items : [items];
  array.push(...items.filter(item => !array.includes(item)));
}

async function getUserAttributes(env, user) {
  const email = user.email;
  const domain = user.domain;

  const attributes = {
    roles: [],
    bottlerCountries: [],
    customers: [],
    // restrictedBrands: [],
  };

  // detailed user attributes / permissions

  // detect TCCC workers based on employee type in IDP
  if (domain === 'coca-cola.com') {
    if (user.employeeType === '10') {
      attributes.roles.push(ROLE.EMPLOYEE);
    } else if (user.employeeType === '11') {
      attributes.roles.push(ROLE.CONTINGENT_WORKER);
    }
  }

  const companies = await fetchHelixSheet(env, '/config/access/companies', {
    sheets: {
      customers: { key: 'domain' },
      bottlers:  { key: 'domain', arrays: ['countries'] },
      agencies:  { key: 'domain' },
    }
  });

  if (companies.customers[domain]) {
    pushUnique(attributes.customers, companies.customers[domain].name);
  }

  if (companies.bottlers[domain]) {
    pushUnique(attributes.roles, ROLE.BOTTLER);
    pushUnique(attributes.bottlerCountries, companies.bottlers[domain].countries);
  }

  if (companies.agencies[domain]) {
    pushUnique(attributes.roles, ROLE.AGENCY);
  }

  const users = await fetchHelixSheet(env, '/config/access/users', {
    sheet: {
      key: 'email',
      arrays: ['roles', 'bottlerCountries', 'customers']
    }
  });

  const userOverride = users[email];
  if (userOverride) {
    pushUnique(attributes.roles, userOverride.roles);
    pushUnique(attributes.bottlerCountries, userOverride.bottlerCountries);
    pushUnique(attributes.customers, userOverride.customers);
  }

  // use bottler country from IDP if not configured in EDS sheets
  if (attributes.roles.includes(ROLE.BOTTLER) && attributes.bottlerCountries.length === 0 && user.country) {
    attributes.bottlerCountries.push(user.country);
  }

  // make all attributes.bottlerCountries lowercase
  attributes.bottlerCountries = attributes.bottlerCountries.map(c => c.toLowerCase());

  return attributes;
}

async function handleSudo(request, env, user) {
  // check for any sudo request
  if (['SUDO_NAME',
       'SUDO_EMAIL',
       'SUDO_COUNTRY',
       'SUDO_EMPLOYEE_TYPE',
       ].some(c => request.cookies[c])) {

    // only certain super users are allowed to sudo
    if (!user.permissions.includes('sudo')) {
      console.warn('Sudo denied for user:', user.email);
      return user;
    }

    // store original super user data
    user.su = {
      name: user.name,
      email: user.email,
      country: user.country,
      employeeType: user.employeeType,
    };

    user.name = request.cookies.SUDO_NAME || user.name;
    user.email = request.cookies.SUDO_EMAIL || user.email;
    user.country = request.cookies.SUDO_COUNTRY || user.country;
    user.employeeType = request.cookies.SUDO_EMPLOYEE_TYPE || user.employeeType;

    const attributes = await getUserAttributes(env, {
      email: user.email,
      domain: getEmailDomain(user.email),
      country: user.country,
      employeeType: user.employeeType,
    });
    user = {
      ...user,
      ...attributes,
    };
  }

  return user;
}

/**
 * Create the user session cookie payload.
 * Called upon login (OIDC callback).
 *
 * @param {Request} request cloudflare request object
 * @param {Object} env cloudflare environment
 * @returns {Object} session or null/undefined if user is not allowed to access this application
 */
export async function createSession(request, env) {
  const idToken = request.idToken;
  if (!idToken && !idToken.email) {
    return null;
  }

  const email = idToken.email?.toLowerCase();
  const domain = getEmailDomain(email);

  // basic access & permissions
  const access = await fetchHelixSheet(env, '/config/access/permissions', {
    sheet: { key: 'email', arrays: ['permissions'] },
  });

  if (!access[domain] && !access[email]) {
    console.warn('User email or domain not listed in /config/access/permissions sheet:', email);
    return false;
  }

  const permissions = [
    ...(access[domain]?.permissions || []),
    ...(access[email]?.permissions || []),
  ];

  // build user attributes used for authorization
  const attributes = await getUserAttributes(env, {
    email,
    domain,
    country: idToken.ctry,
    employeeType: idToken.EmployeeType,
  });

  const session = {
    // user id in MS Entra IDP
    sub: idToken.oid,
    // full name (first + last name)
    name: idToken.name,

    // key IDP attributes (needed for sudo)
    email,
    country: idToken.ctry,
    employeeType: idToken.EmployeeType,

    // company - informational
    company: idToken.Company,

    permissions,

    ...attributes,
  };

  console.log('New Session cookie:', session);

  return session;
}

/**
 * Get the user object from the session cookie payload.
 * Called upon every request after validating the session cookie.
 *
 * @param {Request} request cloudflare request object
 * @param {Object} env cloudflare environment
 * @param {Object} session session payload from the JWT
 * @returns {Object} user or null/undefined if user is not allowed to access this application
 */
export async function getUser(request, env, session) {
  return handleSudo(request, env, session);
}

/**
 * Request handler returning the user information as json API for the frontend.
 *
 * @param {Request} request cloudflare request object
 * @returns {Response} json http response
 */
export async function apiUser(request, _env) {
  const user = {
    ...request.user,
    sessionExpiresInSec: request.user.exp && Math.floor((request.user.exp * 1000 - Date.now()) / 1000),
  };

  // remove session cookie metadata
  delete user.sub;
  delete user.sid;
  delete user.iss;
  delete user.aud;
  delete user.exp;
  delete user.nbf;

  return json(user);
}
