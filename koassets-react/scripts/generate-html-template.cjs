#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate index.html with environment variable placeholders
 * This creates a template that can be processed by the target environment
 * The target server can replace ${ADOBE_CLIENT_ID} with actual values
 */

console.log('🚀 Generating HTML template with environment variable placeholders...');

// Path to the built HTML file
const htmlPath = path.join(__dirname, '..', '..', 'tools', 'assets-browser', 'index.html');

if (!fs.existsSync(htmlPath)) {
    console.error('❌ index.html not found. Run vite build first.');
    process.exit(1);
}

// Read the current HTML
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Create the template config script with environment variable placeholders
const configScript = `    <!-- Runtime configuration with environment variables -->
    <script>
      window.APP_CONFIG = {
        ADOBE_CLIENT_ID: '\${ADOBE_CLIENT_ID}',
        BUCKET: '\${BUCKET}',
        // Template generated at: ${new Date().toISOString()}
      };
    </script>`;

// Remove the external config.js reference if it exists (both in head and body)
htmlContent = htmlContent.replace(/<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*<script src="config\.js"><\/script>/g, '');
htmlContent = htmlContent.replace(/<!-- Runtime configuration - load before React app -->\s*/g, '');

// Remove any existing embedded config to prevent duplicates
htmlContent = htmlContent.replace(/\s*<!-- Runtime configuration embedded inline -->\s*<script>\s*window\.APP_CONFIG = \{[\s\S]*?\};\s*<\/script>/g, '');
htmlContent = htmlContent.replace(/\s*<!-- Runtime configuration with environment variables -->\s*<script>\s*window\.APP_CONFIG = \{[\s\S]*?\};\s*<\/script>/g, '');

// Add the template config before the closing </head> tag
htmlContent = htmlContent.replace('</head>', `${configScript}\n  </head>`);

// Write the updated HTML
fs.writeFileSync(htmlPath, htmlContent);

console.log('✅ HTML template generated at:', htmlPath);
console.log('📋 Template contains placeholders:');
console.log('   ADOBE_CLIENT_ID: ${ADOBE_CLIENT_ID}');
console.log('   BUCKET: ${BUCKET}');
console.log('');
console.log('🔧 Target environment should replace these with actual values:');
console.log('   - Using envsubst: envsubst < index.html > index.html.tmp && mv index.html.tmp index.html');
console.log('   - Using sed: sed -i "s/\\${ADOBE_CLIENT_ID}/$ADOBE_CLIENT_ID/g" index.html');
console.log('   - Using server-side templating (PHP, Node.js, etc.)');
console.log('');
console.log('✅ No separate config.js file needed!');
console.log('🚀 Template ready for deployment!'); 