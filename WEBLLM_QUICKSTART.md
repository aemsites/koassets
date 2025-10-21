# WebLLM Chat Assistant - Quick Start Guide

🎉 **WebLLM-Only Mode!** Here's how to test your privacy-first, browser-based chat assistant.

---

## 📋 **Prerequisites**

Before testing, you need the MCP server deployed:

```bash
cd mcp-server
npm run deploy:staging
```

**Full instructions:** See `MCP_DEPLOYMENT_GUIDE.md`

**Quick verification:**
```bash
curl https://koassets-mcp-server-staging.workers.dev/health
# Should return: {"status":"ok","service":"koassets-mcp-server"}
```

✅ **MCP server deployed?** Continue below!

---

## 🚀 Quick Test (5 Minutes)

### Step 1: Verify MCP CORS

MCP CORS is already configured! ✅

**Test it:**
```bash
curl -X OPTIONS https://koassets-mcp-server-staging.workers.dev/mcp \
  -H "Origin: http://localhost:3000" \
  -v | grep "Access-Control"
```

**Should see:** `Access-Control-Allow-Credentials: true`

---

### Step 3: Start Development Server

```bash
cd /Users/pkoch/Documents/GitHub/koassets
npm run dev
```

This starts:
- Cloudflare Worker at `http://localhost:8787`
- AEM/Helix at `http://localhost:3000`
- MCP server (part of worker)

---

### Step 4: Open Chat Page

Navigate to page with the chat block:
```
http://localhost:8787/your-chat-page
```

Or create a test page in DA with:
```markdown
| KO Chat Assistant |
|-------------------|
|                   |
```

---

### Step 5: Watch the Magic! ✨

**First time:**
1. Page loads
2. You see: "Downloading AI model..." with progress bar
3. Progress updates (0% → 100%)
4. Takes 2-5 minutes
5. Model loads: "Loading model into memory..."
6. Chat becomes ready!

**Subsequent visits:**
1. Page loads
2. "Loading model..." (5-10 seconds from cache)
3. Chat ready!

---

## 🎯 What to Test

### Test 1: Mode Indicator

**Expected:** See "🔧 Dev Mode (Local AI)" badge in header

**If not visible:** WebLLM mode not activated

---

### Test 2: Model Download

**Expected:** 
- Beautiful loading overlay
- Progress bar animating
- Percentage updating
- Takes ~3 minutes

**If it fails:**
- Check browser console for errors
- Check WebGPU support: `chrome://gpu`
- Try different browser (Chrome/Edge 113+)

---

### Test 3: Send a Query

Type: **"Find Sprite images"**

**Expected:**
1. Typing indicator appears
2. WebLLM processes locally (~2 seconds)
3. Browser calls MCP directly
4. Asset cards appear
5. Suggested prompts shown

**Check Network tab:**
- Should see POST to `/mcp` (not `/api/chat`)
- Should be direct from browser

---

### Test 4: Conversation Context

Type: **"Show me videos instead"**

**Expected:**
- Remembers previous query
- Searches for Sprite videos
- Maintains conversation flow

---

## 🐛 Troubleshooting

### Problem: "Failed to load WebLLM library"

**Solution:**
```bash
# Check if file exists
ls blocks/ko-chat-assistant/ko-chat-assistant-llm.js

# If missing, check file was created
# Should be 730+ lines
```

---

### Problem: Model download fails

**Possible causes:**

1. **No WebGPU support**
   - Check: `chrome://gpu`
   - Look for: "WebGPU: Hardware accelerated"
   - Fix: Update browser to Chrome 113+ or Edge 113+

2. **Network timeout**
   - Model is 200MB
   - Needs stable connection
   - Try on better wifi

3. **Insufficient memory**
   - Need ~4GB free RAM
   - Close other tabs/apps

---

### Problem: CORS errors calling MCP

**Error in console:** `blocked by CORS policy`

**Fix:** See `MCP_CORS_SETUP.md` - Step 2 not done correctly

