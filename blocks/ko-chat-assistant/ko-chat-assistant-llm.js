/* eslint-disable max-classes-per-file, class-methods-use-this, no-console */
/**
 * KO Chat Assistant - WebLLM Integration
 * Privacy-first, browser-based AI using WebGPU
 *
 * Architecture:
 * - LLMManager: Manages WebLLM lifecycle
 * - WebLLMProvider: Runs AI model locally in browser using WebGPU
 * - MCPClient: Communicates with MCP server for tool execution
 */

// ============================================================================
// LLM PROVIDER INTERFACE
// ============================================================================

/**
 * Base interface that all LLM providers must implement
 */
class LLMProvider {
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async generateResponse(message, conversationHistory) {
    throw new Error('generateResponse() must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async streamResponse(message, conversationHistory, onChunk, onComplete) {
    throw new Error('streamResponse() must be implemented');
  }

  getStatus() {
    throw new Error('getStatus() must be implemented');
  }

  async shutdown() {
    // Optional - cleanup resources
  }
}

// ============================================================================
// WEBLLM PROVIDER (Browser-Based AI)
// ============================================================================

class WebLLMProvider extends LLMProvider {
  constructor() {
    super();
    this.engine = null;
    this.status = 'uninitialized'; // uninitialized, downloading, loading, ready, error
    this.downloadProgress = 0;
    // Use a valid pre-built WebLLM model that's in version 0.2.63
    // List: https://github.com/mlc-ai/web-llm/blob/main/src/config.ts
    // TinyLlama is small (~600MB) and definitely in 0.2.63
    // WASM files are hosted on WebLLM's binary CDN, not on HuggingFace
    this.modelId = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';
    this.initCallbacks = [];
    this.originalFetch = null; // Store original fetch for cleanup
  }

  /**
   * Install fetch interceptor to redirect HuggingFace requests through proxy
   */
  installFetchInterceptor() {
    // Only install once
    if (this.originalFetch) {
      return;
    }

    console.log('[WebLLM] Installing fetch interceptor for HuggingFace proxy');

    // Store original fetch with proper binding to window
    this.originalFetch = window.fetch.bind(window);
    const proxyBaseUrl = `${window.location.origin}/api/hf-proxy`;
    const { originalFetch } = this;

    // Create interceptor function
    const interceptorFn = async (input, init) => {
      let url;
      try {
        if (typeof input === 'string') {
          url = input;
        } else if (input instanceof Request) {
          url = input.url;
        } else {
          url = input.url;
        }
      } catch (e) {
        // If we can't get URL, just pass through
        console.warn('[WebLLM Proxy] Could not extract URL from fetch input:', input);
        return originalFetch(input, init);
      }

      // Log ALL fetch requests for debugging
      console.log('[WebLLM Proxy] 🔍 Checking fetch:', url.substring(0, 100));

      // Check if this is a HuggingFace request
      if (url.startsWith('https://huggingface.co/')) {
        // Redirect through our proxy
        const proxiedUrl = url.replace('https://huggingface.co/', `${proxyBaseUrl}/`);
        console.log('[WebLLM Proxy] ✓ Redirecting HF request to proxy');
        console.log(`  FROM: ${url.substring(0, 80)}...`);
        console.log(`  TO:   ${proxiedUrl.substring(0, 80)}...`);

        // Call original fetch with proxied URL
        return originalFetch(proxiedUrl, init);
      }

      // For all other requests, use original fetch
      return originalFetch(input, init);
    };

    // Override both window.fetch and global fetch
    window.fetch = interceptorFn;
    // eslint-disable-next-line no-undef
    if (typeof globalThis !== 'undefined') {
      // eslint-disable-next-line no-undef
      globalThis.fetch = interceptorFn;
    }

    console.log('[WebLLM] Fetch interceptor installed');
    console.log('[WebLLM] Verifying interceptor - window.fetch is:', window.fetch === originalFetch ? '❌ NOT patched!' : '✓ patched');

    // Test the interceptor with a dummy call
    console.log('[WebLLM] Testing interceptor with dummy HuggingFace call...');
    fetch('https://huggingface.co/test').catch(() => {
      console.log('[WebLLM] ✓ Interceptor test completed (error expected)');
    });
  }

