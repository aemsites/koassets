/**
 * KO Assets MCP API Handler
 * Implements Model Context Protocol for asset search and rights management
 * Integrated into main Cloudflare Worker
 */

import { handleMCPRequest } from './mcp-handler.js';

/**
 * Main MCP API handler
 * Processes JSON-RPC 2.0 requests for the Model Context Protocol
 */
export async function apiMcp(request, env) {
  const url = new URL(request.url);

  // Health check endpoint
  if (url.pathname === '/api/mcp/health') {
    return new Response(JSON.stringify({ status: 'ok', service: 'koassets-mcp' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // MCP endpoint - handles JSON-RPC 2.0 requests
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const response = await handleMCPRequest(body, env, request);

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('MCP request error:', error);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message,
          },
          id: null,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  }

  // Method not allowed
  return new Response('Method Not Allowed', { status: 405 });
}
