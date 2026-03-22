import crypto from 'crypto'

const FLIGHTDECK_URL = 'https://workspace-cals-projects-8137565b.vercel.app'

export function generateSsoToken(claims: {
  email: string
  name: string
  role: string
  tenantId: string
}): string {
  const secret = process.env.SSO_REDIRECT_SECRET
  if (!secret) throw new Error('SSO_REDIRECT_SECRET is not configured')

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    iat: Math.floor(Date.now() / 1000),
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')

  return `${header}.${payload}.${signature}`
}

export function buildFlightDeckSsoUrl(token: string, redirect = '/'): string {
  return `${FLIGHTDECK_URL}/api/auth/sso-redirect?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`
}
