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

    // Adaptive model selection based on available storage
    // Will be determined in initialize() based on quota
    this.modelId = null;
    this.selectedModel = null;
    this.initCallbacks = [];

    // Available models with their storage requirements
    const baseUrl = window.location.origin;
    const cacheBuster = '?v=20251019'; // Update this when WASM file changes
    this.availableModels = {
      hermes2pro: {
        id: 'Hermes-2-Pro-Mistral-7B-q4f16_1-MLC',
        name: 'Hermes-2-Pro-Mistral-7B',
        sizeGB: 4.0,
        path: `${baseUrl}/models/Hermes-2-Pro-Mistral-7B-q4f16_1-MLC/`,
        lib: `${baseUrl}/models/Hermes-2-Pro-Mistral-7B-q4f16_1-MLC/Hermes-2-Pro-Mistral-7B-q4f16_1-sw4k_cs1k-webgpu.wasm${cacheBuster}`,
        description: 'Best for function calling - WebLLM native support',
      },
      tinyllama: {
        id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
        name: 'TinyLlama (1.1B)',
        sizeGB: 0.6,
        path: `${baseUrl}/models/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC/`,
        lib: `${baseUrl}/models/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC/TinyLlama-1.1B-Chat-v1.0-q4f16_1-ctx2k_cs1k-webgpu.wasm`,
        description: 'Smaller, fallback for limited storage',
      },
    };
  }

  /**
   * Select best model based on available storage
   */
  selectModelForQuota(availableGB) {
    console.log(`[Model Selection] Available storage: ${availableGB.toFixed(2)}GB`);

    // Try Hermes-2-Pro first (best for function calling)
    if (availableGB >= this.availableModels.hermes2pro.sizeGB + 0.5) { // +0.5GB buffer
      console.log('[Model Selection] ✅ Selected Hermes-2-Pro-Mistral-7B - sufficient storage');
      return this.availableModels.hermes2pro;
    }

    // Fall back to TinyLlama (smaller, but no native tool calling)
    if (availableGB >= this.availableModels.tinyllama.sizeGB + 0.2) { // +0.2GB buffer
      console.log('[Model Selection] ⚠️ Selected TinyLlama (1.1B) - limited storage');
      console.log('[Model Selection] Note: Using pattern-based fallback (no native tool calling)');
      return this.availableModels.tinyllama;
    }

    // Not enough storage for any model
    const minSize = this.availableModels.tinyllama.sizeGB;
    console.error(`[Model Selection] ❌ Insufficient storage for any model (need at least ${minSize}GB)`);
    return null;
  }

  /**
   * Request persistent storage to prevent quota issues with large models
   */
  async requestPersistentStorage() {
    console.log('[Storage] Checking storage status...');

    // Check if Storage API is available
    if (!navigator.storage) {
      console.warn('[Storage] Storage API not available in this browser, assuming 10GB available');
      return {
        granted: false,
        quota: 10 * 1024 * 1024 * 1024,
        usage: 0,
        available: 10 * 1024 * 1024 * 1024,
      };
    }

    try {
      // Request persistent storage (prevents browser from evicting data)
      if (navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`[Storage] Persistent storage granted: ${isPersisted}`);

        if (isPersisted) {
          console.log('[Storage] ✅ Data will not be automatically evicted');
        } else {
          console.warn('[Storage] ⚠️ Persistent storage not granted - data may be evicted if device runs low on space');
        }
      }

      // Check current quota and usage
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const quotaGB = (estimate.quota / (1024 * 1024 * 1024)).toFixed(2);
        const usageGB = (estimate.usage / (1024 * 1024 * 1024)).toFixed(2);
        const usagePercent = ((estimate.usage / estimate.quota) * 100).toFixed(1);

        console.log(`[Storage] Quota: ${quotaGB}GB, Usage: ${usageGB}GB (${usagePercent}%)`);

        // Return storage info for adaptive model selection
        const availableBytes = estimate.quota - estimate.usage;

        return {
          granted: true,
          quota: estimate.quota,
          usage: estimate.usage,
          available: availableBytes,
        };
      }

      // Fallback: assume 10GB available if estimate() unavailable
      console.warn('[Storage] estimate() unavailable, assuming 10GB available');
      return {
        granted: false,
        quota: 10 * 1024 * 1024 * 1024,
        usage: 0,
        available: 10 * 1024 * 1024 * 1024,
      };
    } catch (error) {
      console.error('[Storage] Error checking storage:', error);
      // Fallback: assume 10GB available on error
      return {
        granted: false,
        quota: 10 * 1024 * 1024 * 1024,
        usage: 0,
        available: 10 * 1024 * 1024 * 1024,
        error: error.message,
      };
    }
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
      // Request persistent storage before loading model
      const storageStatus = await this.requestPersistentStorage();

      // Select best model based on available storage
      const availableGB = storageStatus.available / (1024 * 1024 * 1024);
      this.selectedModel = this.selectModelForQuota(availableGB);

      // Not enough storage for any model
      if (!this.selectedModel) {
        const minRequired = this.availableModels.tinyllama.sizeGB;
        return {
          success: false,
          error: 'insufficient_storage',
          details: {
            availableGB: parseFloat(availableGB.toFixed(2)),
            requiredGB: minRequired,
            quotaGB: parseFloat((storageStatus.quota / (1024 * 1024 * 1024)).toFixed(2)),
            usageGB: parseFloat((storageStatus.usage / (1024 * 1024 * 1024)).toFixed(2)),
            selectedModel: null,
          },
        };
      }

      // Falling back to smaller model - ask user for confirmation
      if (this.selectedModel.id === this.availableModels.tinyllama.id) {
        return {
          success: false,
          error: 'limited_storage',
          details: {
            availableGB: parseFloat(availableGB.toFixed(2)),
            requiredGB: this.availableModels.hermes2pro.sizeGB,
            quotaGB: parseFloat((storageStatus.quota / (1024 * 1024 * 1024)).toFixed(2)),
            usageGB: parseFloat((storageStatus.usage / (1024 * 1024 * 1024)).toFixed(2)),
            selectedModel: this.selectedModel,
            preferredModel: this.availableModels.hermes2pro,
          },
        };
      }

      // Set model ID and create app config for selected model
      this.modelId = this.selectedModel.id;
      const appConfig = {
        model_list: [
          {
            model_id: this.selectedModel.id,
            model: this.selectedModel.path,
            model_lib: this.selectedModel.lib,
          },
        ],
      };

      // Check if WebLLM library is loaded
      if (typeof window.mlc === 'undefined' || typeof window.mlc.CreateMLCEngine === 'undefined') {
        await this.loadWebLLMLibrary();
      }

      this.status = 'downloading';
      this.notifyStatusChange();

      console.log(`[WebLLM] Creating MLCEngine with ${this.selectedModel.name}`);
      console.log('[WebLLM] Model ID:', this.modelId);
      console.log('[WebLLM] Model path:', this.selectedModel.path);
      console.log('[WebLLM] WASM lib:', this.selectedModel.lib);
      console.log('[WebLLM] Storage: Persistent storage requested');

      // Create MLCEngine with custom config for selected model
      const engineOptions = {
        appConfig,
        initProgressCallback: (progress) => {
          console.log('[WebLLM] Progress:', progress);
          this.handleInitProgress(progress);
        },
        logLevel: 'INFO',
      };

      this.engine = await window.mlc.CreateMLCEngine(this.modelId, engineOptions);

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

      // Get MCP tools
      const tools = this.getMCPTools();

      console.log('[WebLLM] Generating response with', tools.length, 'tools available');

      // Generate response with function calling support
      const response = await this.engine.chat.completions.create({
        messages,
        tools,
        tool_choice: 'auto', // Let model decide when to use tools
        temperature: 0.7,
        max_tokens: 512,
      });

      const choice = response.choices[0];
      const responseMessage = choice?.message;

      console.log('[WebLLM] Response:', {
        hasContent: !!responseMessage?.content,
        hasToolCalls: !!responseMessage?.tool_calls,
        toolCallsCount: responseMessage?.tool_calls?.length || 0,
      });

      // Extract tool calls from response
      const toolCalls = [];
      if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        for (const toolCall of responseMessage.tool_calls) {
          try {
            toolCalls.push({
              id: toolCall.id || `call_${Date.now()}`,
              name: toolCall.function.name,
              arguments: typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments,
            });
            console.log('[WebLLM] Tool call detected:', toolCall.function.name);
            console.log('[WebLLM] Arguments:', toolCalls[toolCalls.length - 1].arguments);
          } catch (parseError) {
            console.error('[WebLLM] Failed to parse tool call arguments:', parseError);
          }
        }
      }

      // If no tool calls, fall back to pattern-based detection as backup
      if (toolCalls.length === 0) {
        console.log('[WebLLM] No tool calls from model, using fallback pattern detection');
        const fallbackToolCalls = this.parseResponseFallback(
          responseMessage?.content || '',
          messages[messages.length - 1].content,
        );
        if (fallbackToolCalls.length > 0) {
          toolCalls.push(...fallbackToolCalls);
        }
      }

      return {
        success: true,
        text: responseMessage?.content || '',
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
   * Define MCP tools available to the LLM
   */
  getMCPTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'search_assets',
          description: 'Search for digital assets (images, videos, documents) in KO Assets. Use empty query with facetFilters for brand/format filtering, or add keywords for additional refinement.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search keywords for additional filtering. Use empty string "" when filtering by brand/format only. Examples: "", "bottle", "summer campaign"',
              },
              facetFilters: {
                type: 'object',
                description: 'Filters for brand, format, market, channel, campaign, and other metadata',
                properties: {
                  brand: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Brand names: Coca-Cola, Sprite, Fanta, Powerade, Dasani, smartwater, vitaminwater, Minute Maid, Schweppes',
                  },
                  format: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Asset formats: Image, Video, Document',
                  },
                  market: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Markets/regions: North America, Europe, ASEAN, Latin America, etc.',
                  },
                  channel: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Intended channels: TV, Social Media, Out of Home, Print, Digital, POS',
                  },
                  campaign: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Campaign names (e.g., Summer Campaign, Holiday 2024)',
                  },
                  country: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Target countries (ISO codes: US, JP, VN, etc.)',
                  },
                  language: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Languages (ISO codes: en_US, ja_JP, etc.)',
                  },
                  readyToUse: {
                    type: 'string',
                    description: 'Filter by ready-to-use status: yes, no',
                  },
                  assetStatus: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Asset approval status: approved, pending, rejected',
                  },
                },
              },
              dateRange: {
                type: 'object',
                description: 'Filter by date range',
                properties: {
                  field: {
                    type: 'string',
                    enum: ['repo-createDate', 'repo-modifyDate', 'tccc-rightsStartDate', 'tccc-rightsEndDate'],
                    description: 'Date field: created, modified, rights start, rights end',
                  },
                  from: {
                    type: 'string',
                    description: 'Start date (ISO 8601 format: 2024-01-01)',
                  },
                  to: {
                    type: 'string',
                    description: 'End date (ISO 8601 format: 2024-12-31)',
                  },
                },
              },
              hitsPerPage: {
                type: 'number',
                description: 'Number of results to return (default: 12, max: 100)',
                default: 12,
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'check_asset_rights',
          description: 'Check if an asset can be used for a specific purpose, verifying rights clearance and usage restrictions',
          parameters: {
            type: 'object',
            properties: {
              assetId: {
                type: 'string',
                description: 'The unique ID of the asset to check',
              },
              intendedUse: {
                type: 'object',
                description: 'Intended use details',
                properties: {
                  market: {
                    type: 'string',
                    description: 'Target market/region',
                  },
                  channel: {
                    type: 'string',
                    description: 'Intended channel (TV, Social, Print, etc.)',
                  },
                  startDate: {
                    type: 'string',
                    description: 'Usage start date (ISO format)',
                  },
                  endDate: {
                    type: 'string',
                    description: 'Usage end date (ISO format)',
                  },
                },
              },
            },
            required: ['assetId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_asset_metadata',
          description: 'Get detailed metadata for a specific asset including technical details, rights information, and usage guidelines',
          parameters: {
            type: 'object',
            properties: {
              assetId: {
                type: 'string',
                description: 'The unique ID of the asset',
              },
            },
            required: ['assetId'],
          },
        },
      },
    ];
  }

  /**
   * Build messages array for the model
   */
  buildMessages(message, conversationHistory) {
    // Check for search context in conversation history
    const lastSearch = this.extractLastSearchContext(conversationHistory);
    const contextNote = lastSearch
      ? `\n\nCONVERSATION CONTEXT:\nPrevious search: ${JSON.stringify(lastSearch, null, 2)}\nFor refinement queries ("filter to videos", "only approved", "now show Sprite"), modify this search instead of creating a new one.`
      : '';

    const systemPrompt = `You are a helpful assistant for KO Assets, The Coca-Cola Company's digital asset management system.

Your role is to help users find and manage digital assets including images, videos, and documents.

AVAILABLE TOOLS:
- search_assets: Find assets by brand, format, keywords, market, channel, etc.
- check_asset_rights: Verify if an asset can be used for specific purposes
- get_asset_metadata: Get detailed information about an asset

SEARCH GUIDELINES:
1. Use empty query ("") with facetFilters when searching by brand/format/market only
2. Add keywords to query for additional refinement within those filters
3. Always specify hitsPerPage (default 12) for reasonable result sets
4. Combine multiple facets for precise filtering
5. For refinement queries, build on the previous search context

EXAMPLES:
- "Find Coca-Cola images" → search_assets(query="", facetFilters={brand:["Coca-Cola"], format:["Image"]}, hitsPerPage=12)
- "Sprite summer videos" → search_assets(query="summer", facetFilters={brand:["Sprite"], format:["Video"]}, hitsPerPage=12)
- "Assets for social media in ASEAN" → search_assets(query="", facetFilters={channel:["Social Media"], market:["ASEAN"]}, hitsPerPage=12)
- "Approved Coca-Cola assets for Vietnam TV" → search_assets(query="", facetFilters={brand:["Coca-Cola"], assetStatus:["approved"], country:["VN"], channel:["TV"]}, hitsPerPage=12)
- "Ready-to-use campaign materials from 2024" → search_assets(query="", facetFilters={readyToUse:"yes"}, dateRange:{field:"repo-createDate", from:"2024-01-01", to:"2024-12-31"}, hitsPerPage=12)

REFINEMENT EXAMPLES:
- After "Find Coca-Cola images":
  - "Only show videos" → search_assets(query="", facetFilters={brand:["Coca-Cola"], format:["Video"]}, hitsPerPage=12)
  - "Filter to approved only" → search_assets(query="", facetFilters={brand:["Coca-Cola"], format:["Image"], assetStatus:["approved"]}, hitsPerPage=12)
- After "Show summer assets":
  - "Now for Sprite" → search_assets(query="summer", facetFilters={brand:["Sprite"]}, hitsPerPage=12)
  - "Add social media filter" → search_assets(query="summer", facetFilters={channel:["Social Media"]}, hitsPerPage=12)

Keep responses concise, friendly, and helpful. Use tools when appropriate to answer user questions.${contextNote}`;

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
   * Extract last search context from conversation history
   */
  extractLastSearchContext(conversationHistory) {
    // Look backwards through history for the last tool call with search_assets
    // eslint-disable-next-line no-restricted-syntax
    for (let i = conversationHistory.length - 1; i >= 0; i -= 1) {
      const msg = conversationHistory[i];
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // eslint-disable-next-line no-restricted-syntax
        for (const call of msg.toolCalls) {
          if (call.name === 'search_assets') {
            return {
              query: call.arguments.query,
              facetFilters: call.arguments.facetFilters,
              dateRange: call.arguments.dateRange,
              hitsPerPage: call.arguments.hitsPerPage,
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Fallback pattern-based tool detection (used when model doesn't use function calling)
   */
  parseResponseFallback(content, originalMessage) {
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
      const brands = ['coca-cola', 'sprite', 'fanta', 'powerade', 'dasani', 'smartwater', 'vitaminwater', 'minute maid', 'schweppes'];
      const mentionedBrands = brands.filter((brand) => lower.includes(brand));

      // Extract categories/formats
      const formats = {
        image: ['image', 'images', 'picture', 'pictures', 'photo', 'photos'],
        video: ['video', 'videos', 'clip', 'clips', 'footage'],
        document: ['document', 'documents', 'doc', 'docs', 'pdf'],
      };
      const mentionedFormats = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const [format, keywords] of Object.entries(formats)) {
        // eslint-disable-next-line no-restricted-syntax
        for (const keyword of keywords) {
          if (lower.includes(keyword)) {
            mentionedFormats.push(format.charAt(0).toUpperCase() + format.slice(1));
            break;
          }
        }
      }

      // Build facetFilters
      const facetFilters = {};
      if (mentionedBrands.length > 0) {
        facetFilters.brand = mentionedBrands.map((b) => b.split(/[\s-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
      if (mentionedFormats.length > 0) {
        facetFilters.format = mentionedFormats;
      }

      // Extract additional keywords (not brand/format)
      let keywords = lower;
      // eslint-disable-next-line no-restricted-syntax
      for (const brand of brands) {
        keywords = keywords.replace(new RegExp(brand, 'gi'), '');
      }
      // eslint-disable-next-line no-restricted-syntax
      for (const formatKeywords of Object.values(formats)) {
        // eslint-disable-next-line no-restricted-syntax
        for (const keyword of formatKeywords) {
          keywords = keywords.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '');
        }
      }
      // Remove common command words
      keywords = keywords
        .replace(/\b(find|search|show|look for|get|give|me|some|the|all|recent|latest|please|can you)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Use empty query if we have facet filters and no meaningful keywords
      const hasFacets = mentionedBrands.length > 0 || mentionedFormats.length > 0;
      const query = hasFacets && keywords.length < 3 ? '' : keywords;

      console.log('[WebLLM] Detected search intent:');
      console.log('  Brands:', mentionedBrands);
      console.log('  Formats:', mentionedFormats);
      console.log('  Query:', query || '(empty)');

      toolCalls.push({
        id: `call_${Date.now()}`,
        name: 'search_assets',
        arguments: {
          query,
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
    console.log('[MCP Client] Calling tool:', toolName);
    console.log('[MCP Client] Arguments:', JSON.stringify(args, null, 2));

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
