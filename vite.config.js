import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        process: true
      }
    })
  ],
  server: {
    port: 3000,
    host: true
  },
  define: {
    global: 'globalThis'
  },
  optimizeDeps: {
    include: [
      '@solana/web3.js',
      '@solana/spl-token',
      'buffer'
    ]
  }
})
