# MCP Server Deployment Guide

The MCP server needs to be deployed separately from the main worker for WebLLM mode to work.

---

## 🎯 **Why Deploy MCP Server Separately?**

**In WebLLM mode:**
- Browser runs AI locally
- Browser needs to call MCP server directly
- MCP server must be accessible at a public URL
- Can't be part of main worker (CORS, routing)

**In Server mode:**
- Main worker calls MCP internally
- No public URL needed
- But we still deploy separately for consistency

---

## 📋 **Prerequisites**

- [ ] Cloudflare account
- [ ] Wrangler CLI installed and authenticated
- [ ] KO Assets main worker already deployed

---

## 🚀 **Deploy MCP Server (5 minutes)**

### **Step 1: Navigate to MCP Server**

```bash
cd /Users/pkoch/Documents/GitHub/koassets/mcp-server
```

### **Step 2: Install Dependencies**

```bash
npm install
```

### **Step 3: Deploy to Staging**

```bash
npm run deploy:staging
```

**Expected output:**
```
✨ Built successfully!
⛅️ Deploying to Cloudflare Workers...
✅ Deployed koassets-mcp-server-staging
   https://koassets-mcp-server-staging.workers.dev
```

**Note the URL!** You'll need it for testing.

### **Step 4: Test Deployment**

```bash
# Health check
curl https://koassets-mcp-server-staging.workers.dev/health

# Expected: {"status":"ok","service":"koassets-mcp-server"}
```

### **Step 5: Test MCP Endpoint**

```bash
curl -X POST https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
  }'
```

**Expected:** JSON response with list of available tools

---

## ✅ **Verify Deployment**

### **Test 1: Health Check**

```bash
curl https://koassets-mcp-server-staging.workers.dev/health
```

✅ **Should return:** `{"status":"ok","service":"koassets-mcp-server"}`

### **Test 2: CORS Preflight**

```bash
curl -X OPTIONS https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

✅ **Should return:** 
- Status: 204 No Content
- Headers include: `Access-Control-Allow-Origin: *`
- Headers include: `Access-Control-Allow-Credentials: true`

### **Test 3: Actual MCP Request**

```bash
curl -X POST https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    },
    "id": 1
  }'
```

✅ **Should return:** JSON-RPC success response with server capabilities

---

## 🔧 **Environment Configuration**

The MCP server automatically detects and uses the correct main worker URL:

### **Staging:**
```toml
KOASSETS_API_URL = "https://koassets-staging.adobeaem.workers.dev"
```

### **Production:**
```toml
KOASSETS_API_URL = "https://koassets.adobeaem.workers.dev"
```

These are already configured in `wrangler.toml` - no changes needed!

---

## 🌐 **URLs After Deployment**

### **Staging:**
- MCP Server: `https://koassets-mcp-server-staging.workers.dev`
- Health: `https://koassets-mcp-server-staging.workers.dev/health`
- MCP Endpoint: `https://koassets-mcp-server-staging.workers.dev/mcp`

### **Production (when ready):**
- MCP Server: `https://koassets-mcp-server.workers.dev`
- Health: `https://koassets-mcp-server.workers.dev/health`
- MCP Endpoint: `https://koassets-mcp-server.workers.dev/mcp`

---

## 🔄 **How WebLLM Finds MCP Server**

The `MCPClient` in `ko-chat-assistant-llm.js` auto-detects the MCP URL:

**Local development:**
```javascript
hostname = 'localhost' → Use '/mcp' (part of main worker)
```

**Staging:**
```javascript
hostname contains 'staging' or 'aem.page' 
  → Use 'https://koassets-mcp-server-staging.workers.dev/mcp'
```

**Production:**
```javascript
hostname is production 
  → Use 'https://koassets-mcp-server.workers.dev/mcp'
```

**No configuration needed!** It just works.

---

## 🐛 **Troubleshooting**

### **Issue: Deployment fails**

**Check:**
```bash
# Verify you're authenticated
wrangler whoami

# Verify wrangler.toml is correct
cat wrangler.toml
```

**Solution:** Ensure you're in the `mcp-server/` directory and have proper Cloudflare permissions.

---

### **Issue: Health check returns 404**

**Cause:** Worker not deployed or URL wrong

**Solution:**
```bash
# List deployments
wrangler deployments list

# Check the actual URL in output
```

---

### **Issue: MCP endpoint returns errors**

**Check logs:**
```bash
wrangler tail --env staging
```

**Then make a request in another terminal and watch the logs.**

---

### **Issue: CORS errors from browser**

**Test CORS directly:**
```bash
curl -X OPTIONS https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Origin: http://localhost:3000" \
  -v
```

**Should see:** `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Credentials: true`

**If not:** CORS headers not applied. Check `src/utils/cors.js` was updated.

---

### **Issue: Authentication fails**

**Cause:** MCP server can't validate session cookie

**Check:**
1. Is main KO Assets worker deployed and working?
2. Is `KOASSETS_API_URL` set correctly?
3. Are cookies being sent from browser?

**Test with session cookie:**
```bash
curl -X POST https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_assets",
      "arguments": {"query": "Sprite", "hitsPerPage": 5}
    },
    "id": 1
  }'
```

---

## 📊 **Deployment Checklist**

Before testing WebLLM mode:

- [ ] MCP server deployed to staging
- [ ] Health endpoint responds
- [ ] CORS headers include `Access-Control-Allow-Credentials: true`
- [ ] MCP endpoint responds to tool calls
- [ ] Authentication works (test with session cookie)
- [ ] Logs show no errors (`wrangler tail`)

---

## 🔐 **Security Notes**

### **CORS Configuration:**

Current config uses `Access-Control-Allow-Origin: *` which is OK for:
- ✅ Development and testing
- ✅ Staging environments
- ⚠️ Production (consider restricting)

**For production, consider restricting origins:**

```javascript
// mcp-server/src/utils/cors.js
export function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'https://main--koassets--aemsites.aem.live',
    'https://koassets.adobeaem.workers.dev',
    // Add your domains
  ];

  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}
```

**For now, wildcard is fine for testing.**

---

## 🚀 **Production Deployment**

When ready for production:

```bash
cd mcp-server
npm run deploy:production
```

**Test production:**
```bash
curl https://koassets-mcp-server.workers.dev/health
```

---

## 📝 **Post-Deployment**

After deploying MCP server:

1. ✅ **Test staging MCP endpoint works**
2. ✅ **Test from browser (open DevTools console):**
   ```javascript
   fetch('https://koassets-mcp-server-staging.workers.dev/health')
     .then(r => r.json())
     .then(console.log)
   ```
3. ✅ **Test WebLLM mode** (follow WEBLLM_QUICKSTART.md)
4. ✅ **Monitor logs** for any errors

---

## 🎯 **Now You Can Test WebLLM!**

With MCP server deployed:

1. **Set WebLLM mode:** `USE_WEBLLM_MODE = true`
2. **Start main worker:** `npm run dev` (in root)
3. **Open browser:** `http://localhost:8787`
4. **WebLLM will call:** Deployed MCP server at staging URL
5. **Everything should work!**

---

## 📞 **Quick Reference**

**Deploy staging:**
```bash
cd mcp-server && npm run deploy:staging
```

**Test health:**
```bash
curl https://koassets-mcp-server-staging.workers.dev/health
```

**View logs:**
```bash
cd mcp-server && wrangler tail --env staging
```

**Deploy production:**
```bash
cd mcp-server && npm run deploy:production
```

---

**That's it! MCP server should now be deployed and ready.** 🚀

Continue to `WEBLLM_QUICKSTART.md` for testing the full WebLLM mode!

