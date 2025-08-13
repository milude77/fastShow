import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 设置为相对路径
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        search: resolve(__dirname, 'search.html')
      }
    }
  },
  server: {
    port:5234,
    strictPort:true
  },
})
