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

// Now import WebLLM (which will use our proxied fetch)
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm';

console.log('[LLM Worker] Initializing WebWorkerMLCEngineHandler');

// Create the handler that will process messages from the main thread
const handler = new WebWorkerMLCEngineHandler();

// Set up message handling
self.onmessage = (event) => {
  handler.onmessage(event);
};

console.log('[LLM Worker] Ready to receive messages');

