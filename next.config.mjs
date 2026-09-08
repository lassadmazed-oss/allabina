const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  // 16mb: وثيقة حتى 15 MiB (حدّ مخزن الوثائق) مع هامش لبقيّة الحقول
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
}
export default nextConfig
