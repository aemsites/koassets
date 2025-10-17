# KO Chat Assistant

🤖 AI-powered conversational interface for KO Assets

## Quick Links

- **User Guide**: See [blocks/ko-chat-assistant/README.md](blocks/ko-chat-assistant/README.md)
- **Setup Instructions**: See [blocks/ko-chat-assistant/SETUP.md](blocks/ko-chat-assistant/SETUP.md)
- **API Documentation**: See below

---

## What is it?

The KO Chat Assistant is a conversational AI interface that allows Coca-Cola employees and bottlers to interact with the KO Assets digital library using natural language. Instead of navigating complex filters and search interfaces, users can simply ask questions like:

- *"Show me Sprite images for social media"*
- *"Find assets from the Summer 2024 Coca-Cola campaign"*
- *"Can I use this asset in Japan for TV advertising?"*

The assistant understands context, provides relevant results, checks usage rights, and offers suggestions - all through a familiar chat interface.

## Features

### ✅ Implemented (Phase 1 + 2)

- **Natural Language Search**: Ask questions in plain English
- **Asset Discovery**: Find images, videos, and documents
- **Rich Asset Cards**: Preview thumbnails with metadata
- **Rights Checking**: Verify usage permissions for markets/channels
- **Conversation Memory**: Maintains context across messages
- **Suggested Prompts**: Get ideas for what to ask
- **Session Persistence**: Conversations saved during your session
- **Mobile Responsive**: Works on all devices

### 🔄 Planned (Phase 3)

- WebSocket streaming for real-time responses
- Multi-tool orchestration (auto-chain searches + rights checks)
- Guided workflows (step-by-step asset clearance)
- Voice input/output
- Multi-language support
- Analytics and insights dashboard
- Advanced LLM with native function calling

## Architecture

```
User Query
    ↓
EDS Block (Chat UI)
    ↓
Cloudflare Worker (Agent)
    ↓
Workers AI (LLM)
    ↓
MCP Server (Tools)
    ↓
KO Assets API
    ↓
Results → Format → Display
```

**Tech Stack:**
- **Frontend**: Adobe EDS Block (vanilla JS)
- **Backend**: Cloudflare Worker (JavaScript)
- **AI**: Cloudflare Workers AI (Llama 3.1)
- **Storage**: Cloudflare KV (sessions)
- **API**: MCP Server (existing)

## Getting Started

### For Users

1. Navigate to any page with the KO Chat Assistant block
2. Type your question in the chat input
3. Press Enter or click Send
4. View results and interact with asset cards
5. Click suggested prompts for more ideas

### For Developers

See [SETUP.md](blocks/ko-chat-assistant/SETUP.md) for complete deployment instructions.

**Quick deploy:**
```bash
# 1. Create KV namespace
wrangler kv:namespace create "CHAT_SESSIONS"

# 2. Update wrangler.toml with KV ID

# 3. Deploy
npm run deploy:staging
```

## API Reference

### POST /api/chat

Sends a message to the chat assistant.

**Request:**
```json
{
  "message": "Find Coca-Cola images",
  "sessionId": "chat_1234567890_abcdef",
  "conversationHistory": []
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
    "assets": [...]
  },
  "rightsReport": null,
  "suggestedPrompts": ["...", "..."],
  "sessionId": "chat_1234567890_abcdef"
}
```

**Authentication:**
- Requires valid session cookie
- Same authentication as main KO Assets app

**Rate Limiting:**
- TBD (currently unlimited)

## Examples

### Search for Assets

**Query:** "Show me recent Sprite images"

**Response:**
- Text: "I found 18 Sprite images from the last month."
- Asset cards with thumbnails
- Suggested prompts: "Show me Sprite videos", "Find Sprite social media assets"

### Check Rights

**Query:** "Can I use these assets in Japan for TV?"

**Response:**
- Text: "Let me check the rights for Japan TV advertising."
- Rights report: 3 of 5 assets cleared
- Details on restricted assets

### Browse by Brand

**Query:** "What Fanta assets do we have?"

**Response:**
- Text: "We have 142 Fanta assets across images, videos, and documents."
- Sample asset cards
- Suggested prompts: "Show me Fanta images", "Find Fanta videos"

## How It Works

### 1. Intent Detection

When you send a message, the system analyzes it to understand what you want:

```javascript
"Find Sprite images" 
  → Intent: SEARCH
  → Brand: Sprite
  → Category: Image
  → Tool: search_assets
```

### 2. Tool Execution

The detected intent triggers MCP tools:

```javascript
search_assets({
  query: "Sprite",
  facetFilters: {
    brand: ["Sprite"],
    category: ["Image"]
  },
  hitsPerPage: 12
})
```

