import crypto from 'crypto'
import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import { query } from '@/lib/db'

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

// --- TOTP replay protection (MySQL-backed, works across Vercel instances) ---

async function markTotpCodeUsed(userId: string, code: string): Promise<void> {
  await query(
    'INSERT IGNORE INTO totp_used_codes (user_id, code) VALUES (?, ?)',
    [userId, code]
  )
  // Prune expired entries (older than 90 seconds) — fire-and-forget
  query(
    'DELETE FROM totp_used_codes WHERE used_at < DATE_SUB(NOW(), INTERVAL 90 SECOND)',
    []
  ).catch(() => {})
}

async function isTotpCodeUsed(userId: string, code: string): Promise<boolean> {
  const rows = await query<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM totp_used_codes WHERE user_id = ? AND code = ? AND used_at >= DATE_SUB(NOW(), INTERVAL 90 SECOND)',
    [userId, code]
  )
  return rows[0]?.cnt > 0
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

export async function verifyTotpCode(secretBase32: string, code: string, userId: string): Promise<boolean> {
  if (await isTotpCodeUsed(userId, code)) return false
  const totp = new TOTP({
    issuer: 'GENTHRUST Portal',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  })
  const delta = totp.validate({ token: code, window: 1 })
  if (delta === null) return false
  await markTotpCodeUsed(userId, code)
  return true
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
    // 12 characters from a 32-char alphabet = 32^12 ≈ 2^60 bits of entropy.
    // Formatted as XXXX-XXXX-XXXX for readability.
    let raw = ''
    for (let j = 0; j < 12; j++) {
      raw += chars[crypto.randomInt(chars.length)]
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`)
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

    // Validate sub is a numeric string before parsing
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) return null

    const userId = parseInt(payload.sub, 10)
    if (!Number.isFinite(userId) || userId <= 0) return null

    return {
      userId,
      email: payload.email,
    }
  } catch {
    return null
  }
}
