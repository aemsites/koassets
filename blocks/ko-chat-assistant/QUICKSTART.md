# KO Chat Assistant - Quick Start

Get the chat assistant running in 10 minutes.

## Prerequisites

✅ Cloudflare account with Workers  
✅ Wrangler CLI installed and authenticated  
✅ KO Assets + MCP Server deployed  
✅ Valid session cookie for testing  

## 5-Step Deployment

### Step 1: Create KV Namespace (2 min)

```bash
cd cloudflare
wrangler kv:namespace create "CHAT_SESSIONS"
```

Copy the output ID and update `cloudflare/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CHAT_SESSIONS"
id = "YOUR_ID_HERE"  # ← Replace this
```

### Step 2: Configure MCP URL (1 min)

In `cloudflare/wrangler.toml`, set your MCP server URL:

```toml
MCP_SERVER_URL = "https://mcp.koassets.adobeaem.workers.dev/mcp"
```

Or for local development:
```toml
MCP_SERVER_URL = "http://localhost:8787/mcp"
```

### Step 3: Deploy Cloudflare Worker (2 min)

```bash
cd cloudflare
npm install
npm run deploy:staging
```

Wait for deployment to complete. Note the URL:
```
✨ Published koassets to koassets-staging.workers.dev
```

### Step 4: Add Block to Page (3 min)

In your AEM/DA content (https://da.live/#/aemsites/koassets):

1. Create or edit a page
2. Add this block:

```markdown
| KO Chat Assistant |
|-------------------|
|                   |
```

3. Save and publish

### Step 5: Test (2 min)

1. Open your page: `https://main--koassets--aemsites.aem.live/your-page`
2. You should see the chat interface
3. Try: "Find Coca-Cola images"
4. Verify assets are displayed

## ✅ Done!

Your chat assistant is now live.

---

## Quick Test Commands

### Test Chat API Directly

```bash
curl -X POST https://koassets-staging.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "message": "Find Sprite images",
    "sessionId": "test_123"
  }'
```

### Check KV Namespace

```bash
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

### View Live Logs

```bash
wrangler tail
```

---

## Troubleshooting

### Worker not responding

1. Check deployment: `wrangler deployments list`
2. Check logs: `wrangler tail`
3. Verify routes: Check `wrangler.toml`

### Block not showing

1. Check block name: Must be `ko-chat-assistant` (case-insensitive)
2. Clear cache: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
3. Check browser console for errors

### No MCP connection

1. Verify MCP_SERVER_URL is correct
2. Check MCP server is deployed and healthy
3. Test MCP directly: `curl https://YOUR_MCP_URL/health`

---

## Next Steps

✅ **Customize prompts**: Edit `ko-chat-assistant.js`  
✅ **Adjust styling**: Modify `ko-chat-assistant.css`  
✅ **Add analytics**: Track usage in chat-handler.js  
✅ **Monitor costs**: Check Cloudflare dashboard  

---

## Production Checklist

Before going to production:

- [ ] Update MCP_SERVER_URL to production endpoint
- [ ] Test with real user sessions
- [ ] Monitor performance for 1 week
- [ ] Set up alerts for errors
- [ ] Document custom configurations
- [ ] Train support team on common issues
- [ ] Create user guide for employees

---

## Configuration Quick Reference

### wrangler.toml

```toml
# Required
[[kv_namespaces]]
binding = "CHAT_SESSIONS"
id = "YOUR_KV_ID"

[ai]
binding = "AI"

[vars]
MCP_SERVER_URL = "https://mcp.koassets.adobeaem.workers.dev/mcp"
```

### EDS Block

```markdown
| KO Chat Assistant |
|-------------------|
|                   |
```

### Test Query

```
"Find Coca-Cola images"
```

---

## Support

**Documentation:**
- [Full Guide](CHAT_ASSISTANT.md)
- [Setup Details](SETUP.md)
- [Technical Docs](README.md)

**Issues:**
- Check Cloudflare Worker logs
- Review browser console
- Contact KO Assets dev team

---

**Time to deploy: ~10 minutes**  
**Difficulty: Easy** 🟢



