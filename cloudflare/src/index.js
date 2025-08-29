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
import { originDynamicMedia } from './origin-dm';
import { originHelix } from './origin-helix';
import { cors } from './utils-itty';

const { preflight, corsify } = cors({
  origin: [
    'https://koassets.adobeaem.workers.dev',
    // development URLs
    /https:\/\/.*-koassets\.adobeaem\.workers\.dev$/,
    /https:\/\/.*-koassets--aemsites\.aem\.(live|page)$/,
    /http:\/\/localhost:(3000|8787)/
  ],
  allowMethods: ['GET', 'POST'],
  credentials: true,
  maxAge: 600,
});

const router = Router({
  before: [preflight],
  finally: [corsify],
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

  // authentication flows (/auth/* by default)
  .all(authRouter.route, authRouter.fetch)

  // from here on authentication required (middleware)
  .all('*', withAuthentication)

  // dynamic media
  .all('/api/assets/*', originDynamicMedia)

  // future API routes
  .all('/api/*', () => error(404))

  .all('*', originHelix);

export default { ...router }
