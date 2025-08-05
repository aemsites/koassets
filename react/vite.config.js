import react from '@vitejs/plugin-react';
import fs from 'fs';
import { defineConfig } from 'vite';

// Check if HTTPS certificates exist and if HTTP is forced
const httpsConfig = (() => {
  // Check for FORCE_HTTP environment variable
  if (process.env.FORCE_HTTP === 'true') {
    console.log('🔗 FORCE_HTTP=true - running with HTTP');
    return false;
  }

  try {
    const keyPath = './localhost+2-key.pem';
    const certPath = './localhost+2.pem';

    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      console.log('✅ HTTPS certificates found - running with HTTPS');
      console.log('💡 To force HTTP mode, set FORCE_HTTP=true');
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    } else {
      console.log('⚠️  HTTPS certificates not found - running with HTTP');
      return false;
    }
  } catch (error) {
    console.log('⚠️  Error checking HTTPS certificates - running with HTTP:', error.message);
    return false;
  }
})();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    ...(httpsConfig && { https: httpsConfig }), // Only add HTTPS config if certificates exist and HTTP not forced
    port: 5173
  },
  base: '/tools/assets-browser/',
  build: {
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/index.css';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  }
})
