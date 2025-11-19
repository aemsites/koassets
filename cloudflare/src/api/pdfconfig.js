/**
 * Handle PDF configuration request
 * Returns the Adobe PDF Embed API Client ID from the secret store
 * 
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings (includes PDF_EMBED_API_CLIENT_ID)
 * @returns {Response} JSON response with clientId
 */
export async function handlePdfConfig(request, env) {
  try {
    console.log('PDF config endpoint called');
    console.log('Available env keys:', Object.keys(env));
    
    const clientId = await env.PDF_EMBED_API_CLIENT_ID.get();
    console.log('Retrieved clientId:', clientId ? 'Found' : 'Not found');
    
    if (!clientId) {
      console.error('PDF_EMBED_API_CLIENT_ID not found in secret store');
      return Response.json(
        { error: 'PDF configuration not available' },
        { status: 500 }
      );
    }

    return Response.json({ clientId });
  } catch (error) {
    console.error('Error fetching PDF config:', error);
    console.error('Error details:', error.message, error.stack);
    return Response.json(
      { error: 'Failed to fetch PDF configuration', details: error.message },
      { status: 500 }
    );
  }
}