  /**
   * Remove fetch interceptor (cleanup)
   */
  removeFetchInterceptor() {
    if (this.originalFetch) {
      console.log('[WebLLM] Removing fetch interceptor');
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  /**
   * Initialize WebLLM engine using Service Worker
   * Uses WebLLM's built-in ServiceWorkerMLCEngine
   */
  async initialize() {
    if (this.status === 'ready') {
      return { success: true };
    }

    if (this.status === 'downloading' || this.status === 'loading') {
      // Already initializing, wait for it
      return new Promise((resolve) => {
        this.initCallbacks.push(resolve);
      });
    }

    try {
      // Install fetch proxy FIRST, before WebLLM loads
      this.installGlobalFetchProxy();

      // Check if WebLLM library is loaded
      if (typeof window.mlc === 'undefined' || typeof window.mlc.CreateWebWorkerMLCEngine === 'undefined') {
        await this.loadWebLLMLibrary();
      }

      this.status = 'downloading';
      this.notifyStatusChange();

      console.log('[WebLLM] Creating Web Worker for MLCEngine');
      console.log('[WebLLM] This runs the model in a separate thread for better performance');

      // Create a Web Worker to run the MLCEngine
      const worker = new Worker(
        '/blocks/ko-chat-assistant/llm-worker.js',
        { type: 'module' }
      );
      console.log('[WebLLM] Worker created successfully');

      // Create WebWorkerMLCEngine client (communicates with the worker)
      console.log('[WebLLM] Calling CreateWebWorkerMLCEngine with model:', this.modelId);
      console.log('[WebLLM] This may take a moment to initialize...');
      
      this.engine = await window.mlc.CreateWebWorkerMLCEngine(
        worker,
        this.modelId,
        {
          initProgressCallback: (progress) => {
            console.log('[WebLLM] Progress callback:', progress);
            this.handleInitProgress(progress);
          },
        }
      );

      console.log('[WebLLM] Model loaded successfully');

      this.status = 'ready';
      this.downloadProgress = 100;
      this.notifyStatusChange();

      // Resolve any waiting callbacks
      this.initCallbacks.forEach((cb) => cb({ success: true }));
      this.initCallbacks = [];

      return { success: true };
    } catch (error) {
      console.error('[WebLLM] Initialization failed:', error);
      this.status = 'error';
      this.notifyStatusChange();

      const result = {
        success: false,
        error: error.message,
        details: this.getErrorGuidance(error),
      };

      // Resolve waiting callbacks with error
      this.initCallbacks.forEach((cb) => cb(result));
      this.initCallbacks = [];

      return result;
    }
  }

  /**
   * Install global fetch proxy to intercept HuggingFace requests
   */
  installGlobalFetchProxy() {
    if (window._webllmFetchProxyInstalled) {
      return; // Already installed
    }

    console.log('[WebLLM] Installing global fetch proxy for HuggingFace CORS');

    const originalFetch = window.fetch.bind(window);
    const proxyBaseUrl = `${window.location.origin}/api/hf-proxy`;

    window.fetch = function proxiedFetch(url, options) {
      const urlString = typeof url === 'string' ? url : url.toString();
      
      // Intercept HuggingFace requests and route through our proxy
      if (urlString.includes('huggingface.co')) {
        const proxiedUrl = urlString.replace('https://huggingface.co/', `${proxyBaseUrl}/`);
        console.log('[WebLLM Proxy] HF → Proxy:', proxiedUrl);
        return originalFetch(proxiedUrl, options);
      }
      
      return originalFetch(url, options);
    };

    window._webllmFetchProxyInstalled = true;
    console.log('[WebLLM] Fetch proxy installed successfully');
  }

  /**
   * Load WebLLM library dynamically
   */
  async loadWebLLMLibrary() {
    try {
      // Check if already loaded
      if (window.mlc?.CreateWebWorkerMLCEngine) {
        return;
      }

      // Fetch proxy should already be installed by initialize()
      // Try multiple CDN sources in order of preference
      // Using newer versions which have better CORS support
      const cdnUrls = [
        'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.63/+esm',
        'https://esm.run/@mlc-ai/web-llm@0.2.63',
        'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm',
      ];

      let lastError;
      // eslint-disable-next-line no-restricted-syntax
      for (const url of cdnUrls) {
        try {
          console.log(`[WebLLM] Trying to load from: ${url}`);
          // eslint-disable-next-line import/no-unresolved, no-await-in-loop
          const webllmModule = await import(url);

          // Expose to window for consistent access
          window.mlc = webllmModule;

          console.log('[WebLLM] Library loaded successfully from:', url);
          return;
        } catch (error) {
          console.warn(`[WebLLM] Failed to load from ${url}:`, error.message);
          lastError = error;
        }
      }

      throw lastError || new Error('Failed to load WebLLM library from all sources');
    } catch (error) {
      console.error('[WebLLM] Failed to load library:', error);
      throw new Error('Failed to load WebLLM library');
    }
  }

  /**
   * Handle initialization progress updates
   */
  handleInitProgress(progress) {
    const text = progress.text || '';

    if (text.includes('Loading model')) {
      this.status = 'loading';
    } else if (text.includes('Downloading')) {
      this.status = 'downloading';
    }

    // Extract progress percentage if available
    const percentMatch = text.match(/(\d+)%/);
    if (percentMatch) {
      this.downloadProgress = parseInt(percentMatch[1], 10);
    }

    console.log('[WebLLM]', text);
    this.notifyStatusChange();
  }

  /**
   * Generate response from user message
   */
  async generateResponse(message, conversationHistory = []) {
    if (this.status !== 'ready') {
      throw new Error('WebLLM not ready. Call initialize() first.');
    }

    try {
      // Build messages for the model
      const messages = this.buildMessages(message, conversationHistory);

      // Generate response
      const response = await this.engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 512,
      });

      const content = response.choices[0]?.message?.content || '';

      // Parse response and detect tool calls
      const { text, toolCalls } = this.parseResponse(content, message);

      return {
        success: true,
        text,
        toolCalls,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      console.error('[WebLLM] Generation failed:', error);
      return {
        success: false,
        error: error.message,
        text: "I'm sorry, I encountered an error processing your request.",
      };
    }
  }

  /**
   * Stream response (for future enhancement)
   */
  async streamResponse(message, conversationHistory, onChunk, onComplete) {
    // For now, just call generateResponse and return it all at once
    const result = await this.generateResponse(message, conversationHistory);
    if (result.success) {
      onChunk(result.text);
    }
    onComplete(result);
  }

  /**
   * Build messages array for the model
   */
  buildMessages(message, conversationHistory) {
    const systemPrompt = `You are a helpful assistant for KO Assets, The Coca-Cola Company's digital asset management system.

Your role is to help find and explore digital assets including images, videos, and documents.

When users ask to find or search for assets:
- Extract brand names: Coca-Cola, Sprite, Fanta, Powerade, Dasani, smartwater, vitaminwater
- Extract categories: Image, Video, Document
- Respond with: "I'll search for [what they want]"

Keep responses concise and helpful. Focus on asset search and discovery.`;

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add recent conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    // eslint-disable-next-line no-restricted-syntax
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    return messages;
  }

  /**
   * Parse LLM response and detect intent/tool calls
   */
  parseResponse(content, originalMessage) {
    const lower = originalMessage.toLowerCase();
    const toolCalls = [];

    // Detect search intent
    if (
      lower.includes('find')
      || lower.includes('search')
      || lower.includes('show')
      || lower.includes('look for')
      || lower.includes('get')
      || lower.includes('assets for')
    ) {
      // Extract brand names
      const brands = ['coca-cola', 'sprite', 'fanta', 'powerade', 'dasani', 'smartwater', 'vitaminwater'];
      const mentionedBrands = brands.filter((brand) => lower.includes(brand));

      // Extract categories
      const categories = ['image', 'video', 'document'];
      const mentionedCategories = categories.filter((cat) => lower.includes(cat));

      const facetFilters = {};
      if (mentionedBrands.length > 0) {
        facetFilters.brand = mentionedBrands.map((b) => b.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-'));
      }
      if (mentionedCategories.length > 0) {
        facetFilters.category = mentionedCategories.map(
          (c) => c.charAt(0).toUpperCase() + c.slice(1),
        );
      }

      toolCalls.push({
        id: `call_${Date.now()}`,
        name: 'search_assets',
        arguments: {
          query: originalMessage,
          facetFilters,
          hitsPerPage: 12,
        },
      });
    }

    return {
      text: content,
      toolCalls,
    };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      status: this.status,
      progress: this.downloadProgress,
      ready: this.status === 'ready',
      error: this.status === 'error',
    };
  }

  /**
   * Get error guidance for users
   */
  getErrorGuidance(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('webgpu')) {
      return {
        title: 'WebGPU Not Available',
        message: 'Your browser doesn\'t support WebGPU. Try using Chrome 113+ or Edge 113+.',
        action: 'Update your browser or switch to server mode',
      };
    }

    if (message.includes('memory') || message.includes('oom')) {
      return {
        title: 'Not Enough Memory',
        message: 'Your device doesn\'t have enough memory to run the AI model.',
        action: 'Close other tabs/apps or switch to server mode',
      };
    }

    if (message.includes('network') || message.includes('fetch')) {
      return {
        title: 'Download Failed',
        message: 'Failed to download the AI model. Check your internet connection.',
        action: 'Retry or switch to server mode',
      };
    }

    return {
      title: 'Initialization Failed',
      message: error.message,
      action: 'Try refreshing the page or switch to server mode',
    };
  }

