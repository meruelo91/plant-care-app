import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),

    // VitePWA generates a Service Worker and web app manifest automatically.
    //
    // SERVICE WORKER: A script that runs in the background (separate from
    // your app) and can intercept network requests. This is what enables
    // offline functionality - the SW caches your app's files so they load
    // even without internet.
    //
    // WEB APP MANIFEST: A JSON file that tells the browser how your app
    // should behave when "installed" on a device (icon, name, colors, etc.)
    VitePWA({
      // 'autoUpdate' means the Service Worker updates silently when new
      // code is deployed. The alternative is 'prompt' which shows the user
      // a "new version available" message.
      registerType: 'autoUpdate',

      // Disable SW in development to avoid caching issues.
      // The Service Worker caches everything aggressively, which is great
      // for production (offline support) but terrible for development
      // (you'd see stale/old versions of the app).
      devOptions: {
        enabled: false,
      },

      // Include these file types in the precache (downloaded and stored
      // offline when the app first loads)
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },

      // This generates the manifest.json file that makes the app installable
      manifest: {
        name: 'Plant Care',
        short_name: 'PlantCare',
        description: 'Cuida tus plantas con recordatorios inteligentes',
        theme_color: '#10B981',
        background_color: '#FFFFFF',
        display: 'standalone', // Hides browser UI when installed
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // For Android adaptive icons
          },
        ],
      },
    }),
  ],

  // Path aliases: instead of writing '../../components/Button',
  // you can write '@/components/Button'. Cleaner and doesn't break
  // when you move files around.
  // Expose the dev server on the local network so you can
  // test on your phone using your computer's IP address
  server: {
    host: '0.0.0.0',
    port: 5173,

    // PROXY CONFIGURATION:
    // The Anthropic API doesn't allow direct browser calls (CORS policy).
    // This proxy tells Vite: "when the browser requests /api/anthropic/*,
    // forward it to api.anthropic.com/* on the server side".
    //
    // The browser never talks to Anthropic directly — Vite's dev server
    // acts as a middleman, which bypasses CORS restrictions.
    //
    // NOTE: This only works in development. For production, you'd need
    // a backend proxy (Netlify Function, Cloudflare Worker, etc.)
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        // Remove the "/api/anthropic" prefix before forwarding.
        // So /api/anthropic/v1/messages → /v1/messages
        rewrite: (proxyPath: string) => proxyPath.replace(/^\/api\/anthropic/, ''),
        secure: true,
        // Strip browser headers that make Anthropic think the request
        // comes directly from a browser (which triggers CORS errors).
        // The whole point of the proxy is that the SERVER makes the
        // request, not the browser — so these headers shouldn't be there.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
