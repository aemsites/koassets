/**
 * Web Worker for WebLLM
 * This runs the actual MLCEngine in a separate thread
 */

import { WebWorkerMLCEngineHandler } from 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm';

console.log('[LLM Worker] Initializing WebWorkerMLCEngineHandler');

// Create the handler that will process messages from the main thread
const handler = new WebWorkerMLCEngineHandler();

// Set up message handling
self.onmessage = (event) => {
  handler.onmessage(event);
};

console.log('[LLM Worker] Ready to receive messages');

