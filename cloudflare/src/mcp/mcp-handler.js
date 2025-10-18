/**
 * MCP Protocol Handler
 * Implements Model Context Protocol JSON-RPC 2.0 methods
 */

import { getPrompt, listPrompts } from './prompts/index.js';
import { listResources, readResource } from './resources/index.js';
import { callTool, listTools } from './tools/index.js';

const SERVER_INFO = {
  name: 'koassets-search',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
};

/**
 * Main MCP request handler
 * Dispatches JSON-RPC 2.0 requests to appropriate handlers
 */
export async function handleMCPRequest(body, env, request) {
  const {
    jsonrpc, method, params, id,
  } = body;

  // Validate JSON-RPC 2.0 format
  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request - jsonrpc must be "2.0"',
      },
      id: id || null,
    };
  }

  if (!method) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request - method is required',
      },
      id: id || null,
    };
  }

  try {
    console.log('[MCP Handler] ================');
    console.log('[MCP Handler] Method:', method);
    console.log('[MCP Handler] Params:', JSON.stringify(params, null, 2));
    console.log('[MCP Handler] Request ID:', id);

    let result;

    switch (method) {
      case 'initialize':
        result = await handleInitialize(params, env);
        break;

      case 'tools/list':
        result = await handleToolsList(params, env);
        break;

      case 'tools/call':
        result = await handleToolsCall(params, env, request);
        break;

      case 'resources/list':
        result = await handleResourcesList(params, env);
        break;

      case 'resources/read':
        result = await handleResourcesRead(params, env, request);
        break;

      case 'prompts/list':
        result = await handlePromptsList(params, env);
        break;

      case 'prompts/get':
        result = await handlePromptsGet(params, env);
        break;

      case 'ping':
        result = {};
        break;

      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id: id || null,
        };
    }

    return {
      jsonrpc: '2.0',
      result,
      id: id || null,
    };
  } catch (error) {
    console.error(`Error handling method ${method}:`, error);
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message,
      },
      id: id || null,
    };
  }
}

/**
 * Handle initialize request
 */
async function handleInitialize(_params, _env) {
  return {
    protocolVersion: SERVER_INFO.protocolVersion,
    capabilities: SERVER_INFO.capabilities,
    serverInfo: {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
    },
  };
}

/**
 * Handle tools/list request
 */
async function handleToolsList(_params, env) {
  const tools = await listTools(env);
  return { tools };
}

/**
 * Handle tools/call request
 */
async function handleToolsCall(params, env, request) {
  const { name, arguments: args } = params;

  if (!name) {
    throw new Error('Tool name is required');
  }

  const result = await callTool(name, args || {}, env, request);
  return result;
}

/**
 * Handle resources/list request
 */
async function handleResourcesList(_params, env) {
  const resources = await listResources(env);
  return { resources };
}

/**
 * Handle resources/read request
 */
async function handleResourcesRead(params, env, request) {
  const { uri } = params;

  if (!uri) {
    throw new Error('Resource URI is required');
  }

  const contents = await readResource(uri, env, request);
  return { contents };
}

/**
 * Handle prompts/list request
 */
async function handlePromptsList(_params, env) {
  const prompts = await listPrompts(env);
  return { prompts };
}

/**
 * Handle prompts/get request
 */
async function handlePromptsGet(params, env) {
  const { name, arguments: args } = params;

  if (!name) {
    throw new Error('Prompt name is required');
  }

  const result = await getPrompt(name, args || {}, env);
  return result;
}
