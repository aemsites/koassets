/**
 * Web Worker for WebLLM
 * This runs the actual MLCEngine in a separate thread
 */

console.log('[LLM Worker] Starting initialization (NO PROXY TEST)');

// TEST: Load WebLLM WITHOUT fetch proxy to see if that's the issue
import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm').then((webllm) => {
  console.log('[LLM Worker] WebLLM loaded successfully');
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

