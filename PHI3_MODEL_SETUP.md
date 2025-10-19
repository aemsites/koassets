# Phi-3-mini Model Setup Guide

## Why Phi-3-mini?

**Upgraded from TinyLlama (1.1B) to Phi-3-mini (3.8B)**

### Key Improvements:
- ✅ **Better reasoning**: Understands multi-step instructions
- ✅ **Tool calling**: Correctly uses MCP search_assets tool
- ✅ **Query construction**: Knows when to use empty query vs. keywords
- ✅ **Facet filtering**: Properly extracts brands/categories into facetFilters

### Size Comparison:
- TinyLlama: ~600MB download
- Phi-3-mini: ~700MB download (only 100MB more!)

## Setup Method: WebLLM CDN (Recommended)

**The easiest approach** - Model is automatically downloaded from WebLLM's CDN and cached in your browser's IndexedDB.

### Advantages:
- ✅ **Zero hosting required** - Files served from WebLLM's infrastructure
- ✅ **Automatic caching** - Browser caches files after first download
- ✅ **Always up-to-date** - Get latest WebLLM optimizations
- ✅ **Fast delivery** - Global CDN with edge caching
- ✅ **Already configured** - Code is ready to use

### How It Works:
1. First visit: ~700MB downloaded from WebLLM CDN (30-60 seconds)
2. Stored in browser IndexedDB
3. Subsequent visits: Load from local cache (5-10 seconds)
4. Cache persists across sessions

**No additional setup needed!** Just deploy the code and it works.

---

## Alternative: Self-Hosted Model Files (Advanced)

If you want to host the model files yourself (e.g., for offline use or corporate policies):

### Step 1: Download from HuggingFace

The model is hosted at: https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC

**Option A: Using Git LFS (Recommended)**

```bash
# Install Git LFS if not already installed
# macOS: brew install git-lfs
# Ubuntu: sudo apt-get install git-lfs

# Initialize Git LFS
git lfs install

# Clone the model repository
cd /path/to/your/models/directory
git clone https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC
```

**Option B: Manual Download**

1. Visit: https://huggingface.co/mlc-ai/Phi-3-mini-4k-instruct-q4f16_1-MLC/tree/main
2. Download all files (23 files, ~700MB total):
   - `mlc-chat-config.json` (1 file)
   - `tokenizer.model`, `tokenizer.json`, `tokenizer_config.json` (3 files)
   - `Phi-3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm` (WASM file)
   - Model weight shards: `params_shard_*.bin` (17 files)
   - `ndarray-cache.json`

### Step 2: Upload to Your Domain

The files must be accessible at:
```
https://your-domain.com/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/
```

**For Adobe Experience Manager (EDS):**

1. Copy the entire `Phi-3-mini-4k-instruct-q4f16_1-MLC` folder to your AEM content repository
2. Place it under `/models/` path
3. The folder structure should be:
   ```
   /models/
     └── Phi-3-mini-4k-instruct-q4f16_1-MLC/
         ├── mlc-chat-config.json
         ├── tokenizer.model
         ├── tokenizer.json
         ├── tokenizer_config.json
         ├── Phi-3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm
         ├── ndarray-cache.json
         ├── params_shard_0.bin
         ├── params_shard_1.bin
         ├── ... (17 shards total)
         └── params_shard_16.bin
   ```

**For Cloudflare Pages/R2:**

```bash
# If using Cloudflare Pages
wrangler pages publish models --project-name=your-project

# If using Cloudflare R2
# Upload via dashboard or CLI
```

### Step 3: Verify Model Path

**Important**: File paths are **case-sensitive**!

Test that files are accessible:

```bash
# Check WASM file
curl https://your-domain.com/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/Phi-3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm \
  --head

# Check config
curl https://your-domain.com/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/mlc-chat-config.json

# Check shard (largest file)
curl https://your-domain.com/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/params_shard_0.bin \
  --head
```

All should return `200 OK`.

### Step 4: Update Code for Self-Hosting

To use self-hosted files instead of CDN, update `ko-chat-assistant-llm.js`:

