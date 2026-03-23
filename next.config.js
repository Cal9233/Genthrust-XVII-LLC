/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mysql2'],
    // OPT-023: tree-shake large icon/chart/3D libraries at compile time
    optimizePackageImports: ['recharts', 'lucide-react', 'three', '@react-three/fiber', '@react-three/drei'],
  },
  images: {
    remotePatterns: [],
  },
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/GenLogoTab.png',
      },
    ]
  },
  async headers() {
    // CSP is now set dynamically by middleware.ts with per-request nonces.
    // Only non-CSP security headers remain here.
    return [
      {
        source: '/(.*)',
        headers: [
          // OPT-017: HTTP Strict Transport Security
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
