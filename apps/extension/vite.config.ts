import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],

  build: {
    outDir:        'dist',
    emptyOutDir:   true,
    sourcemap:     false,
    minify:        'terser',

    rollupOptions: {
      input: {
        popup:      resolve(__dirname, 'public/popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content:    resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
})
