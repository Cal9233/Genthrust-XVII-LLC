import crypto from 'crypto'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'

const ENCRYPTION_KEY = () => {
  const key = process.env.MFA_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('MFA_ENCRYPTION_KEY must be a 64-char hex string')
  }
  return Buffer.from(key, 'hex')
}

// --- AES-256-GCM encryption for TOTP secrets ---

export function encryptSecret(plaintext: string): {
  encrypted: string
  iv: string
  authTag: string
} {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY(), iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  }
}

export function decryptSecret(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY(),
    Buffer.from(iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// --- TOTP generation & verification ---

export function generateTotpSecret(email: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 })
  const totp = new TOTP({
    issuer: 'GENTHRUST Portal',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return {
    secret: secret.base32,
    uri: totp.toString(),
  }
}

export function verifyTotpCode(secretBase32: string, code: string): boolean {
  const totp = new TOTP({
    issuer: 'GENTHRUST Portal',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

// --- QR code ---

export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, { width: 256, margin: 2 })
}

// --- Recovery codes ---

export function generateRecoveryCodes(count: number = 10): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars[crypto.randomInt(chars.length)]
    }
    codes.push(code)
  }
  return codes
}

// --- MFA challenge tokens (short-lived JWT) ---

export function createMfaChallengeToken(userId: number, email: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')

  const payload = {
    sub: String(userId),
    email,
    purpose: 'mfa-challenge',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
  }

  // Simple HMAC-based token (header.payload.signature)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  return `${header}.${body}.${signature}`
}

export function verifyMfaChallengeToken(token: string): { userId: number; email: string } | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, signature] = parts
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url')

    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(
        Buffer.from(signature, 'base64url'),
        Buffer.from(expectedSig, 'base64url')
      )
    ) return null

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())

    if (payload.purpose !== 'mfa-challenge') return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return {
      userId: parseInt(payload.sub),
      email: payload.email,
    }
  } catch {
    return null
  }
}
