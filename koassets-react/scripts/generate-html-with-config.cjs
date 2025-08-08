#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate index.html with embedded config (no separate config.js needed)
 * This script modifies the built index.html to include config inline
 * Safe for static deployment without needing to commit config.js
 */

console.log('🚀 Embedding config directly in HTML...');

// Get configuration values from environment variables
const deploymentConfig = {
    ADOBE_CLIENT_ID: process.env.VITE_ADOBE_CLIENT_ID,
    BUCKET: process.env.VITE_BUCKET,
};

// Validate required configuration
const requiredVars = ['ADOBE_CLIENT_ID', 'BUCKET'];
const missingVars = requiredVars.filter(key => !deploymentConfig[key]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - VITE_${varName}`);
    });
    console.error('\n💡 Example usage:');
    console.error('   VITE_ADOBE_CLIENT_ID=your-client-id VITE_BUCKET=your-bucket-name npm run build:embed');
    process.exit(1);
}

// Path to the built HTML file
const htmlPath = path.join(__dirname, '..', '..', 'tools', 'assets-browser', 'index.html');

if (!fs.existsSync(htmlPath)) {
    console.error('❌ index.html not found. Run vite build first.');
    process.exit(1);
}

// Read the current HTML
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Create the embedded config script
const configScript = `    <!-- Runtime configuration embedded inline -->
    <script>
      window.APP_CONFIG = {
        ADOBE_CLIENT_ID: '${deploymentConfig.ADOBE_CLIENT_ID}',
        BUCKET: '${deploymentConfig.BUCKET}',
        // Generated at: ${new Date().toISOString()}
      };
    </script>`;

// Remove the external config.js reference if it exists (both in head and body)
htmlContent = htmlContent.replace(/<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*/g, '');

// Remove any existing embedded config to prevent duplicates
htmlContent = htmlContent.replace(/\s*<!-- Runtime configuration embedded inline -->\s*<script>\s*window\.APP_CONFIG = \{[\s\S]*?\};\s*<\/script>/g, '');

// Add the embedded config before the closing </head> tag
htmlContent = htmlContent.replace('</head>', `${configScript}\n  </head>`);

// Write the updated HTML
fs.writeFileSync(htmlPath, htmlContent);

console.log('✅ Config embedded in HTML at:', htmlPath);
console.log('📋 Configuration:');
console.log(`   ADOBE_CLIENT_ID: ${deploymentConfig.ADOBE_CLIENT_ID}`);
console.log(`   BUCKET: ${deploymentConfig.BUCKET}`);
console.log('');
console.log('✅ No separate config.js file needed!');
console.log('🚀 Ready for static deployment - just upload the files!'); 