# KO Chat Assistant Block

A conversational interface for KO Assets that enables natural language search, asset discovery, and rights clearance checking through an AI-powered chat assistant.

## Overview

The KO Chat Assistant provides Coca-Cola employees and bottlers with an intuitive way to:
- Search for assets using natural language
- Check usage rights for specific markets and media channels
- Get asset recommendations and discover related content
- Access asset metadata and renditions
- Navigate the asset library conversationally

## Features

### Phase 1 + 2 Implementation

✅ **Chat Interface**
- Modern, responsive chat UI
- Message history with session persistence
- Real-time typing indicators
- Auto-scrolling and textarea expansion

✅ **Natural Language Search**
- Understands queries like "Find Sprite images" or "Show me Coca-Cola videos"
- Automatic brand and category detection
- Context-aware search with conversation memory

✅ **Rich Asset Display**
- Asset cards with thumbnails
- Brand, category, and format information
- Quick action buttons (view, download)
- Grid layout for easy browsing

✅ **Rights Checking**
- Visual rights reports
- Clear/restricted status indicators
- Market and media channel validation

✅ **Suggested Prompts**
- Context-aware prompt suggestions
- Default prompts for getting started
- One-click prompt selection

✅ **Session Management**
- Conversation history saved in sessionStorage
- Session restoration on page reload
- Automatic cleanup after 1 hour

## Architecture

```
┌─────────────────────────────┐
│  EDS Block (Frontend)       │
│  - Chat UI                  │
│  - Message display          │
│  - Asset cards              │
└──────────┬──────────────────┘
           │ POST /api/chat
           ▼
┌─────────────────────────────┐
│  Cloudflare Worker          │
│  - Chat handler             │
│  - LLM orchestration        │
│  - MCP client               │
└──────────┬──────────────────┘
           │ JSON-RPC 2.0
           ▼
┌─────────────────────────────┐
│  MCP Server                 │
│  - search_assets            │
│  - check_asset_rights       │
│  - get_asset_metadata       │
└─────────────────────────────┘
```

## Usage

### Adding to a Page

In your AEM/EDS page, add the block:

```
| KO Chat Assistant |
|-------------------|
|                   |
```

### Example Queries

**Search for Assets:**
- "Find Coca-Cola images"
- "Show me Sprite videos"
- "Search for Fanta social media assets"
- "Get recent Powerade campaign assets"

**Check Usage Rights:**
- "Check if these assets can be used in Japan"
- "Are these approved for TV advertising?"
- "Can I use this in the US for digital marketing?"

**Browse by Brand:**
- "Show me all Dasani assets"
- "Find smartwater images"
- "What Coca-Cola assets do we have?"

## Configuration

### Cloudflare Worker Setup

The chat assistant requires:

1. **KV Namespace** for session storage:
   ```bash
   wrangler kv:namespace create "CHAT_SESSIONS"
   ```

2. **Workers AI** binding in `wrangler.toml`:
   ```toml
   [ai]
   binding = "AI"
   ```

3. **MCP Server URL** environment variable:
   ```toml
   MCP_SERVER_URL = "https://mcp.koassets.adobeaem.workers.dev/mcp"
   ```

### Environment Variables

Set in `wrangler.toml`:

- `MCP_SERVER_URL` - URL of your MCP server endpoint
- `CHAT_SESSIONS` (KV namespace) - For storing conversation history

## Components

### Frontend (EDS Block)

**Files:**
- `ko-chat-assistant.js` - Block logic and UI
- `ko-chat-assistant.css` - Styling

**Key Functions:**
- `createChatUI()` - Builds the chat interface
- `sendMessage()` - Sends user messages to API
- `createAssetCard()` - Renders asset results
- `createRightsReport()` - Displays rights checking results

### Backend (Cloudflare Worker)

**Files:**
- `cloudflare/src/agent/chat-handler.js` - Main chat orchestration
- `cloudflare/src/agent/mcp-client.js` - MCP server communication
- `cloudflare/src/agent/response-formatter.js` - Result formatting

**Key Functions:**
- `handleChatRequest()` - Processes chat API requests
- `callLLMWithTools()` - Integrates with Cloudflare Workers AI
- `executeToolCalls()` - Calls MCP server tools
- `formatAssetResponse()` - Formats search results

## API

### POST /api/chat

**Request:**
```json
{
  "message": "Find Coca-Cola images",
  "sessionId": "chat_1234567890_abcdef",
  "conversationHistory": [
    { "role": "user", "content": "...", "timestamp": 1234567890 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "I found 24 Coca-Cola images...",
  "assets": {
    "total": 24,
    "count": 12,
    "assets": [
      {
        "id": "urn:aaid:aem:...",
        "title": "Coca-Cola Bottle",
        "thumbnail": "https://...",
        "brand": "Coca-Cola",
        "category": "Image"
      }
    ]
  },
  "rightsReport": null,
  "suggestedPrompts": [
    "Show me Coca-Cola videos",
    "Check usage rights for these assets"
  ],
  "sessionId": "chat_1234567890_abcdef"
}
```

## Development

### Local Testing

1. Start the main worker:
   ```bash
   npm run dev
   ```

2. Start the MCP server (if separate):
   ```bash
   cd mcp-server
   npm run dev
   ```

3. Open the EDS page with the block:
   ```
   http://localhost:8787/your-page
   ```

### Testing Queries

Use the chat interface or test the API directly:

```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "message": "Find Sprite images",
    "sessionId": "test_session"
  }'
```

## Customization

### Modifying System Prompt

Edit `cloudflare/src/agent/chat-handler.js`:

```javascript
const SYSTEM_PROMPT = `You are a helpful assistant for KO Assets...`;
```

### Adding New Intents

Extend `detectIntentAndGenerateToolCalls()` in `chat-handler.js`:

```javascript
if (lower.includes('my custom intent')) {
  toolCalls.push({
    name: 'custom_tool',
    arguments: { ... }
  });
}
```

### Styling

Modify `ko-chat-assistant.css` to match your brand guidelines.

## Limitations & Future Enhancements

### Current Limitations

- Intent detection is pattern-based (Phase 1+2)
- No multi-turn tool orchestration (e.g., search then check rights automatically)
- Single user session (no cross-device sync)
- Limited to 10 messages context window

### Planned Enhancements (Phase 3)

- [ ] Advanced LLM with native function calling
- [ ] WebSocket streaming responses
- [ ] Durable Objects for real-time conversations
- [ ] Guided workflows (search → filter → rights check)
- [ ] Voice input/output
- [ ] Multi-language support
- [ ] Analytics and query insights
- [ ] Saved conversation export

## Troubleshooting

### Chat not responding

1. Check browser console for errors
2. Verify authentication (session cookie)
3. Check Cloudflare Worker logs
4. Ensure MCP server is running

### Assets not displaying

1. Verify MCP server connection
2. Check asset thumbnail URLs
3. Ensure CORS is properly configured

### Session lost after refresh

- Check sessionStorage in browser DevTools
- Verify session ID generation
- Check 1-hour TTL in KV namespace

## Support

For issues or questions:
- Check Cloudflare Worker logs
- Review MCP server health: `GET /health`
- Contact the KO Assets development team

## License

Apache-2.0



