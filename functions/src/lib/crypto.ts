import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

/**
 * AES-256-GCM envelope for OAuth tokens at rest. Even if Firestore data leaks (backup, misconfigured
 * rule, admin export) the tokens are useless without the key held in Secret Manager.
 * Format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 */
export function parseKey(raw: string): Buffer {
  const trimmed = raw.trim()
  let key: Buffer
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) key = Buffer.from(trimmed, 'hex')
  else key = Buffer.from(trimmed, 'base64')
  if (key.length !== 32) {
    // Derive a 32 byte key from arbitrary input rather than failing hard; still requires the secret.
    key = createHash('sha256').update(trimmed).digest()
  }
  return key
}

export function encrypt(plaintext: string, rawKey: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', parseKey(rawKey), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

export function decrypt(payload: string, rawKey: string): string {
  const [version, iv, tag, ct] = payload.split('.')
  if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Unsupported ciphertext format')
  const decipher = createDecipheriv('aes-256-gcm', parseKey(rawKey), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
