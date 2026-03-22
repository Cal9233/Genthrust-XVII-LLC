import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/internal/', '/portal/', '/api/'],
      },
    ],
    sitemap: 'https://genthrust.com/sitemap.xml',
  }
}
