import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  // eslint-disable-next-line no-undef
  loadEnv(mode, process.cwd(), '');

  // Determine which env file to load based on NODE_ENV or mode
  // eslint-disable-next-line no-undef
  const envMode = process.env.NODE_ENV || mode || 'development';
  console.log(`🌍 Loading environment: ${envMode}`);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: '/tools/assets-browser/index.html'
    },
    base: '/tools/assets-browser/',
    // Load environment files in order of priority
    envDir: './', // Look for env files in the current directory
    envPrefix: 'VITE_', // Only expose variables starting with VITE_
    // Enable source maps for debugging
    css: {
      devSourcemap: true
    },
    build: {
      sourcemap: true, // Enable source maps for production builds too
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
    },
    define: {
      // Expose environment info to the app
      __APP_ENV__: JSON.stringify(envMode),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    }
  };
});
