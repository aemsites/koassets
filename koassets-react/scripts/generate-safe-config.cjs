#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate a safe config.js file for static deployment
 * This creates a config file with placeholder values that can be safely committed
 * The actual values should be replaced during deployment or at runtime
 */

console.log('🔒 Generating safe config.js for static deployment...');

// Safe placeholder values (no sensitive data)
const safeConfig = {
    ADOBE_CLIENT_ID: '${ADOBE_CLIENT_ID}', // Will be replaced at runtime
    BUCKET: '${BUCKET}', // Will be replaced at runtime
};

// Generate the safe config.js content
const configContent = `// Runtime configuration for static deployment
// Generated at: ${new Date().toISOString()}
// NOTE: This file contains placeholder values that should be replaced during deployment
window.APP_CONFIG = {
  ADOBE_CLIENT_ID: '${safeConfig.ADOBE_CLIENT_ID}',
  BUCKET: '${safeConfig.BUCKET}',
  // Add other environment variables as needed
};

// Runtime replacement function (optional)
// This allows dynamic replacement of values after page load
if (typeof window !== 'undefined') {
  // Check for runtime config override
  if (window.RUNTIME_CONFIG) {
    window.APP_CONFIG = { ...window.APP_CONFIG, ...window.RUNTIME_CONFIG };
  }
}
`;

// Write to tools/assets-browser/ for static deployment
const toolsConfigPath = path.join(__dirname, '..', '..', 'tools', 'assets-browser', 'config.js');
fs.writeFileSync(toolsConfigPath, configContent);

console.log('✅ Generated safe config at:', toolsConfigPath);
console.log('📋 Safe configuration:');
console.log(`   ADOBE_CLIENT_ID: ${safeConfig.ADOBE_CLIENT_ID}`);
console.log(`   BUCKET: ${safeConfig.BUCKET}`);
console.log('');
console.log('⚠️  IMPORTANT: Replace placeholder values before deployment!');
console.log('💡 Placeholders can be replaced by:');
console.log('   1. Build-time environment variable substitution');
console.log('   2. Runtime JavaScript replacement');
console.log('   3. Server-side template processing'); 