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
    // Use locally hosted model on same domain (no CORS issues!)
    this.modelId = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';
    this.initCallbacks = [];

    // Custom app config pointing to locally hosted model
    // WebLLM requires absolute URLs, so we construct them dynamically
    const baseUrl = window.location.origin;
    this.appConfig = {
      model_list: [
        {
          model_id: this.modelId,
          model: `${baseUrl}/models/tinyllama-1-1b-chat-v1-0-q4f16_1-mlc/`,
          model_lib: `${baseUrl}/models/tinyllama-1-1b-chat-v1-0-q4f16_1-mlc/tinyllama-1-1b-chat-v1-0-q4f16_1-ctx2k_cs1k-webgpu.wasm`,
        },
      ],
    };
  }

  /**
   * Initialize WebLLM engine with locally hosted model
   * Creates MLCEngine directly in main thread with custom appConfig
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
      // Check if WebLLM library is loaded
      if (typeof window.mlc === 'undefined' || typeof window.mlc.CreateMLCEngine === 'undefined') {
        await this.loadWebLLMLibrary();
      }

      this.status = 'downloading';
      this.notifyStatusChange();

      console.log('[WebLLM] Creating MLCEngine with locally hosted model');
      console.log('[WebLLM] Model ID:', this.modelId);
      console.log('[WebLLM] Model path:', this.appConfig.model_list[0].model);

      // Create MLCEngine with custom config pointing to locally hosted model
      this.engine = await window.mlc.CreateMLCEngine(this.modelId, {
        appConfig: this.appConfig,
        initProgressCallback: (progress) => {
          console.log('[WebLLM] Progress:', progress);
          this.handleInitProgress(progress);
        },
        logLevel: 'INFO',
      });

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
   * Load WebLLM library dynamically
   */
  async loadWebLLMLibrary() {
    try {
      // Check if already loaded
      if (window.mlc?.CreateMLCEngine) {
        return;
      }

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
