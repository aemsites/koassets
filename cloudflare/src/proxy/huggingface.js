/**
 * Hugging Face Proxy for WebLLM Models
 * Proxies requests to Hugging Face to bypass CORS restrictions
 */

/**
 * Proxy Hugging Face model requests
 */
export async function proxyHuggingFace(request) {
  const url = new URL(request.url);

  // Extract the path after /api/hf-proxy/
  // Expected format: /api/hf-proxy/mlc-ai/MODEL_NAME/resolve/main/FILE
  const pathMatch = url.pathname.match(/^\/api\/hf-proxy\/(.+)$/);

  if (!pathMatch) {
    return new Response('Invalid proxy path', { status: 400 });
  }

  const hfPath = pathMatch[1];
  const hfUrl = `https://huggingface.co/${hfPath}`;

  console.log('[HF Proxy] Proxying request to:', hfUrl);

  try {
    const response = await fetch(hfUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 WebLLM-Client',
        Accept: '*/*',
      },
    });

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

    console.log('[HF Proxy] Response status:', response.status);
    return proxyResponse;
  } catch (error) {
    console.error('[HF Proxy] Error:', error);
    return new Response(`Proxy error: ${error.message}`, { status: 502 });
  }
}
