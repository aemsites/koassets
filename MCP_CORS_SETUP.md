# MCP Server CORS Configuration for WebLLM Mode

When using WebLLM mode, the browser needs to call the MCP server directly (instead of through the Cloudflare Worker).

This requires CORS (Cross-Origin Resource Sharing) to be properly configured on the MCP server.

---

## What Needs to Change

The MCP server at `/mcp-server/` needs to:
1. Accept requests from browser origins (localhost, your domain)
2. Handle preflight OPTIONS requests
3. Include proper CORS headers in responses

---

## Configuration Steps

### Option 1: Update Existing CORS Utility

If `mcp-server/src/utils/cors.js` exists:

**Add browser origins to allowed list:**

```javascript
const allowedOrigins = [
  // Existing worker origins
  'https://koassets.adobeaem.workers.dev',
  
  // Add browser origins for WebLLM mode
  'http://localhost:8787',        // Local dev with wrangler
  'http://localhost:3000',        // Local dev with aem cli
  'http://127.0.0.1:8787',       // Alternative localhost
  'http://127.0.0.1:3000',       // Alternative localhost
  
  // Production (if deploying WebLLM to prod later)
  'https://main--koassets--aemsites.aem.live',
  'https://main--koassets--aemsites.aem.page',
];
```

### Option 2: Update MCP Index Handler

If using `mcp-server/src/index.js` directly:

**Add CORS middleware:**

```javascript
// At the top of your MCP handler
function handleCORS(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigins = [
    'http://localhost:8787',
    'http://localhost:3000',
    'http://127.0.0.1:8787',
    'http://127.0.0.1:3000',
    // Add more as needed
  ];

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://koassets.adobeaem.workers.dev',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  return corsHeaders;
}

// In your fetch handler
export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: handleCORS(request),
      });
    }

    // Your normal MCP handling...
    const response = await handleMCPRequest(request, env, ctx);

    // Add CORS headers to response
    const corsHeaders = handleCORS(request);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
};
```

---

## Testing CORS Configuration

### Test 1: Preflight Request

```bash
curl -X OPTIONS http://localhost:8787/mcp \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**Expected:** Should return 204 with CORS headers

### Test 2: Actual Request from Browser

Open browser console on `http://localhost:3000`:

```javascript
fetch('http://localhost:8787/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Expected:** Should return MCP response, not CORS error

---

## Common Issues

### Issue 1: "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS headers not included in response
**Fix:** Add `handleCORS()` to all MCP responses

### Issue 2: "Credentials flag is true, but Access-Control-Allow-Credentials is not"

**Cause:** Missing credentials header when cookies are needed
**Fix:** Add `'Access-Control-Allow-Credentials': 'true'`

### Issue 3: "Origin null is not allowed"

**Cause:** Opening file:// URL directly
**Fix:** Must use http://localhost, not file://

### Issue 4: Preflight fails

**Cause:** Not handling OPTIONS requests
**Fix:** Add OPTIONS handler as shown above

---

## Important Security Notes

1. **Never use wildcard in production:**
   ```javascript
   // ❌ DON'T DO THIS IN PRODUCTION
   'Access-Control-Allow-Origin': '*'
   ```

2. **Validate origins:**
   - Only allow specific localhost ports for development
   - Only allow your actual domains for production

3. **Credentials require specific origin:**
   - Can't use wildcard when `credentials: 'include'`
   - Must echo back the requesting origin (after validation)

4. **Development vs Production:**
   - Localhost origins: Development only
   - Remove or restrict before production deployment

---

## Quick Reference

**Minimum CORS headers needed:**
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
```

**For preflight (OPTIONS) requests:**
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

**For actual requests:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Content-Type: application/json
...
```

---

## Verification Checklist

Before testing WebLLM mode:

- [ ] MCP server handles OPTIONS requests
- [ ] MCP server returns CORS headers
- [ ] Browser origin is in allowed list
- [ ] Preflight request succeeds
- [ ] Actual POST request succeeds
- [ ] Cookies are sent with `credentials: 'include'`
- [ ] No CORS errors in browser console

---

## Need Help?

If CORS still doesn't work:

1. Check browser Network tab for the actual error
2. Look for preflight OPTIONS request
3. Check response headers
4. Verify origin matches exactly (including port)
5. Test with curl first to isolate browser issues

Most CORS issues are simple misconfigurations that browser DevTools make obvious!

