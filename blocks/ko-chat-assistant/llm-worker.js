/**
 * Web Worker for WebLLM
 * This runs the actual MLCEngine in a separate thread
 */

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

