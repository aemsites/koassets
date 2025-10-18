/**
 * Service Worker for WebLLM
 * Uses WebLLM's built-in ServiceWorkerMLCEngineHandler
 */

// Import WebLLM's Service Worker handler from CDN
importScripts('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/lib/service_worker.min.js');

console.log('[SW WebLLM] Initializing WebLLM Service Worker handler');

// Create the handler - WebLLM handles everything internally
const handler = new ServiceWorkerMLCEngineHandler();

console.log('[SW WebLLM] Handler created, ready to serve WebLLM requests');

self.addEventListener('install', (event) => {
  console.log('[SW WebLLM] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW WebLLM] Activating...');
  event.waitUntil(clients.claim());
});

