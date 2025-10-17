/**
 * Chat Agent Handler
 * Manages conversational interactions with KO Assets using LLM and MCP tools
 */

import { callMCPTool } from './mcp-client.js';
import { formatAssetResponse, formatRightsResponse } from './response-formatter.js';

/**
 * System prompt for the KO Assets chat assistant
 */
const SYSTEM_PROMPT = `You are a helpful assistant for KO Assets, The Coca-Cola Company's digital asset management system.

Your role is to help Coca-Cola employees and bottlers find, explore, and check usage rights for digital assets including images, videos, and documents.

Available tools:
- search_assets: Search for assets by keywords, brands, categories, formats, etc.
- get_asset_metadata: Get detailed information about a specific asset
- get_asset_renditions: Get available formats/versions of an asset
- check_asset_rights: Verify if assets can be used in specific markets and media channels
- list_facet_values: Discover available filter options (brands, categories, etc.)
- get_rights_hierarchy: Get the list of markets and media channels

Key brands: Coca-Cola, Sprite, Fanta, Powerade, Dasani, smartwater, vitaminwater, and many more.

When users ask for assets:
1. Use search_assets to find relevant assets
2. If they ask about usage rights, use check_asset_rights
3. Always be specific about what you find
4. Format responses in a friendly, professional manner
5. Suggest related searches when appropriate

Important:
- Rights clearance is critical - always check rights when requested
- Be clear about what assets can and cannot be used
- Use market and media channel names that users understand (e.g., "United States" not just IDs)
- Provide actionable responses

Keep responses concise and helpful. Focus on asset discovery and rights guidance.`;

/**
 * Handles chat requests
 */
