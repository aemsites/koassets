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
import { savedSearchesApi } from './api/savedsearches';
import { authRouter, withAuthentication } from './auth';
import { apiMcp } from './mcp/mcp.js';
import { originDynamicMedia } from './origin/dm';
import { originFadel } from './origin/fadel';
import { originHelix } from './origin/helix';
import { proxyHuggingFace } from './proxy/huggingface.js';
import { apiUser } from './user';
import { cors } from './util/itty';

// Shared CORS origins
const allowedOrigins = [
  'https://koassets.adobeaem.workers.dev',
  // development URLs
  /https:\/\/.*-koassets\.adobeaem\.workers\.dev$/,
  /https:\/\/.*-koassets--aemsites\.aem\.(live|page)$/,
  /http:\/\/localhost:(3000|8787)/,
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

// Middleware to apply extended CORS for saved searches routes
const savedSearchesCorsMiddleware = (request) => {
  if (request.url.includes('/api/savedsearches/')) {
    return savedSearchesPreflight(request);
  }
  return preflight(request);
};

// Finally middleware that applies appropriate CORS
const finalCorsMiddleware = (response, request) => {
  if (request.url.includes('/api/savedsearches/')) {
    return savedSearchesCorsify(response, request);
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

// Global request logging middleware
router.all('*', (request) => {
  const url = new URL(request.url);
  console.log(`[Router] ${request.method} ${url.pathname}`);
});

router
  // Hugging Face proxy for WebLLM models (no auth required)
  .all('/api/hf-proxy/*', proxyHuggingFace)

  // WebLLM model files - rewrite HuggingFace URL structure to direct file access
  // Converts: /models/{model}/resolve/main/{file} -> /models/{model}/{file}
  // Then proxy to R2
  .all('/models/:model/resolve/main/:file+', async (request) => {
    const url = new URL(request.url);
    // Remove /resolve/main/ from the path
    const newPath = url.pathname.replace('/resolve/main', '');
    console.log('[Models] Rewriting URL from:', url.pathname, 'to:', newPath);

    // R2 bucket URL (public bucket for LLM models)
    const r2BaseUrl = 'https://pub-0945642565ac4afc9e23f2a0ffcbd46e.r2.dev';
    const r2Url = `${r2BaseUrl}${newPath}`;

    console.log('[Models] Proxying rewritten URL to R2:', r2Url);

    try {
      // Build headers object - only include headers that are present
      const r2Headers = {};
      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');
      const ifModifiedSince = request.headers.get('If-Modified-Since');

      if (rangeHeader) r2Headers.Range = rangeHeader;
      if (ifNoneMatch) r2Headers['If-None-Match'] = ifNoneMatch;
      if (ifModifiedSince) r2Headers['If-Modified-Since'] = ifModifiedSince;

      // Fetch from R2 bucket
      const r2Response = await fetch(r2Url, {
        method: request.method,
        headers: r2Headers,
      });

      if (!r2Response.ok) {
        const errorBody = await r2Response.text();
        console.error('[Models] R2 fetch failed for rewritten URL:', r2Response.status);
        console.error('[Models] R2 error body:', errorBody);
        console.error('[Models] Attempted R2 URL:', r2Url);
        return new Response(`Model file not found: ${newPath}\nR2 Status: ${r2Response.status}\nR2 Error: ${errorBody}`, {
          status: r2Response.status,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      console.log('[Models] R2 response:', r2Response.status, 'Size:', r2Response.headers.get('content-length'));

      // Create response with CORS and caching headers
      const response = new Response(r2Response.body, {
        status: r2Response.status,
        statusText: r2Response.statusText,
        headers: r2Response.headers,
      });

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', '*');

      // Set caching headers
      response.headers.set('Cache-Control', 'public, max-age=3600, immutable');

      return response;
    } catch (err) {
      console.error('[Models] R2 proxy error for rewritten URL:', err);
      return new Response(`Error fetching model file: ${err.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  })

  // Direct model file access - proxy to R2 bucket
  // Serves LLM model files from Cloudflare R2 storage
  .all('/models/*', async (request) => {
    const url = new URL(request.url);
    const modelPath = url.pathname; // e.g., /models/Hermes-2-Pro.../params_shard_0.bin

    // R2 bucket URL (public bucket for LLM models)
    const r2BaseUrl = 'https://pub-0945642565ac4afc9e23f2a0ffcbd46e.r2.dev';
    const r2Url = `${r2BaseUrl}${modelPath}`;

    console.log('[Models] Proxying to R2:', modelPath);
    console.log('[Models] R2 URL:', r2Url);

    try {
      // Build headers object - only include headers that are present
      const r2Headers = {};
      const rangeHeader = request.headers.get('Range');
      const ifNoneMatch = request.headers.get('If-None-Match');
      const ifModifiedSince = request.headers.get('If-Modified-Since');

      if (rangeHeader) r2Headers.Range = rangeHeader;
      if (ifNoneMatch) r2Headers['If-None-Match'] = ifNoneMatch;
      if (ifModifiedSince) r2Headers['If-Modified-Since'] = ifModifiedSince;

      // Fetch from R2 bucket
      const r2Response = await fetch(r2Url, {
        method: request.method,
        headers: r2Headers,
      });

      if (!r2Response.ok) {
        const errorBody = await r2Response.text();
        console.error('[Models] R2 fetch failed:', r2Response.status, r2Response.statusText);
        console.error('[Models] R2 error body:', errorBody);
        console.error('[Models] R2 headers:', JSON.stringify([...r2Response.headers]));
        return new Response(`Model file not found: ${modelPath}\nR2 Status: ${r2Response.status}\nR2 Error: ${errorBody}`, {
          status: r2Response.status,
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      console.log('[Models] R2 response:', r2Response.status, 'Size:', r2Response.headers.get('content-length'));

      // Create response with CORS and caching headers
      const response = new Response(r2Response.body, {
        status: r2Response.status,
        statusText: r2Response.statusText,
        headers: r2Response.headers,
      });

      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', '*');

      // Set caching headers (cache for 1 hour since files are immutable)
      response.headers.set('Cache-Control', 'public, max-age=3600, immutable');

      return response;
    } catch (err) {
      console.error('[Models] R2 proxy error:', err);
      return new Response(`Error fetching model file: ${err.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  })

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

  // MCP (Model Context Protocol) - AI assistant tools
  .all('/api/mcp*', apiMcp)
  // Saved Searches API (with extended CORS for DELETE/PUT)
  .all('/api/savedsearches/*', savedSearchesApi)

  // future API routes
  .all('/api/*', () => error(404))

  .all('*', originHelix);

export default { ...router };
