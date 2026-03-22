import crypto from 'crypto'

const FLIGHTDECK_URL = process.env.FLIGHTDECK_URL || 'https://app.genthrust.org'

export function generateSsoToken(claims: {
  email: string
  name: string
  role: string
  tenantId: string
}): string {
  const secret = process.env.SSO_REDIRECT_SECRET
  if (!secret) throw new Error('SSO_REDIRECT_SECRET is not configured')

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    iat: now,
    exp: now + 60,
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')

  return `${header}.${payload}.${signature}`
}

export function buildFlightDeckSsoUrl(token: string, redirect = '/'): string {
  return `${FLIGHTDECK_URL}/api/auth/sso-redirect?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`
}
