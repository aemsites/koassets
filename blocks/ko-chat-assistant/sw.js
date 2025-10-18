/**
 * Service Worker for WebLLM
 * Uses WebLLM's built-in ServiceWorkerMLCEngineHandler
 * 
 * This is an ES module Service Worker - uses static imports
 */

// Static import of WebLLM - this is allowed in ES module Service Workers
import { ServiceWorkerMLCEngineHandler } from 'https://esm.run/@mlc-ai/web-llm@0.2.63';

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

