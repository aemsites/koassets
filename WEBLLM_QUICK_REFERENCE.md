# WebLLM Quick Reference Card

## 🎯 One-Page Guide

### Switch Modes

```javascript
// blocks/ko-chat-assistant/ko-chat-assistant-llm.js line 18
const USE_WEBLLM_MODE = true;  // WebLLM mode
const USE_WEBLLM_MODE = false; // Server mode (default)
```

### Start Testing

```bash
npm run dev
open http://localhost:8787
```

### Files Created

1. `blocks/ko-chat-assistant/ko-chat-assistant-llm.js` (730 lines) - Core abstraction
2. `MCP_CORS_SETUP.md` - CORS configuration
3. `WEBLLM_QUICKSTART.md` - Testing guide

### Files Modified

1. `blocks/ko-chat-assistant/ko-chat-assistant.js` (+200 lines)
2. `blocks/ko-chat-assistant/ko-chat-assistant.css` (+220 lines)

### MCP CORS Quick Setup

```javascript
// mcp-server/src/index.js
if (request.method === 'OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('Origin'),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    }
  });
}
```

### Test Checklist

- [ ] WebLLM mode: Model downloads
- [ ] Progress bar updates
- [ ] Can send queries
- [ ] Assets display
- [ ] Server mode still works
- [ ] No console errors

### Performance

**WebLLM first visit:** 3-6 min (download)  
**WebLLM cached:** 5-12 sec  
**Server mode:** 2-4 sec  

### Troubleshooting

**CORS error?** → See `MCP_CORS_SETUP.md`  
**Model fails?** → Check `chrome://gpu` for WebGPU  
**Out of memory?** → Need 4GB+ RAM, close tabs  

### Documentation

- **Testing:** `WEBLLM_QUICKSTART.md`
- **CORS:** `MCP_CORS_SETUP.md`  
- **Complete:** `WEBLLM_IMPLEMENTATION_COMPLETE.md`

### Success = All Tests Pass!

🎉 **Ready to test!**

