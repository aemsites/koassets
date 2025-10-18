/**
 * Service Worker for WebLLM
 * Uses WebLLM's built-in ServiceWorkerMLCEngineHandler
 */

// Import WebLLM from ES module CDN
// Using dynamic import since Service Workers support ES modules
console.log('[SW WebLLM] Loading WebLLM library...');

let webllm;

async function initializeWebLLM() {
  try {
    // Import WebLLM as ES module
    webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm');
    console.log('[SW WebLLM] WebLLM loaded:', webllm);
    
    // Create the handler
    const handler = new webllm.ServiceWorkerMLCEngineHandler();
    console.log('[SW WebLLM] Handler created, ready to serve WebLLM requests');
    
    return handler;
  } catch (error) {
    console.error('[SW WebLLM] Failed to load WebLLM:', error);
    throw error;
  }
}

self.addEventListener('install', (event) => {
  console.log('[SW WebLLM] Installing...');
  event.waitUntil(
    initializeWebLLM().then(() => {
      console.log('[SW WebLLM] WebLLM initialized during install');
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW WebLLM] Activating...');
  event.waitUntil(
    clients.claim().then(() => {
      console.log('[SW WebLLM] Clients claimed');
    })
  );
});

