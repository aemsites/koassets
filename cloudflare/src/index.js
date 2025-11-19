/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { error, Router, withCookies } from 'itty-router';
import { authRouter, withAuthentication } from './auth';
import { originDynamicMedia } from './origin/dm';
import { originHelix } from './origin/helix';
import { originFadel } from './origin/fadel';
import { cors } from './util/itty';
import { apiUser } from './user';
import { savedSearchesApi } from './api/savedsearches';
import { rightsRequestsApi } from './api/rightsrequests';
import { notificationsApi } from './api/notifications';
import { handlePdfConfig } from './api/pdfconfig';

// Shared CORS origins
const allowedOrigins = [
  'https://koassets.adobeaem.workers.dev',
  // development URLs
  /https:\/\/.*-koassets\.adobeaem\.workers\.dev$/,
  /https:\/\/.*-koassets--aemsites\.aem\.(live|page)$/,
  /http:\/\/localhost:(3000|8787)/
];

// Standard CORS for most routes (GET, POST only)
const { preflight, corsify } = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST'],
  credentials: true,
  maxAge: 600,
});

// Extended CORS for Saved Searches API routes (includes DELETE, PUT)
const { preflight: savedSearchesPreflight, corsify: savedSearchesCorsify } = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'DELETE', 'PUT'],
  credentials: true,
  maxAge: 600,
});

// Extended CORS for Messages API routes (includes DELETE)
const { preflight: messagesPreflight, corsify: messagesCorsify } = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'DELETE'],
  credentials: true,
  maxAge: 600,
});

// Middleware to apply extended CORS for saved searches and messages routes
const savedSearchesCorsMiddleware = (request) => {
  if (request.url.includes('/api/savedsearches/')) {
    return savedSearchesPreflight(request);
  }
  if (request.url.includes('/api/messages')) {
    return messagesPreflight(request);
  }
  return preflight(request);
};

// Finally middleware that applies appropriate CORS
const finalCorsMiddleware = (response, request) => {
  if (request.url.includes('/api/savedsearches/')) {
    return savedSearchesCorsify(response, request);
  }
  if (request.url.includes('/api/messages')) {
    return messagesCorsify(response, request);
  }
  return corsify(response, request);
};

const router = Router({
  before: [savedSearchesCorsMiddleware],
  finally: [finalCorsMiddleware],
  catch: (err) => {
    // log stack traces for debugging
    console.error('error', err);
    throw err;
  },
});

router
  // public content
  .get('/public/*', originHelix)
  .get('/tools/*', originHelix)
  .get('/scripts/*', originHelix)
  .get('/styles/*', originHelix)
  .get('/blocks/*', originHelix)
  .get('/fonts/*', originHelix)
  .get('/icons/*', originHelix)
  .get('/favicon.ico', originHelix)
  .get('/robots.txt', originHelix)

  // parse cookies (middleware)
  .all('*', withCookies)
  // decode cookie values (not done by itty-router withCookies)
  .all('*', (request) => {
    for (const key in request.cookies) {
      request.cookies[key] = decodeURIComponent(request.cookies[key]);
    }
  })

  // authentication flows (/auth/* by default)
  .all(authRouter.route, authRouter.fetch)

  // from here on authentication required (middleware)
  .all('*', withAuthentication)

  // user info
  .get('/api/user', apiUser)

  // dynamic media
  .all('/api/adobe/assets/*', originDynamicMedia)

  // fadel
  .all('/api/fadel/*', originFadel)

  // Saved Searches API (with extended CORS for DELETE/PUT)
  .all('/api/savedsearches/*', savedSearchesApi)

  // Rights Requests API
  .all('/api/rightsrequests/*', rightsRequestsApi)

  // Notifications API (with extended CORS for DELETE)
  .all('/api/messages/*', notificationsApi)
  .all('/api/messages', notificationsApi)

  // PDF Configuration API
  .get('/api/pdfconfig', handlePdfConfig)

  // future API routes
  .all('/api/*', () => error(404))

  .all('*', originHelix);

export default { ...router }
