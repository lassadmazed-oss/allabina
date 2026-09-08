import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // 'server-only' يرمي عمداً خارج مكوّن خادم. الحارس مفيد في البناء،
      // لكنّه يمنع اختبار منطق خالص يعيش في ملفّ خادم — نحيّده هنا وحده.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
