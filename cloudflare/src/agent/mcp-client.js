/**
 * MCP Client
 * Calls MCP server tools
 */

/**
 * Call an MCP tool
 */
export async function callMCPTool(toolName, args, env, request) {
  const mcpUrl = env.MCP_SERVER_URL || 'http://localhost:8787/mcp';

  // Get session cookie from original request
  const cookies = request.headers.get('Cookie') || '';

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
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
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
      return data;
    }

    return result.result;
  } catch (error) {
    console.error(`[MCP Client Error] ${toolName}:`, error);
    throw error;
  }
}

/**
 * Initialize MCP session if needed
 */
export async function initializeMCPSession(env, request) {
  const mcpUrl = env.MCP_SERVER_URL || 'http://localhost:8787/mcp';
  const cookies = request.headers.get('Cookie') || '';

  const initRequest = {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'ko-chat-assistant',
        version: '1.0.0',
      },
    },
    id: 1,
  };

  try {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
      body: JSON.stringify(initRequest),
    });

    return response.ok;
  } catch (error) {
    console.error('[MCP Init Error]', error);
    return false;
  }
}



