/**
 * Service Worker for WebLLM
 * 
 * WebLLM's ServiceWorkerMLCEngine will communicate with this service worker
 * We don't need to manually import anything - WebLLM handles it internally
 */

console.log('[SW WebLLM] Service Worker initializing');

self.addEventListener('install', (event) => {
  console.log('[SW WebLLM] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW WebLLM] Activating...');
  event.waitUntil(self.clients.claim());
  console.log('[SW WebLLM] Activated and claimed clients');
});

self.addEventListener('message', (event) => {
  console.log('[SW WebLLM] Received message:', event.data);
  
  // WebLLM will send messages to coordinate model loading
  // We just need to acknowledge and let WebLLM handle the details
  if (event.data && event.data.kind === 'ping') {
    console.log('[SW WebLLM] Responding to ping');
    event.ports[0].postMessage({ kind: 'pong' });
  }
});