  /**
   * Notify status change (hook for UI updates)
   */
  notifyStatusChange() {
    // Dispatch custom event for UI to listen to
    window.dispatchEvent(new CustomEvent('llm-status-change', {
      detail: this.getStatus(),
    }));
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.engine) {
      // WebLLM doesn't have explicit shutdown, but we can null the reference
      this.engine = null;
    }
    this.status = 'uninitialized';
  }
}

// ============================================================================
// LLM MANAGER
// ============================================================================

class LLMManager {
  constructor() {
    console.log('[LLM Manager] Using WebLLM (privacy-first, browser-based AI)');
    this.provider = new WebLLMProvider();
  }

  /**
   * Initialize the WebLLM provider (downloads and loads model)
   */
  async initialize() {
    return this.provider.initialize();
  }

  /**
   * Generate response
   */
  async generateResponse(message, conversationHistory) {
    return this.provider.generateResponse(message, conversationHistory);
  }

  /**
   * Stream response
   */
  async streamResponse(message, conversationHistory, onChunk, onComplete) {
    return this.provider.streamResponse(message, conversationHistory, onChunk, onComplete);
  }

  /**
   * Get current status
   */
  getStatus() {
    return this.provider.getStatus();
  }

  /**
   * Shutdown provider
   */
  async shutdown() {
    await this.provider.shutdown();
  }
}

// ============================================================================
// MCP CLIENT (Direct Browser → MCP Server Calls)
// ============================================================================

class MCPClient {
  constructor() {
    // MCP is now integrated into the main worker at /api/mcp
    this.mcpServerUrl = '/api/mcp';
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, args) {
    const mcpRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: Date.now(),
    };

    try {
      const response = await fetch(this.mcpServerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify(mcpRequest),
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error.message || 'MCP tool execution failed');
      }

      // Extract content from MCP response
      if (result.result?.content?.[0]?.text) {
        const data = JSON.parse(result.result.content[0].text);
        return { success: true, data };
      }

      return { success: true, data: result.result };
    } catch (error) {
      console.error(`[MCP Client] ${toolName} failed:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute multiple tool calls
   */
  async executeToolCalls(toolCalls) {
    const results = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const call of toolCalls) {
      // eslint-disable-next-line no-await-in-loop
      const result = await this.callTool(call.name, call.arguments);
      results.push({
        id: call.id,
        name: call.name,
        ...result,
      });
    }

    return results;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Export for use in main chat file
window.LLMManager = LLMManager;
window.MCPClient = MCPClient;
