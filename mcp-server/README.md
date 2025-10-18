# KO Assets MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server implementation for KO Assets, providing LLM-based access to digital asset management and rights clearance capabilities.

## Overview

This MCP server enables AI assistants to interact with The Coca-Cola Company's digital asset library, allowing natural language queries for searching assets, checking usage rights, and exploring asset metadata.

## Features

### 🔍 **Tools**

1. **search_assets** - Search for digital assets using keywords and filters
2. **get_asset_metadata** - Retrieve comprehensive metadata for specific assets
3. **get_asset_renditions** - Get available versions/formats of assets
4. **check_asset_rights** - Verify usage rights for markets and media channels
5. **list_facet_values** - Discover available filter values
6. **get_rights_hierarchy** - Get market and media channel hierarchies
7. **search_collections** - Find curated asset collections

### 📦 **Resources**

- `asset://{assetId}` - Direct access to asset metadata via URI
- `koassets://help` - Help documentation

### 💬 **Prompts**

Pre-configured prompt templates for common tasks:
- **find-brand-assets** - Find assets for a specific brand
- **check-usage-rights** - Check asset usage rights
- **explore-brand** - Get comprehensive brand overview
- **find-campaign-assets** - Find campaign-related assets

## Architecture

This MCP server is implemented as a **Cloudflare Worker** and acts as a bridge between AI assistants and the KO Assets API:

```
┌─────────────┐      JSON-RPC 2.0       ┌──────────────┐
│             │ ◄────────────────────► │              │
│  AI Client  │                         │  MCP Server  │
│  (Claude)   │                         │  (Worker)    │
└─────────────┘                         └──────┬───────┘
                                               │
                                               │ HTTP/REST
                                               ▼
                                        ┌──────────────┐
                                        │  KO Assets   │
                                        │     API      │
                                        │  (Worker)    │
                                        └──────┬───────┘
                                               │
                    ┌──────────────────────────┼────────────────────┐
                    │                          │                    │
                    ▼                          ▼                    ▼
            ┌───────────────┐        ┌────────────────┐    ┌──────────────┐
            │ Adobe Dynamic │        │     FADEL      │    │    Helix     │
            │     Media     │        │ (Rights API)   │    │              │
            └───────────────┘        └────────────────┘    └──────────────┘
```

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

### Environment Variables

Set these in `wrangler.toml` or via Wrangler secrets:

- `KOASSETS_API_URL` - Base URL for the KO Assets API (default: http://localhost:8787)
- `ALGOLIA_INDEX` - Algolia index name (e.g., "92206-211033" for staging)

### Authentication

The MCP server forwards authentication cookies from the client to the main KO Assets API. Ensure clients include valid session cookies when making requests.

## Development

### Local Development

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

### Testing

Test the MCP server using the MCP Inspector or curl:

```bash
# Health check
curl http://localhost:8787/health

# MCP initialize
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'

# List tools
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'

# Search assets
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_assets",
      "arguments": {
        "query": "Coca-Cola",
        "facetFilters": {
          "brand": ["Coca-Cola"]
        },
        "hitsPerPage": 10
      }
    },
    "id": 3
  }'
```

## Deployment

### Staging

```bash
npm run deploy:staging
```

Deployed to: `https://mcp.koassets-staging.adobeaem.workers.dev`

### Production

```bash
npm run deploy:production
```

Deployed to: `https://mcp.koassets.adobeaem.workers.dev`

## Usage Examples

### Example 1: Search for Brand Assets

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_assets",
    "arguments": {
      "query": "",
      "facetFilters": {
        "brand": ["Coca-Cola"],
        "category": ["Image"]
      },
      "hitsPerPage": 24
    }
  },
  "id": 1
}
```

### Example 2: Check Asset Rights

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "check_asset_rights",
    "arguments": {
      "assetIds": ["urn:aaid:aem:12345678-1234-1234-1234-123456789abc"],
      "markets": [123, 456],
      "mediaChannels": [789],
      "airDate": 1704067200,
      "pullDate": 1735689600
    }
  },
  "id": 2
}
```

### Example 3: Use a Prompt

```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "find-brand-assets",
    "arguments": {
      "brand": "Sprite",
      "category": "Image",
      "limit": 20
    }
  },
  "id": 3
}
```

## Integration with AI Clients

### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "koassets": {
      "url": "https://mcp.koassets.adobeaem.workers.dev/mcp",
      "transport": "http",
      "headers": {
        "Cookie": "session=YOUR_SESSION_COOKIE"
      }
    }
  }
}
```

### Other MCP Clients

The server implements the standard MCP protocol and can be used with any MCP-compatible client. See [MCP documentation](https://modelcontextprotocol.io) for integration guides.

## API Reference

### Tools

#### search_assets

Search for digital assets using keywords and filters.

**Arguments:**
- `query` (string) - Search term
- `facetFilters` (object) - Filters by brand, category, format, etc.
- `dateRange` (object) - Date range filter
- `page` (number) - Page number (default: 0)
- `hitsPerPage` (number) - Results per page (default: 24)

**Returns:**
```json
{
  "success": true,
  "data": {
    "hits": [...],
    "nbHits": 150,
    "page": 0,
    "nbPages": 7
  }
}
```

#### check_asset_rights

Check if assets are cleared for specific usage.

**Arguments:**
- `assetIds` (array) - Asset IDs to check
- `markets` (array) - Market rights IDs
- `mediaChannels` (array) - Media channel IDs
- `airDate` (number) - Start date (Unix epoch)
- `pullDate` (number) - End date (Unix epoch)

**Returns:**
```json
{
  "success": true,
  "data": {
    "allAuthorized": false,
    "totalAssets": 5,
    "authorizedAssets": 3,
    "restrictedAssets": 2,
    "assets": [...]
  }
}
```

See inline documentation in tool files for complete API details.

## Development Notes

### Project Structure

```
mcp-server/
├── src/
│   ├── index.js              # Main entry point
│   ├── mcp-handler.js        # JSON-RPC 2.0 handler
│   ├── tools/                # MCP tools
│   │   ├── index.js
│   │   ├── search-assets.js
│   │   ├── check-asset-rights.js
│   │   └── ...
│   ├── resources/            # MCP resources
│   │   └── index.js
│   ├── prompts/              # MCP prompts
│   │   └── index.js
│   └── utils/                # Utilities
│       ├── api-client.js     # KO Assets API client
│       └── cors.js           # CORS headers
├── package.json
├── wrangler.toml
└── README.md
```

### Adding New Tools

1. Create a new file in `src/tools/`
2. Export `definition` (tool schema) and `handler` (implementation)
3. Register in `src/tools/index.js`

Example:

```javascript
// src/tools/my-new-tool.js
export const definition = {
  name: 'my_new_tool',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      }
    },
    required: ['param1']
  }
};

export async function handler(args, env, request) {
  // Implementation
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}
```

## Troubleshooting

### Authentication Issues

If you receive 401 errors, ensure:
1. The session cookie is valid and not expired
2. The cookie is being forwarded to the KO Assets API
3. You're accessing the correct environment (staging vs production)

### API Connection Issues

If tools fail to connect to the KO Assets API:
1. Check `KOASSETS_API_URL` is set correctly
2. Verify the main KO Assets worker is running
3. Check network connectivity between workers

### Tool Execution Errors

Enable debug logging:
```javascript
console.log('[Tool]', toolName, args);
```

Check Cloudflare Worker logs in the dashboard.

## License

Apache-2.0

## Support

For issues and questions, please contact the KO Assets development team.