**Quick test:**
```bash
curl -X POST http://localhost:8787/mcp \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Should work without CORS error.

---

### Problem: Model loads but inference fails

**Check browser console for:**
- GPU errors
- Out of memory
- WebGPU context lost

**Try:**
- Close other GPU-heavy tabs
- Restart browser
- Use smaller model (already using TinyLlama - smallest!)

---

### Problem: "Model not ready" errors

**Cause:** Trying to chat before initialization completes

**Expected behavior:** Input should be disabled during init

**If not:** Check `isInitializing` flag logic

---

## 📊 Performance Expectations

### First Visit (WebLLM Mode):
- Model download: 2-5 minutes (200MB)
- Model loading: 30-60 seconds
- First query: 1-2 seconds
- **Total time to chat: 3-6 minutes**

### Return Visits (WebLLM Mode):
- Model from cache: 5-10 seconds
- First query: 1-2 seconds
- **Total time to chat: 5-12 seconds**

### Note:
WebLLM runs entirely in your browser for privacy and offline capability.

---

## 🎨 UI Features to Verify

### Loading States:
- [x] Overlay with spinning icon
- [x] Progress bar (0% → 100%)
- [x] Status messages update
- [x] Input disabled during load
- [x] Smooth fade out when ready

### Error States:
- [x] Clear error messages
- [x] Helpful guidance
- [x] Retry button

### Initialization UI:
- [x] Shows loading overlay during model download
- [x] Displays progress bar with percentage
- [x] Smooth animations

---

## 🔄 Return Visits

After the first initialization:

1. **Subsequent Loads:**
   - Refresh the page
   - Model loads from IndexedDB cache
   - Much faster (5-10 seconds vs 20-30 seconds)
   - No re-download needed

2. **Clear Cache (For Testing):**
   - Open DevTools → Application → IndexedDB
   - Delete the WebLLM databases
   - Refresh to trigger fresh download

---

## ✅ Success Checklist

Phase 1 is successful if:

- [ ] WebLLM mode downloads and loads model
- [ ] Progress bar updates during download
- [ ] Model loads from cache on subsequent visits
- [ ] Can send queries and get responses
- [ ] MCP server responds to browser calls
- [ ] Asset cards display correctly
- [ ] Initialization UI is polished
- [ ] No console errors
- [ ] Mode indicator shows/hides correctly

---

## 🎯 What's Working

You now have:

✅ Privacy-first WebLLM architecture
✅ Browser-based AI (offline capable)
✅ WebLLM model downloading and caching  
✅ Polished loading UI with progress
✅ Browser → MCP direct calls
✅ Intent detection in browser
✅ Asset search working
✅ Graceful error handling

---

## 📝 Known Limitations (Phase 1)

These are expected:

- **Model quality:** TinyLlama is basic (good for dev/test)
- **Rights checking:** Not fully implemented in WebLLM path
- **Mobile:** Won't work (WebGPU not supported)
- **Old browsers:** Won't work (need Chrome 113+)
- **Complex queries:** May not understand (small model)

**These are fine for Phase 1!** Proves the concept works.

---

## 🚀 Next Steps

If Phase 1 works:

1. **Test with team** - Get feedback
2. **Document issues** - What breaks, what's confusing?
3. **Decide on Phase 2:**
   - Better model? (Phi-3 for quality)
   - URL parameter switching?
   - More polish?
   - Production-ready?

If Phase 1 doesn't work:

1. **Debug together** - Check console, network tab
2. **Iterate** - Fix issues found
3. **Test again**

---

## 💡 Pro Tips

**Tip 1: Clear Cache**
If model seems corrupted:
```javascript
// Browser console:
indexedDB.deleteDatabase('mlc-chat-store');
location.reload();
```

**Tip 2: Monitor Memory**
```javascript
// Browser console:
console.log(performance.memory);
```

**Tip 3: Force Re-download**
Delete cache, then reload:
```javascript
indexedDB.deleteDatabase('mlc-chat-store');
```

**Tip 4: Check WebGPU**
```
chrome://gpu
```
Look for: "WebGPU: Hardware accelerated"

**Tip 5: Test in Incognito**
No cache, fresh experience like first-time user

---

## 📞 Ready to Test?

**Start here:**
1. Set `USE_WEBLLM_MODE = true`
2. Run `npm run dev`
3. Open `http://localhost:8787`
4. Watch the magic happen! ✨

**Questions? Issues?**
Check browser console first - most errors are obvious there!

Good luck! 🚀

