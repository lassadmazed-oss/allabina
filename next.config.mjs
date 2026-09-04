const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  experimental: { serverActions: { bodySizeLimit: '1mb' } },
}
export default nextConfig
