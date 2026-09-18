import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'react-dom'
          if (id.includes('node_modules/react')) return 'react'
          if (id.includes('/src/MarketingHub')) return 'marketing-hub'
          if (id.includes('/src/PublicDiscovery')) return 'public-discovery'
          if (id.includes('/src/Admin')) return 'admin'
        },
      },
    },
  },
})
