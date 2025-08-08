#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Generate runtime configuration from environment variables
 * This script:
 * 1. Loads environment variables from various sources
 * 2. Checks for runtime env vars (VITE_*)
 * 3. Falls back to .env files if runtime vars don't exist
 * 4. Generates config.js in dist/ folder
 */

// Helper function to load .env files
function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    const envContent = fs.readFileSync(filePath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
                envVars[key.trim()] = value;
            }
        }
    });

    return envVars;
}

// Determine NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment variables in order of precedence (highest to lowest)
const envSources = [
    // Runtime environment variables (highest precedence)
    process.env,

    // .env.local (local overrides)
    loadEnvFile('.env.local'),

    // Environment-specific files
    loadEnvFile(`.env.${nodeEnv}`),

    // Base .env file (lowest precedence)
    loadEnvFile('.env')
];

// Function to get environment variable with precedence
function getEnvVar(key) {
    for (const source of envSources) {
        if (source[key] !== undefined && source[key] !== '') {
            return source[key];
        }
    }
    return '';
}

// Get configuration values
const config = {
    ADOBE_CLIENT_ID: getEnvVar('VITE_ADOBE_CLIENT_ID'),
    BUCKET: getEnvVar('VITE_BUCKET'),
    // Add other environment variables as needed
};

// Validate required configuration
const requiredVars = ['ADOBE_CLIENT_ID', 'BUCKET'];
const missingVars = requiredVars.filter(key => !config[key]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
        console.error(`   - VITE_${varName}`);
    });
    console.error('\n💡 Please set these environment variables or add them to your .env file');
    process.exit(1);
}

// Generate the config.js content
const configContent = `// Runtime configuration generated from environment variables
// Generated at: ${new Date().toISOString()}
// Environment: ${nodeEnv}
window.APP_CONFIG = {
  ADOBE_CLIENT_ID: '${config.ADOBE_CLIENT_ID}',
  BUCKET: '${config.BUCKET}',
  // Add other environment variables as needed
};
`;

// Ensure dist directory exists
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Write the config file to dist/
const configPath = path.join(distDir, 'config.js');
fs.writeFileSync(configPath, configContent);

// Also write to tools/assets-browser/ for deployment
const toolsConfigPath = path.join(__dirname, '..', '..', 'tools', 'assets-browser', 'config.js');
fs.writeFileSync(toolsConfigPath, configContent);

// Log the results
console.log('✅ Generated runtime config at:', configPath);
console.log('✅ Generated deployment config at:', toolsConfigPath);
console.log('📋 Configuration:');
console.log(`   Environment: ${nodeEnv}`);
console.log(`   ADOBE_CLIENT_ID: ${config.ADOBE_CLIENT_ID || '(not set)'}`);
console.log(`   BUCKET: ${config.BUCKET || '(not set)'}`);

// Show sources that were checked
console.log('\n🔍 Environment sources checked (in order of precedence):');
console.log('   1. Runtime environment variables');
console.log('   2. .env.local');
console.log(`   3. .env.${nodeEnv}`);
console.log('   4. .env');