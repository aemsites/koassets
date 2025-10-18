/**
 * Web Worker for WebLLM
 * This runs the actual MLCEngine in a separate thread
 */

// Install fetch proxy BEFORE importing WebLLM (static imports are hoisted but the proxy function will be in place when WebLLM actually makes requests)
const originalFetch = self.fetch.bind(self);
const workerUrl = new URL(self.location.href);
const proxyBaseUrl = `${workerUrl.protocol}//${workerUrl.host}/api/hf-proxy`;

console.log('[LLM Worker] Installing fetch proxy for HuggingFace');

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

// Use STATIC import so handler is ready immediately (not async)
import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm';

console.log('[LLM Worker] WebLLM imported (static import)');

// Create the handler immediately
const handler = new WebWorkerMLCEngineHandler();

console.log('[LLM Worker] WebWorkerMLCEngineHandler created');

// Set up message handling
self.onmessage = (event) => {
  console.log('[LLM Worker] Received message:', event.data?.kind || event.data);
  handler.onmessage(event);
};

console.log('[LLM Worker] Ready to receive messages');

