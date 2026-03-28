import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          primevue: ['primevue/config', 'primevue/button', 'primevue/datepicker', 'primevue/inputnumber', 'primevue/inputtext', 'primevue/select', 'primevue/textarea', 'primevue/tag', 'primevue/progressbar', 'primevue/checkbox'],
          vendor: ['vue', 'vue-router', 'pinia'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
