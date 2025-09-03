#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Clean up development-only scripts from built HTML
 * This script removes local dev config references that shouldn't be in production
 * The app configuration is already embedded in the JS bundle by Vite
 */

console.log('🚀 Cleaning up development-only scripts from HTML...');

// Path to the built HTML file (process in dist before copying)
const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(htmlPath)) {
    console.error('❌ index.html not found. Run vite build first.');
    process.exit(1);
}

// Read the current HTML
let htmlContent = fs.readFileSync(htmlPath, 'utf8');



// Remove the external config.js reference if it exists (both in head and body)
htmlContent = htmlContent.replace(/<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*/g, '');

// Remove local development config (not needed in production build)
htmlContent = htmlContent.replace(/\s*<!-- Local development config override \(gitignored\) -->/g, '');
htmlContent = htmlContent.replace(/\s*<script src="[^"]*config\.local\.js"[^>]*><\/script>/g, '');

// Remove any existing embedded config to prevent duplicates
htmlContent = htmlContent.replace(/\s*<!-- Runtime configuration embedded inline -->\s*<script>\s*window\.APP_CONFIG = \{[\s\S]*?\};\s*<\/script>/g, '');



// Write the updated HTML
fs.writeFileSync(htmlPath, htmlContent);

console.log('✅ Development scripts removed from HTML at:', htmlPath);
console.log('📁 File will be copied to tools/assets-browser/ in the next step');
console.log('');
console.log('✅ Production HTML is clean and ready!');
console.log('🚀 Configuration values are embedded in the JS bundle by Vite!'); 