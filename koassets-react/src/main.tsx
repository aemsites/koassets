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

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

createRoot(rootElement).render(
    <StrictMode>
        <BrowserRouter basename="/tools/assets-browser">
            <App />
        </BrowserRouter>
    </StrictMode>
); 