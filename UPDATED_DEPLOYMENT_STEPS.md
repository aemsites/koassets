# 🚀 Complete Deployment Steps for WebLLM Mode

Updated guide including MCP server deployment.

---

## 📋 **Complete Checklist**

### **Phase 0: MCP Server Deployment** ⭐ **START HERE!**

- [ ] Navigate to `mcp-server/` directory
- [ ] Run `npm install`
- [ ] Deploy: `npm run deploy:staging`
- [ ] Verify: `curl https://koassets-mcp-server-staging.workers.dev/health`
- [ ] Should return: `{"status":"ok","service":"koassets-mcp-server"}`

**📖 Full guide:** `MCP_DEPLOYMENT_GUIDE.md`

---

### **Phase 1: Configure WebLLM Mode**

- [ ] Open `blocks/ko-chat-assistant/ko-chat-assistant-llm.js`
- [ ] Set `const USE_WEBLLM_MODE = true;`
- [ ] Save file

---

### **Phase 2: Test Locally**

- [ ] Run `npm run dev` (from root directory)
- [ ] Open `http://localhost:8787`
- [ ] See WebLLM loading overlay
- [ ] Wait for model download (3-5 min first time)
- [ ] Test query: "Find Sprite images"
- [ ] Verify assets display

**📖 Full guide:** `WEBLLM_QUICKSTART.md`

---

### **Phase 3: Test Server Mode**

- [ ] Set `const USE_WEBLLM_MODE = false;`
- [ ] Refresh browser
- [ ] Test same query
- [ ] Verify everything still works (no regression!)

---

## ⚡ **Quick Command Reference**

```bash
# 1. Deploy MCP Server
cd mcp-server
npm install
npm run deploy:staging
curl https://koassets-mcp-server-staging.workers.dev/health

# 2. Start Local Dev
cd ..
npm run dev

# 3. Test in Browser
open http://localhost:8787
```

---

## 🎯 **What Gets Deployed Where**

### **MCP Server (Separate Worker):**
- **URL:** `https://koassets-mcp-server-staging.workers.dev`
- **Purpose:** Provides MCP tools for browser-based AI
- **Called by:** Browser in WebLLM mode, Main worker in Server mode

### **Main KO Assets Worker:**
- **URL:** `https://koassets-staging.adobeaem.workers.dev`
- **Purpose:** Main application, authentication, routing
- **Includes:** Server-mode chat endpoint `/api/chat`

### **Browser (WebLLM Mode):**
- **Loads:** TinyLlama AI model (~200MB)
- **Calls:** MCP server directly (no main worker for AI)
- **Stores:** Model cache in IndexedDB

---

## 🔄 **Request Flow by Mode**

### **WebLLM Mode:**
```
Browser (Local AI)
    ↓
Detects hostname → staging
    ↓
Calls: https://koassets-mcp-server-staging.workers.dev/mcp
    ↓
MCP Server → KO Assets API
    ↓
Results back to browser
```

### **Server Mode:**
```
Browser
    ↓
POST /api/chat → Main Worker
    ↓
Main Worker (Cloudflare AI) → MCP Server (internal)
    ↓
MCP Server → KO Assets API
    ↓
Results back to browser
```

---

## ⚠️ **Common Mistakes**

### **Mistake 1: Testing before MCP deployed**

**Symptom:** Browser errors: "Failed to fetch" or "Network error"

**Fix:** Deploy MCP server first!
```bash
cd mcp-server && npm run deploy:staging
```

---

### **Mistake 2: Wrong MCP URL**

**Symptom:** 404 errors when browser calls MCP

**Fix:** MCPClient auto-detects URL. Check it's deployed:
```bash
curl https://koassets-mcp-server-staging.workers.dev/health
```

---

### **Mistake 3: CORS not configured**

**Symptom:** "CORS policy blocked"

**Fix:** Already fixed! CORS headers updated in `mcp-server/src/utils/cors.js`

Verify:
```bash
curl -X OPTIONS https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Origin: http://localhost:3000" \
  -v | grep Credentials
```

Should see: `Access-Control-Allow-Credentials: true`

---

### **Mistake 4: Using `/mcp` instead of full URL**

**Symptom:** WebLLM mode tries to call `/mcp` on main worker

**Fix:** MCPClient auto-detects based on hostname. Make sure you're accessing via `localhost:8787` for local dev.

---

## 🧪 **Testing Checklist**

### **MCP Server Tests:**

- [ ] Health check: `curl .../health` → `{"status":"ok"}`
- [ ] CORS preflight: Returns Access-Control headers
- [ ] MCP tools/list: Returns list of tools
- [ ] With auth cookie: Can call search_assets

### **WebLLM Mode Tests:**

- [ ] Model downloads with progress
- [ ] Model loads from cache (subsequent visits)
- [ ] Can send queries
- [ ] MCP calls show in Network tab
- [ ] Assets display correctly
- [ ] No CORS errors

### **Server Mode Tests:**

- [ ] Still works (no regression)
- [ ] Calls `/api/chat` endpoint
- [ ] Assets display correctly
- [ ] Same behavior as before

---

## 📊 **Deployment Status Tracker**

| Component | Status | URL | Test Command |
|-----------|--------|-----|--------------|
| MCP Server (Staging) | ⬜ Not deployed | `https://koassets-mcp-server-staging.workers.dev` | `curl .../health` |
| Main Worker (Staging) | ✅ Already deployed? | `https://koassets-staging.adobeaem.workers.dev` | Visit in browser |
| WebLLM Mode | ⬜ Not tested | Local: `http://localhost:8787` | Follow quickstart |
| Server Mode | ⬜ Not tested | Local: `http://localhost:8787` | Set mode to false |

---

## 🎯 **Success Criteria**

You'll know everything is working when:

✅ **MCP Server:**
- Health endpoint responds
- CORS headers present
- Tools list returns data
- No errors in logs

✅ **WebLLM Mode:**
- Model downloads successfully
- Progress bar updates
- Can send queries
- Assets display
- Browser calls deployed MCP server

✅ **Server Mode:**
- Everything works as before
- No regression
- Can switch between modes

---

## 📞 **Help & Resources**

**MCP Deployment Issues:**
→ See `MCP_DEPLOYMENT_GUIDE.md`

**CORS Issues:**
→ See `MCP_CORS_SETUP.md` (though should be already fixed)

**WebLLM Testing:**
→ See `WEBLLM_QUICKSTART.md`

**Complete Overview:**
→ See `WEBLLM_IMPLEMENTATION_COMPLETE.md`

---

## 🚀 **Ready to Start?**

```bash
# Step 1: Deploy MCP Server (5 minutes)
cd mcp-server
npm install
npm run deploy:staging

# Step 2: Verify deployment
curl https://koassets-mcp-server-staging.workers.dev/health

# Step 3: Start testing
cd ..
npm run dev
open http://localhost:8787

# Step 4: Follow WEBLLM_QUICKSTART.md
```

---

## ⏱️ **Timeline**

- **MCP Deployment:** 5 minutes
- **First WebLLM test:** 5 minutes + model download (3-5 min)
- **Server mode test:** 2 minutes
- **Total:** ~15-20 minutes to complete testing

---

**Let's deploy the MCP server first, then test everything!** 🚀

