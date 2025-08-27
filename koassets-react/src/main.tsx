// Adobe IMS popup token relay
if (window.opener && window.location.hash.includes('access_token=')) {
    console.log('Relay running', window.location.href);
    try {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get('access_token');
        if (accessToken) {
            window.opener.postMessage(
                { access_token: accessToken },
                window.location.origin
            );
            window.close();
        }
    } catch (e) {
        // ignore
    }
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { getExternalParams } from './utils/config';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

// Get external parameters using utility function
const externalParams = getExternalParams();

// Get isBlockIntegration from externalParams with fallback to false
const isBlockIntegration = externalParams.isBlockIntegration || false;
console.log('isBlockIntegration', isBlockIntegration);

// Choose the appropriate router based on context
const AppWithRouter = isBlockIntegration ? (
    // For block integration: BrowserRouter without basename to work with any URL
    <BrowserRouter>
        <App />
    </BrowserRouter>
) : (
    // For standalone app: BrowserRouter with basename
    <BrowserRouter basename="/tools/assets-browser">
        <App />
    </BrowserRouter>
);

createRoot(rootElement).render(
    <StrictMode>
        {AppWithRouter}
    </StrictMode>
); 