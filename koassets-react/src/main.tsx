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