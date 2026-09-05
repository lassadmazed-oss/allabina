import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * فحوص تتّصل بقاعدة البيانات الحيّة — منفصلة عن vitest.config.ts حتى
 * تبقى مجموعة الاختبارات العادية سريعة وتخدم بلا شبكة.
 * التشغيل: npm run check:bordereau
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['scripts/checks/**/*.test.ts'],
    testTimeout: 30000,
  },
})
