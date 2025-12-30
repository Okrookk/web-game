import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    publicDir: false, // Don't use publicDir - assets are served by Express server
    server: {
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3000',
                ws: true
            }
        }
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html')
            }
        },
        // Copy assets to dist folder during build
        copyPublicDir: false, // We handle assets manually via Express
    },
    define: {
        'import.meta.env.VITE_SERVER_URL': JSON.stringify(process.env.VITE_SERVER_URL || '')
    }
});
