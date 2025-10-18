# KO Chat Assistant - Setup Guide

Complete setup instructions for deploying the KO Chat Assistant.

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Wrangler (`wrangler login`)
- Active KO Assets deployment (main worker + MCP server)
- Valid session cookie for authentication

## Step-by-Step Setup

### 1. Create KV Namespace

Create a KV namespace for storing chat sessions:

```bash
cd cloudflare
wrangler kv:namespace create "CHAT_SESSIONS"
```

This will output something like:
```
🌀 Creating namespace with title "koassets-CHAT_SESSIONS"
✨ Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "CHAT_SESSIONS"
id = "abc123..."
```

### 2. Update wrangler.toml

Replace the placeholder ID in `cloudflare/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CHAT_SESSIONS"
id = "YOUR_ACTUAL_KV_NAMESPACE_ID"  # Replace with the ID from step 1
```

### 3. Configure MCP Server URL

Update the MCP server URL in `wrangler.toml` based on your environment:

**For Local Development:**
```toml
MCP_SERVER_URL = "http://localhost:8787/mcp"
```

**For Staging:**
```toml
MCP_SERVER_URL = "https://mcp.koassets-staging.adobeaem.workers.dev/mcp"
```

**For Production:**
```toml
MCP_SERVER_URL = "https://mcp.koassets.adobeaem.workers.dev/mcp"
```

### 4. Enable Workers AI

Workers AI should already be configured in `wrangler.toml`:

```toml
[ai]
binding = "AI"
```

No additional setup needed - this uses Cloudflare's Workers AI (included in Workers plan).

### 5. Deploy Cloudflare Worker

```bash
cd cloudflare
npm install
npm run deploy:staging  # or deploy:production
```

### 6. Add Block to EDS Page

In your AEM/DA content, create a new page or edit an existing one:

```markdown
# Chat with KO Assets

| KO Chat Assistant |
|-------------------|
|                   |
```

The block name is case-insensitive, so `ko-chat-assistant`, `KO Chat Assistant`, or `Ko-Chat-Assistant` all work.

### 7. Test the Integration

1. Visit your page with the chat block
2. You should see the chat interface with a welcome message
3. Try a test query: "Find Coca-Cola images"
4. Verify assets are displayed

## Configuration Options

### Session TTL

By default, chat sessions expire after 1 hour. To change this, edit `cloudflare/src/agent/chat-handler.js`:

```javascript
await env.CHAT_SESSIONS.put(sessionId, JSON.stringify(trimmedHistory), {
  expirationTtl: 3600, // Change to desired seconds (e.g., 7200 = 2 hours)
});
```

### Conversation History Length

Control how many messages are kept in context:

**Frontend (sessionStorage):**
```javascript
// In ko-chat-assistant.js, line ~73
const trimmedHistory = history.slice(-20); // Keep last 20 messages
```

**Backend (LLM context):**
```javascript
// In chat-handler.js, buildMessagesForLLM()
const recentHistory = history.slice(-10); // Send last 10 to LLM
```

### LLM Model

To change the AI model, edit `chat-handler.js`:

```javascript
const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  messages,
  max_tokens: 512,
});
```

Available models (as of Oct 2024):
- `@cf/meta/llama-3.1-8b-instruct` (default, good balance)
- `@cf/meta/llama-3-8b-instruct`
- `@cf/mistral/mistral-7b-instruct-v0.1`

See [Cloudflare AI models](https://developers.cloudflare.com/workers-ai/models/) for updated list.

### Default Suggested Prompts

Edit in `ko-chat-assistant.js`, around line 215:

```javascript
const defaultPrompts = [
  'Show me recent Coca-Cola images',
  'Find Sprite assets for social media',
  'Search for Fanta video assets',
  // Add your custom prompts here
];
```

## Verification

### Check Worker is Running

```bash
curl https://your-worker.workers.dev/api/chat \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{"message": "test", "sessionId": "test_123"}'
```

### Check KV Namespace

```bash
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

### Check MCP Connection

Test MCP server directly:

```bash
curl -X POST https://mcp.koassets.adobeaem.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

## Troubleshooting

### "Failed to process chat request"

**Check:**
1. Workers AI is enabled (it's included in Workers plan)
2. MCP_SERVER_URL is correct
3. Session cookie is valid
4. MCP server is deployed and running

**Debug:**
```bash
wrangler tail  # View live logs
```

### Assets not displaying

**Check:**
1. MCP server returns valid data
2. Asset thumbnail URLs are accessible
3. CORS headers allow asset loading

**Debug:**
Open browser console and check network tab for failed requests.

### Session not persisting

**Check:**
1. KV namespace is properly bound
2. Session ID is being generated
3. Browser allows sessionStorage

**Debug:**
```javascript
// In browser console
console.log(sessionStorage.getItem('ko-chat-session-id'));
console.log(sessionStorage.getItem('ko-chat-history'));
```

### Intent detection not working

**Check:**
1. Query contains recognizable keywords (find, search, show, etc.)
2. Brand names are spelled correctly
3. Check chat-handler.js detectIntentAndGenerateToolCalls()

**Improve:**
Add custom patterns to `detectIntentAndGenerateToolCalls()`.

## Performance Optimization

### Reduce Worker Execution Time

1. **Cache MCP responses** (if applicable):
   ```javascript
   // Add caching layer in mcp-client.js
   const cacheKey = `mcp:${toolName}:${JSON.stringify(args)}`;
   ```

2. **Limit conversation history**:
   ```javascript
   // Send fewer messages to LLM
   const recentHistory = history.slice(-5);
   ```

3. **Use smaller AI model** for faster responses

### Reduce Costs

1. **Workers AI is free** up to 10,000 requests/day
2. **KV reads are cheap** (1M reads = $0.50)
3. **Optimize MCP calls** - batch when possible

## Advanced Configuration

### Custom Authentication

To use different authentication:

1. Edit `cloudflare/src/index.js`
2. Modify the authentication middleware
3. Update chat-handler to pass custom headers

### Multiple Chat Instances

To run multiple chat assistants:

1. Create separate KV namespaces
2. Use different session prefixes
3. Configure different MCP servers

### Analytics

Add analytics tracking:

```javascript
// In chat-handler.js
await env.ANALYTICS.writeDataPoint({
  blobs: [userMessage, assistantMessage],
  doubles: [responseTime],
  indexes: [sessionId],
});
```

## Security Considerations

1. **Session cookies**: Always transmitted over HTTPS
2. **XSS protection**: All user input is escaped (see `escapeHtml()`)
3. **Rate limiting**: Consider adding rate limits to `/api/chat`
4. **Input validation**: Validate message length and format
5. **CORS**: Already configured in main worker

## Monitoring

### Key Metrics to Track

- Chat API response time
- MCP server latency
- LLM token usage
- Session storage size
- Error rates

### Cloudflare Dashboard

Monitor in Cloudflare Dashboard:
- Workers > Analytics
- KV > Metrics
- AI > Usage

## Support & Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [KV Storage Docs](https://developers.cloudflare.com/kv/)
- [MCP Server README](../../../mcp-server/README.md)

## Next Steps

After successful deployment:

1. ✅ Test with real queries
2. ✅ Gather user feedback
3. ✅ Monitor performance metrics
4. ✅ Iterate on system prompt
5. ✅ Add custom intents as needed
6. 🔄 Plan Phase 3 enhancements

---

**Need help?** Contact the KO Assets development team.



