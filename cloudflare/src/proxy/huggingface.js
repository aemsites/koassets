/**
 * Hugging Face Proxy for WebLLM Models
 * Proxies requests to Hugging Face to bypass CORS restrictions
 */

/**
 * Proxy Hugging Face model requests
 */
export async function proxyHuggingFace(request) {
  const url = new URL(request.url);

  console.log('[HF Proxy] Received request:', request.method, url.pathname);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Extract the path after /api/hf-proxy/
  // Expected format: /api/hf-proxy/mlc-ai/MODEL_NAME/resolve/main/FILE
  const pathMatch = url.pathname.match(/^\/api\/hf-proxy\/(.+)$/);

  if (!pathMatch) {
    console.error('[HF Proxy] Invalid path:', url.pathname);
    return new Response('Invalid proxy path', {
      status: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const hfPath = pathMatch[1];
  const hfUrl = `https://huggingface.co/${hfPath}`;

  console.log('[HF Proxy] Proxying to HuggingFace:', hfUrl);

  try {
    const response = await fetch(hfUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 WebLLM-Client',
        Accept: '*/*',
      },
      redirect: 'follow', // Explicitly follow redirects
    });

    console.log('[HF Proxy] HuggingFace response:', response.status, response.statusText);
    console.log('[HF Proxy] Final URL after redirects:', response.url);

    // If HuggingFace returned an error, clone and log it
    if (!response.ok) {
      try {
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();
        console.error('[HF Proxy] HuggingFace error response:', body.substring(0, 500));
      } catch (e) {
        console.error('[HF Proxy] Could not read error body:', e.message);
      }
    }

    // Create new response with CORS headers
    const proxyResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
    });

    // Add CORS headers
    proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
    proxyResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    proxyResponse.headers.set('Access-Control-Allow-Headers', '*');

    // Copy important headers from original response
    if (response.headers.has('Content-Type')) {
      proxyResponse.headers.set('Content-Type', response.headers.get('Content-Type'));
    }
    if (response.headers.has('Content-Length')) {
      proxyResponse.headers.set('Content-Length', response.headers.get('Content-Length'));
    }
    if (response.headers.has('ETag')) {
      proxyResponse.headers.set('ETag', response.headers.get('ETag'));
    }

    // Set aggressive caching for model files
    if (hfPath.includes('/resolve/main/')) {
      proxyResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return proxyResponse;
  } catch (error) {
    console.error('[HF Proxy] Fetch error:', error);
    return new Response(`Proxy error: ${error.message}`, {
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
