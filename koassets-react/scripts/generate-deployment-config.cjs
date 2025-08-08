#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate deployment config.js with actual values from environment variables
 * This script creates the config file needed for static deployment
 * The file should NOT be committed to git
 */

console.log('🚀 Generating deployment config.js from environment variables...');

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
    console.error('   VITE_ADOBE_CLIENT_ID=your-client-id VITE_BUCKET=your-bucket-name npm run build:deploy');
    console.error('   # or');
    console.error('   export VITE_ADOBE_CLIENT_ID=your-client-id');
    console.error('   export VITE_BUCKET=your-bucket-name');
    process.exit(1);
}

// Generate the deployment config.js content
const configContent = `// Runtime configuration for static deployment
// Generated at: ${new Date().toISOString()}
// WARNING: This file contains sensitive values and should NOT be committed to git
window.APP_CONFIG = {
  ADOBE_CLIENT_ID: '${deploymentConfig.ADOBE_CLIENT_ID}',
  BUCKET: '${deploymentConfig.BUCKET}',
  // Add other environment variables as needed
};
`;

// Write to tools/assets-browser/ for static deployment
const toolsConfigPath = path.join(__dirname, '..', '..', 'tools', 'assets-browser', 'config.js');
fs.writeFileSync(toolsConfigPath, configContent);

console.log('✅ Generated deployment config at:', toolsConfigPath);
console.log('📋 Configuration:');
console.log(`   ADOBE_CLIENT_ID: ${deploymentConfig.ADOBE_CLIENT_ID}`);
console.log(`   BUCKET: ${deploymentConfig.BUCKET}`);
console.log('');
console.log('⚠️  IMPORTANT: This file is NOT committed to git for security!');
console.log('💡 To deploy: Run this script with env vars, then copy files to server');
console.log('🔒 The config.js file is in .gitignore to prevent accidental commits'); 