export async function handleChatRequest(request, env) {
  try {
    const body = await request.json();
    const { message, sessionId, conversationHistory = [] } = body;

    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Load conversation history from KV if sessionId provided
    let history = conversationHistory;
    if (sessionId && env.CHAT_SESSIONS) {
      const stored = await env.CHAT_SESSIONS.get(sessionId);
      if (stored) {
        history = JSON.parse(stored);
      }
    }

    // Add user message to history
    history.push({
      role: 'user',
      content: message,
      timestamp: Date.now(),
    });

    // Prepare messages for LLM with conversation context
    const messages = buildMessagesForLLM(history);

    // Get available MCP tools as function definitions
    const tools = getMCPToolDefinitions();

    // Call LLM with function calling
    const llmResponse = await callLLMWithTools(messages, tools, env);

    // Process function calls if any
    let assistantMessage = llmResponse.content;
    let toolResults = [];

    if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
      // Execute tool calls
      toolResults = await executeToolCalls(llmResponse.toolCalls, env, request);

      // Get final response from LLM with tool results
      const finalResponse = await getLLMFinalResponse(
        messages,
        tools,
        llmResponse.toolCalls,
        toolResults,
        env
      );

      assistantMessage = finalResponse.content;
    }

    // Format response with rich content if applicable
    const formattedResponse = formatResponse(assistantMessage, toolResults);

    // Add assistant message to history
    history.push({
      role: 'assistant',
      content: assistantMessage,
      toolCalls: llmResponse.toolCalls,
      toolResults: toolResults.map(r => ({ name: r.name, success: r.success })),
      timestamp: Date.now(),
    });

    // Save conversation history to KV (keep last 20 messages)
    if (sessionId && env.CHAT_SESSIONS) {
      const trimmedHistory = history.slice(-20);
      await env.CHAT_SESSIONS.put(sessionId, JSON.stringify(trimmedHistory), {
        expirationTtl: 3600, // 1 hour
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: formattedResponse.text,
        assets: formattedResponse.assets,
        rightsReport: formattedResponse.rightsReport,
        suggestedPrompts: generateSuggestedPrompts(message, toolResults),
        sessionId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Chat Error]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process chat request',
        message: "I'm sorry, I encountered an error processing your request. Please try again.",
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Build messages array for LLM from conversation history
 */
function buildMessagesForLLM(history) {
  const messages = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
  ];

  // Add conversation history (keep last 10 exchanges for context)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  return messages;
}

/**
 * Get MCP tool definitions formatted for LLM function calling
 */
function getMCPToolDefinitions() {
  return [
    {
      name: 'search_assets',
      description: 'Search for digital assets using keywords and filters. Returns asset IDs, titles, thumbnails, and metadata.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search keywords (can be empty for browsing)',
          },
          facetFilters: {
            type: 'object',
            description: 'Filters for brand, category, format, etc.',
            properties: {
              brand: { type: 'array', items: { type: 'string' } },
              category: { type: 'array', items: { type: 'string' } },
              format: { type: 'array', items: { type: 'string' } },
            },
          },
          hitsPerPage: {
            type: 'number',
            description: 'Number of results to return (default: 12)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'check_asset_rights',
      description: 'Check if assets are cleared for use in specific markets and media channels during a date range.',
      parameters: {
        type: 'object',
        properties: {
          assetIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of asset IDs to check',
          },
          markets: {
            type: 'array',
            items: { type: 'number' },
            description: 'Market rights IDs',
          },
          mediaChannels: {
            type: 'array',
            items: { type: 'number' },
            description: 'Media channel IDs',
          },
          airDate: {
            type: 'number',
            description: 'Start date as Unix timestamp',
          },
          pullDate: {
            type: 'number',
            description: 'End date as Unix timestamp',
          },
        },
        required: ['assetIds'],
      },
    },
    {
      name: 'get_asset_metadata',
      description: 'Get detailed metadata for a specific asset including all fields and properties.',
      parameters: {
        type: 'object',
        properties: {
          assetId: {
            type: 'string',
            description: 'The asset ID',
          },
        },
        required: ['assetId'],
      },
    },
    {
      name: 'list_facet_values',
      description: 'List available values for filters like brands, categories, formats.',
      parameters: {
        type: 'object',
        properties: {
          facetName: {
            type: 'string',
            description: 'The facet to list (e.g., "brand", "category", "format")',
          },
        },
        required: ['facetName'],
      },
    },
  ];
}

/**
 * Call LLM with function calling support
 * Using Cloudflare Workers AI
 */
async function callLLMWithTools(messages, tools, env) {
  try {
    // Use Cloudflare Workers AI with a model that supports function calling
    // For now, we'll use a simpler approach and parse intent from the response
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: 512,
    });

    const content = response.response || '';

    // Simple intent detection for Phase 1+2
    const toolCalls = detectIntentAndGenerateToolCalls(
      messages[messages.length - 1].content,
      content
    );

    return {
      content,
      toolCalls,
    };
  } catch (error) {
    console.error('[LLM Error]', error);
    // Fallback: try to detect intent from user message directly
    const userMessage = messages[messages.length - 1].content;
    const toolCalls = detectIntentAndGenerateToolCalls(userMessage, '');

    return {
      content: "Let me search for that...",
      toolCalls,
    };
  }
}

/**
 * Detect user intent and generate appropriate tool calls
 * Simplified approach for Phase 1+2
 */