### 3. Response Formatting

Results are formatted for display:

```javascript
{
  assets: [
    { id, title, thumbnail, brand, category },
    ...
  ],
  total: 18,
  count: 12
}
```

### 4. LLM Enhancement

The LLM generates a natural language response:

```
"I found 18 Sprite images. Here are the top 12 results..."
```

### 5. Display

The UI renders:
- Text message
- Asset cards in a grid
- Suggested follow-up prompts

## Configuration

### System Prompt

The assistant's behavior is controlled by a system prompt in `cloudflare/src/agent/chat-handler.js`:

```javascript
const SYSTEM_PROMPT = `You are a helpful assistant for KO Assets...`;
```

Customize this to change how the assistant responds.

### Intent Patterns

Add custom intent detection in `detectIntentAndGenerateToolCalls()`:

```javascript
if (lower.includes('campaign')) {
  // Custom logic for campaign searches
}
```

### Supported Brands

Currently recognizes: Coca-Cola, Sprite, Fanta, Powerade, Dasani, smartwater, vitaminwater

Add more in `detectIntentAndGenerateToolCalls()` brands array.

## Best Practices

### For Users

✅ **Be specific**: "Sprite social media images" vs "Sprite stuff"
✅ **Use brand names**: "Coca-Cola" not "Coke" (though both work)
✅ **Ask follow-ups**: The assistant remembers context
✅ **Try suggested prompts**: They're tailored to your conversation

❌ **Don't be too vague**: "Show me things" won't work well
❌ **Don't use jargon**: Unless the assistant knows the term

### For Developers

✅ **Monitor LLM costs**: Workers AI has free tier limits
✅ **Optimize MCP calls**: Batch when possible
✅ **Test edge cases**: Empty results, errors, etc.
✅ **Log important events**: For debugging and analytics

❌ **Don't store sensitive data**: In KV or logs
❌ **Don't skip error handling**: Users need clear feedback

## Performance

### Typical Response Times

- Simple search: 1-2 seconds
- With rights check: 2-4 seconds
- Complex multi-tool: 3-6 seconds

### Bottlenecks

1. **LLM inference**: ~500ms-1s
2. **MCP server latency**: ~300ms-800ms
3. **Asset metadata fetch**: ~200ms-500ms

### Optimization Tips

- Use smaller LLM models for faster responses
- Cache frequent queries in KV
- Limit conversation history sent to LLM
- Batch multiple tool calls

## Troubleshooting

### Common Issues

**"Failed to process chat request"**
- Check Cloudflare Worker logs
- Verify MCP server is running
- Ensure session cookie is valid

**Assets not displaying**
- Check CORS configuration
- Verify thumbnail URLs
- Check browser console for errors

**No response to queries**
- Check intent detection patterns
- Verify MCP tools are accessible
- Check Workers AI binding

See [SETUP.md](blocks/ko-chat-assistant/SETUP.md) for detailed troubleshooting.

## Security

- ✅ All inputs are sanitized (XSS prevention)
- ✅ Session cookies are HTTP-only
- ✅ CORS properly configured
- ✅ Rate limiting recommended (not yet implemented)
- ✅ No sensitive data in logs

## Costs

### Cloudflare Workers

- **Workers**: $5/month (10M requests)
- **Workers AI**: Free (10K requests/day), then $0.01/1K
- **KV Storage**: Free (1GB), then $0.50/GB
- **KV Reads**: $0.50/10M reads

### Estimated Monthly Cost

For 1,000 daily users:
- ~30K chat requests/month
- ~3K AI inferences/month
- ~100K KV operations/month

**Total: ~$5-10/month** (mostly Workers base fee)

## Roadmap

### Q4 2024 (Phase 3)

- [ ] WebSocket streaming responses
- [ ] Advanced tool orchestration
- [ ] Analytics dashboard
- [ ] Voice interface (experimental)

### Q1 2025

- [ ] Multi-language support
- [ ] Saved conversations
- [ ] Team sharing
- [ ] Custom workflows

### Q2 2025

- [ ] Integration with creative tools
- [ ] Bulk operations
- [ ] Advanced filtering
- [ ] AI-powered recommendations

## Contributing

To contribute improvements:

1. Test changes locally
2. Update documentation
3. Add unit tests (TBD)
4. Submit for review

## Support

For help:
- Check [README.md](blocks/ko-chat-assistant/README.md)
- Check [SETUP.md](blocks/ko-chat-assistant/SETUP.md)
- Review Cloudflare Worker logs
- Contact KO Assets development team

## License

Apache-2.0

---

**Built with ❤️ for The Coca-Cola Company**