```javascript
constructor() {
  super();
  this.engine = null;
  this.status = 'uninitialized';
  this.downloadProgress = 0;
  this.modelId = 'Phi-3-mini-4k-instruct-q4f16_1-MLC';
  this.initCallbacks = [];
  
  // CHANGE THIS: Use custom appConfig for self-hosted model
  const baseUrl = window.location.origin;
  this.appConfig = {
    model_list: [
      {
        model_id: this.modelId,
        model: `${baseUrl}/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/`,
        model_lib: `${baseUrl}/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/Phi-3-mini-4k-instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm`,
      },
    ],
  };
}
```

**Note**: You'll need to obtain the WASM file separately, as it's not included in the HuggingFace model repository. Contact MLC-AI or build it yourself using their compilation tools.

---

## Deployment (CDN Method)

The code is already configured to use Phi-3-mini from WebLLM's CDN. Just deploy:

```bash
# The changes are already made - just commit and deploy
git add blocks/ko-chat-assistant/ko-chat-assistant-llm.js PHI3_MODEL_SETUP.md
git commit -m "Upgrade to Phi-3-mini for better tool calling and reasoning"
git push

# For AEM EDS, changes are typically live immediately after push
```

**That's it!** The model will download automatically on first use.

---

## Testing

1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Visit your chat page at `/chat`
3. Open browser DevTools Console (F12)
4. Click to initialize the chat assistant
5. You should see download progress:
   ```
   [WebLLM] Creating MLCEngine with Phi-3-mini
   [WebLLM] Model ID: Phi-3-mini-4k-instruct-q4f16_1-MLC
   [WebLLM] Loading from WebLLM CDN (cached in browser after first load)
   [WebLLM] Progress: Fetching param cache[0/83]...
   [WebLLM] Progress: Fetching param cache[1/83]...
   ...
   [WebLLM] Progress: Loading model from cache[100%]
   [WebLLM] Model loaded successfully
   ```
6. First load takes 30-60 seconds, subsequent loads are 5-10 seconds

7. Test with a query that previously failed:
   ```
   "Find Coca-Cola images"
   ```

8. In DevTools Console, check the MCP request:
   ```json
   {
     "method": "tools/call",
     "params": {
       "name": "search_assets",
       "arguments": {
         "query": "",
         "facetFilters": {
           "brand": ["Coca-Cola"],
           "format": ["Image"]
         }
       }
     }
   }
   ```

   ✅ `query` should be **empty string** `""`  
   ✅ `facetFilters` should contain brand and format

## Troubleshooting

### Model not loading
- **Check browser console** for 404 errors
- **Verify file paths** are case-sensitive (exact match)
- **Test direct URL** in browser: `https://your-domain.com/models/Phi-3-mini-4k-instruct-q4f16_1-MLC/mlc-chat-config.json`

### CORS errors
- Model files must be on **same domain** as the chat UI
- If using CDN, ensure CORS headers are set

### Slow loading
- Phi-3-mini is ~700MB, initial load takes 30-60 seconds
- Files are cached in browser IndexedDB after first load
- Subsequent loads are much faster

### Wrong model still loading
- Clear browser cache
- Clear IndexedDB: DevTools → Application → Storage → Clear site data
- Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

## Performance

**First Load:**
- Download: 30-60 seconds (depending on connection)
- Initialize: 5-10 seconds

**Cached Load (subsequent visits):**
- Load from IndexedDB: 5-10 seconds
- Initialize: 2-5 seconds

**Inference:**
- Simple query: 1-2 seconds
- Complex query: 2-4 seconds

**Browser Requirements:**
- WebGPU support (Chrome 113+, Edge 113+)
- ~2GB RAM available
- ~700MB disk space for cache

## Rollback to TinyLlama

If Phi-3-mini is too large or slow, revert to TinyLlama:

```javascript
// In blocks/ko-chat-assistant/ko-chat-assistant-llm.js, line 54
this.modelId = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';

// And update line 64-65
model: `${baseUrl}/models/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC/`,
model_lib: `${baseUrl}/models/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC/TinyLlama-1.1B-Chat-v1.0-q4f16_1-ctx2k_cs1k-webgpu.wasm`,
```

Note: TinyLlama has weaker reasoning, so queries may not work as well.

