/**
 * Service Worker for WebLLM
 * Uses WebLLM's built-in ServiceWorkerMLCEngineHandler
 * 
 * This is an ES module Service Worker - uses static imports
 */

// Try unpkg which has better ES module support and no redirects
import { ServiceWorkerMLCEngineHandler } from 'https://unpkg.com/@mlc-ai/web-llm@0.2.63/lib/index.js';

console.log('[SW WebLLM] Initializing WebLLM Service Worker');

// Create the handler - WebLLM handles all fetch interception internally
const handler = new ServiceWorkerMLCEngineHandler();

console.log('[SW WebLLM] Handler created successfully');

self.addEventListener('install', (event) => {
  console.log('[SW WebLLM] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW WebLLM] Activating...');
  event.waitUntil(clients.claim());
  console.log('[SW WebLLM] Ready to serve WebLLM requests');
});

