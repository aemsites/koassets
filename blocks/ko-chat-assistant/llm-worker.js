/**
 * Web Worker for WebLLM
 * This runs the actual MLCEngine in a separate thread
 */

console.log('[LLM Worker] Starting initialization');

// Install fetch proxy FIRST, before WebLLM loads
const originalFetch = self.fetch.bind(self);

// Get proxy base URL from the worker's location
const workerUrl = new URL(self.location.href);
const proxyBaseUrl = `${workerUrl.protocol}//${workerUrl.host}/api/hf-proxy`;

console.log('[LLM Worker] Installing fetch proxy for HuggingFace CORS');

self.fetch = function proxiedFetch(url, options) {
  const urlString = typeof url === 'string' ? url : url.toString();
  
  // Intercept HuggingFace requests and route through our proxy
  if (urlString.includes('huggingface.co')) {
    const proxiedUrl = urlString.replace('https://huggingface.co/', `${proxyBaseUrl}/`);
    console.log('[LLM Worker Proxy] HF → Proxy:', proxiedUrl);
    return originalFetch(proxiedUrl, options);
  }
  
  return originalFetch(url, options);
};

console.log('[LLM Worker] Fetch proxy installed');

// Use dynamic import to load WebLLM AFTER proxy is installed
// (static imports are hoisted and run before our proxy code)
import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm').then((webllm) => {
  console.log('[LLM Worker] WebLLM loaded with proxy in place');
  console.log('[LLM Worker] Initializing WebWorkerMLCEngineHandler');

  // Create the handler that will process messages from the main thread
  const handler = new webllm.WebWorkerMLCEngineHandler();

  // Set up message handling
  self.onmessage = (event) => {
    handler.onmessage(event);
  };

  console.log('[LLM Worker] Ready to receive messages');
}).catch((error) => {
  console.error('[LLM Worker] Failed to load WebLLM:', error);
});