function detectIntentAndGenerateToolCalls(userMessage, llmResponse) {
  const lower = userMessage.toLowerCase();
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
    // Extract brand name if mentioned
    const brands = ['coca-cola', 'sprite', 'fanta', 'powerade', 'dasani', 'smartwater', 'vitaminwater'];
    const mentionedBrands = brands.filter(brand => lower.includes(brand));

    // Extract category
    const categories = ['image', 'video', 'document'];
    const mentionedCategories = categories.filter(cat => lower.includes(cat));

    const facetFilters = {};
    if (mentionedBrands.length > 0) {
      facetFilters.brand = mentionedBrands.map(b => 
        b.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')
      );
    }
    if (mentionedCategories.length > 0) {
      facetFilters.category = mentionedCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1));
    }

    toolCalls.push({
      id: `call_${Date.now()}`,
      name: 'search_assets',
      arguments: {
        query: userMessage,
        facetFilters,
        hitsPerPage: 12,
      },
    });
  }

  // Detect rights check intent
  if (
    lower.includes('rights') ||
    lower.includes('approved') ||
    lower.includes('clearance') ||
    lower.includes('can i use') ||
    lower.includes('allowed') ||
    lower.includes('authorized')
  ) {
    // This would need asset IDs from context or search results
    // For now, we'll flag it but not execute until we have asset IDs
    if (lower.includes('urn:aaid:aem:')) {
      // Extract asset ID from message
      const match = userMessage.match(/urn:aaid:aem:[a-f0-9-]+/);
      if (match) {
        toolCalls.push({
          id: `call_${Date.now()}_rights`,
          name: 'check_asset_rights',
          arguments: {
            assetIds: [match[0]],
          },
        });
      }
    }
  }

  return toolCalls;
}

/**
 * Execute tool calls via MCP
 */
async function executeToolCalls(toolCalls, env, request) {
  const results = [];

  for (const call of toolCalls) {
    try {
      const result = await callMCPTool(call.name, call.arguments, env, request);
      results.push({
        id: call.id,
        name: call.name,
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(`[Tool Error] ${call.name}:`, error);
      results.push({
        id: call.id,
        name: call.name,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get final response from LLM with tool results
 */
async function getLLMFinalResponse(messages, tools, toolCalls, toolResults, env) {
  // Add tool results to context
  const resultsText = toolResults
    .map(r => `Tool ${r.name}: ${r.success ? 'Success' : 'Failed'}\n${JSON.stringify(r.data || r.error, null, 2)}`)
    .join('\n\n');

  messages.push({
    role: 'assistant',
    content: `I've executed the following tools:\n${resultsText}\n\nLet me summarize the results for you.`,
  });

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages,
      max_tokens: 512,
    });

    return {
      content: response.response || 'I found some results for you.',
    };
  } catch (error) {
    console.error('[LLM Final Response Error]', error);
    return {
      content: formatFallbackResponse(toolResults),
    };
  }
}

/**
 * Format fallback response when LLM fails
 */
function formatFallbackResponse(toolResults) {
  for (const result of toolResults) {
    if (result.name === 'search_assets' && result.success) {
      const data = result.data;
      const hits = data.data?.hits || data.hits || [];
      return `I found ${hits.length} asset${hits.length !== 1 ? 's' : ''} matching your search.`;
    }
  }
  return 'I completed your request.';
}

/**
 * Format response with rich content
 */
function formatResponse(text, toolResults) {
  const response = {
    text,
    assets: null,
    rightsReport: null,
  };

  for (const result of toolResults) {
    if (result.name === 'search_assets' && result.success) {
      response.assets = formatAssetResponse(result.data);
    } else if (result.name === 'check_asset_rights' && result.success) {
      response.rightsReport = formatRightsResponse(result.data);
    }
  }

  return response;
}

/**
 * Generate suggested prompts based on context
 */
function generateSuggestedPrompts(userMessage, toolResults) {
  const prompts = [];
  const lower = userMessage.toLowerCase();

  // Context-aware suggestions
  if (lower.includes('sprite')) {
    prompts.push('Show me Sprite video assets');
    prompts.push('Find Sprite assets for social media');
  } else if (lower.includes('coca-cola')) {
    prompts.push('Show me Coca-Cola holiday campaign assets');
    prompts.push('Find Coca-Cola images');
  } else {
    // Generic suggestions
    prompts.push('Show me recent Coca-Cola assets');
    prompts.push('Find Sprite images');
    prompts.push('Search for Fanta videos');
  }

  // Add rights-related suggestion if search was performed
  if (toolResults.some(r => r.name === 'search_assets' && r.success)) {
    prompts.push('Check usage rights for these assets');
  }

  return prompts.slice(0, 3);
}



