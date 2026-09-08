const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // 10mb: صورة حالة واحدة حتى 8 MiB (حدّ المخزن) مع هامش لبقيّة الحقول
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
}
export default nextConfig
