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
    // unsafe-eval is required for Next.js HMR in development only; omit in production
    const scriptSrc = process.env.NODE_ENV === 'development'
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
      : "script-src 'self'";
    return [
      {
        source: '/(.*)',
        headers: [
          // OPT-016: Content-Security-Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              // Tailwind injects inline styles
              "style-src 'self' 'unsafe-inline'",
              // QR codes may be data: URIs; blob: for canvas-generated images
              "img-src 'self' data: blob:",
              // Google Fonts (if used)
              "font-src 'self' https://fonts.gstatic.com",
              // Google Maps embed on contact page
              "frame-src 'self' https://www.google.com",
              // ERP API, Microsoft Graph/Entra, and Upstash Redis (rate-limiting)
              "connect-src 'self' https://wapi.erp.aero https://graph.microsoft.com https://login.microsoftonline.com https://*.upstash.io",
              // Prevent this page from being embedded in iframes
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
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
