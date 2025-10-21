/**
 * KO Assets MCP Server
 * Cloudflare Worker implementation of Model Context Protocol for asset search and rights management
 */

import { handleMCPRequest } from './mcp-handler.js';
import { corsHeaders } from './utils/cors.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'koassets-mcp-server' }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // MCP endpoint - handles JSON-RPC 2.0 requests
    if (url.pathname === '/mcp' || url.pathname === '/') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          const response = await handleMCPRequest(body, env, request);
          
          return new Response(JSON.stringify(response), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        } catch (error) {
          console.error('MCP request error:', error);
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal error',
              data: error.message
            },
            id: null
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
      }
    }

    // SSE endpoint for streaming (if needed in future)
    if (url.pathname === '/mcp/sse') {
      return new Response('SSE endpoint - not yet implemented', {
        status: 501,
        headers: corsHeaders
      });
    }

    // Default 404
    return new Response('Not Found', {
      status: 404,
      headers: corsHeaders
    });
  }
};

