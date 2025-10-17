/**
 * KO Chat Assistant - LLM Abstraction Layer
 * Supports both WebLLM (local browser-based AI) and Server-based AI
 * 
 * Architecture:
 * - LLMManager: Orchestrates which provider to use
 * - WebLLMProvider: Runs AI model in browser using WebGPU
 * - ServerLLMProvider: Uses existing server endpoint
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Toggle between WebLLM (local) and Server (cloud) mode
 * 
 * Set to true for local development (AI runs in browser)
 * Set to false for production (AI runs on server)
 */
const USE_WEBLLM_MODE = true; // <-- DEVELOPERS: Change this to switch modes

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

  async generateResponse(message, conversationHistory) {
    throw new Error('generateResponse() must be implemented');
  }

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
    this.modelId = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';
    this.initCallbacks = [];
  }

  /**
   * Initialize WebLLM engine and download/load model
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

      // Create engine with progress callback
      this.engine = await window.mlc.CreateMLCEngine(
        this.modelId,
        {
          initProgressCallback: (progress) => {
            this.handleInitProgress(progress);
          },
        }
      );

      this.status = 'ready';
      this.downloadProgress = 100;
      this.notifyStatusChange();

      // Resolve any waiting callbacks
      this.initCallbacks.forEach(cb => cb({ success: true }));
      this.initCallbacks = [];

      return { success: true };
    } catch (error) {
      console.error('[WebLLM] Initialization failed:', error);
      this.status = 'error';
      this.notifyStatusChange();

      const result = { 
        success: false, 
        error: error.message,
        details: this.getErrorGuidance(error)
      };

      // Resolve waiting callbacks with error
      this.initCallbacks.forEach(cb => cb(result));
      this.initCallbacks = [];

      return result;
    }
  }

  /**
   * Load WebLLM library dynamically
   */
  async loadWebLLMLibrary() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="mlc-ai"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://esm.run/@mlc-ai/web-llm';
      script.type = 'module';
      script.onload = () => {
        // Give it a moment to initialize
        setTimeout(resolve, 100);
      };
      script.onerror = () => reject(new Error('Failed to load WebLLM library'));
      document.head.appendChild(script);
    });
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
        }
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
      { role: 'system', content: systemPrompt }
    ];

    // Add recent conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
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
      lower.includes('find') ||
      lower.includes('search') ||
      lower.includes('show') ||
      lower.includes('look for') ||
      lower.includes('get') ||
      lower.includes('assets for')
    ) {
      // Extract brand names
      const brands = ['coca-cola', 'sprite', 'fanta', 'powerade', 'dasani', 'smartwater', 'vitaminwater'];
      const mentionedBrands = brands.filter(brand => lower.includes(brand));

      // Extract categories
      const categories = ['image', 'video', 'document'];
      const mentionedCategories = categories.filter(cat => lower.includes(cat));

      const facetFilters = {};
      if (mentionedBrands.length > 0) {
        facetFilters.brand = mentionedBrands.map(b => 
          b.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
        );
      }
      if (mentionedCategories.length > 0) {
        facetFilters.category = mentionedCategories.map(c => 
          c.charAt(0).toUpperCase() + c.slice(1)
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
      detail: this.getStatus()
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
// SERVER LLM PROVIDER (Existing Cloud-Based AI)
// ============================================================================

class ServerLLMProvider extends LLMProvider {
  constructor() {
    super();
    this.status = 'ready'; // Server is always ready (no initialization needed)
  }

  /**
   * Initialize (no-op for server, always ready)
   */
  async initialize() {
    return { success: true };
  }

  /**
   * Generate response using existing server endpoint
   */
  async generateResponse(message, conversationHistory = []) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: window.koassetsSessionId || null,
          conversationHistory: conversationHistory.slice(-10),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          text: data.message,
          assets: data.assets,
          rightsReport: data.rightsReport,
          suggestedPrompts: data.suggestedPrompts,
        };
      } else {
        throw new Error(data.error || 'Server request failed');
      }
    } catch (error) {
      console.error('[Server LLM] Request failed:', error);
      return {
        success: false,
        error: error.message,
        text: "I'm sorry, I encountered an error processing your request. Please try again.",
      };
    }
  }

  /**
   * Stream response (not implemented yet)
   */
  async streamResponse(message, conversationHistory, onChunk, onComplete) {
    const result = await this.generateResponse(message, conversationHistory);
    if (result.success) {
      onChunk(result.text);
    }
    onComplete(result);
  }

  /**
   * Get status (always ready)
   */
  getStatus() {
    return {
      status: 'ready',
      progress: 100,
      ready: true,
      error: false,
    };
  }
}

// ============================================================================
// LLM MANAGER (Orchestrator)
// ============================================================================

class LLMManager {
  constructor() {
    this.provider = null;
    this.mode = null;
    this.initializeProvider();
  }

  /**
   * Initialize the appropriate provider based on configuration
   */
  initializeProvider() {
    if (USE_WEBLLM_MODE) {
      console.log('[LLM Manager] Using WebLLM mode (local browser-based AI)');
      this.mode = 'webllm';
      this.provider = new WebLLMProvider();
    } else {
      console.log('[LLM Manager] Using Server mode (cloud-based AI)');
      this.mode = 'server';
      this.provider = new ServerLLMProvider();
    }
  }

  /**
   * Initialize the provider (async for WebLLM, instant for Server)
   */
  async initialize() {
    return await this.provider.initialize();
  }

  /**
   * Generate response
   */
  async generateResponse(message, conversationHistory) {
    return await this.provider.generateResponse(message, conversationHistory);
  }

  /**
   * Stream response
   */
  async streamResponse(message, conversationHistory, onChunk, onComplete) {
    return await this.provider.streamResponse(message, conversationHistory, onChunk, onComplete);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      ...this.provider.getStatus(),
      mode: this.mode,
    };
  }

  /**
   * Get current mode
   */
  getMode() {
    return this.mode;
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
  constructor(mcpServerUrl) {
    // Default MCP server URL based on environment
    // For local dev: assumes MCP server is part of main worker
    // For WebLLM mode in production: use deployed MCP server
    this.mcpServerUrl = mcpServerUrl || this.detectMCPServerUrl();
  }

  /**
   * Detect appropriate MCP server URL based on environment
   */
  detectMCPServerUrl() {
    const hostname = window.location.hostname;
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/mcp'; // MCP is part of main worker in dev
    }
    
    // Staging
    if (hostname.includes('staging') || hostname.includes('aem.page')) {
      return 'https://koassets-mcp-server-staging.workers.dev/mcp';
    }
    
    // Production
    return 'https://koassets-mcp-server.workers.dev/mcp';
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

    for (const call of toolCalls) {
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

