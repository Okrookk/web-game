import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.',
    publicDir: 'assets', // Serve assets from the assets root, or we can just copy them
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
        }
    },
    define: {
        'import.meta.env.VITE_SERVER_URL': JSON.stringify(process.env.VITE_SERVER_URL || '')
    }
});
