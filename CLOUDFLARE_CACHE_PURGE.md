# Cloudflare Cache Purge Required

## The Problem

The WASM file and model weight files are cached as Git LFS pointers (130-133 bytes) instead of the actual binary files (3.7 GB total).

Cache-busting via `?v=20251019` only works for URLs we control, but WebLLM constructs internal URLs for model weights that we can't easily modify.

## Solution: Purge Cloudflare Cache

### Option 1: Purge Specific Path (Recommended)
1. Go to: https://dash.cloudflare.com/
2. Select your domain: **mcp-server-koassets.adobeaem.workers.dev**
3. Navigate to: **Caching** → **Configuration**
4. Find: **Purge Cache** section
5. Select: **Custom Purge**
6. Enter URL pattern:
   ```
   https://mcp-server-koassets.adobeaem.workers.dev/models/*
   ```
7. Click **Purge**

### Option 2: Purge Everything (Nuclear Option)
1. Same steps 1-4 as above
2. Click: **Purge Everything**
3. Confirm

**⚠️ Warning:** This will clear ALL cached files, affecting all users temporarily.

---

## Alternative: Add Cache-Control Headers

If cache purging doesn't work, we can add headers to prevent caching of model files.

### Update Cloudflare Worker

Add this to `cloudflare/src/index.js`:

```javascript
// Prevent caching for model files (they're large and we need fresh versions)
router.get('/models/*', (request, env) => {
  const response = originHelix(request, env);
  
  // Add no-cache headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  newResponse.headers.set('Pragma', 'no-cache');
  newResponse.headers.set('Expires', '0');
  
  return newResponse;
});
```

---

## Check Deployment Status

Before purging cache, verify the deployment has completed:

```bash
# Check if production is serving the real WASM file
curl -I "https://mcp-server-koassets.adobeaem.workers.dev/models/Hermes-2-Pro-Mistral-7B-q4f16_1-MLC/Hermes-2-Pro-Mistral-7B-q4f16_1-sw4k_cs1k-webgpu.wasm" | grep content-length

# Should show: content-length: 3888798
# If still 130, deployment hasn't completed
```

---

## Timeline

1. **Wait 2-5 min** for Cloudflare Pages deployment to complete
2. **Purge cache** using Option 1 above
3. **Hard refresh** browser: `Cmd+Shift+R`
4. **Test again** - should now load successfully

---

## Why This Happened

1. Git LFS pointers were initially deployed
2. Cloudflare CDN cached them (with 7200s TTL based on headers you shared)
3. Even after pushing real binaries, CDN serves cached pointers
4. Cache-busting on WASM works, but not on model weight `.bin` files
5. Need explicit cache purge or no-cache headers

