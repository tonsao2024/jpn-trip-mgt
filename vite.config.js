import { defineConfig } from 'vite';

// การตั้งค่า Vite — dev server เปิดรับทุก host (สำหรับ preview environment)
// และตั้งค่า Vitest ให้ค้นหา test ทั้งหมดในโฟลเดอร์ tests/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1800
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    testTimeout: 20000,
    hookTimeout: 60000
  }
});
