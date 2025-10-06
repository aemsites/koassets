import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { getExternalParams } from './utils/config';

/*
// Monitor LCP performance - detect if LCP element is being lazy loaded
if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latestEntry = entries[entries.length - 1] as PerformanceEntry & {
            element?: Element;
            url?: string;
        };
        
        if (latestEntry?.element?.getAttribute('loading') === 'lazy') {
            console.warn('⚠️ Warning: LCP element was lazy loaded', {
                element: latestEntry.element,
                loadTime: latestEntry.startTime,
                url: latestEntry.url,
                entry: latestEntry
            });
        } else {
            console.debug('✅ LCP element loaded correctly', {
                element: latestEntry.element,
                loadTime: latestEntry.startTime,
                url: latestEntry.url
            });
        }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
}
*/

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