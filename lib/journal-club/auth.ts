import { jwtVerify } from 'jose';
import crypto from 'crypto';

// Use AUTH_SECRET (same as main auth module) or fall back to default
const authSecret = process.env.AUTH_SECRET ?? 'labor-ai-simulator-secret-key-change-in-production';
const encryptionKeyEnv = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || authSecret;

const ENCRYPTION_KEY = encryptionKeyEnv;
const SECRET = new TextEncoder().encode(authSecret);

/**
 * Decrypt HUJI credentials stored in database.
 * Credentials are encrypted with AES-256-GCM.
 */
export function decryptCredentials(
  encryptedValue: string,
  encryptionKey: string = ENCRYPTION_KEY
): { email: string; password: string } {
  try {
    // Format: iv:encryptedData:authTag
    const [ivHex, encryptedHex, authTagHex] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const key = crypto
      .createHash('sha256')
      .update(encryptionKey)
      .digest();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    const [email, password] = JSON.parse(decrypted);
    return { email, password };
  } catch (error) {
    throw new Error('Failed to decrypt HUJI credentials');
  }
}

/**
 * Encrypt HUJI credentials for storage.
 */
export function encryptCredentials(
  email: string,
  password: string,
  encryptionKey: string = ENCRYPTION_KEY
): string {
  const iv = crypto.randomBytes(16);
  const key = crypto
    .createHash('sha256')
    .update(encryptionKey)
    .digest();

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = JSON.stringify([email, password]);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Verify JWT token from sim_auth cookie.
 * Returns decoded token payload.
 */
export async function verifyJWT(token: string) {
  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Check if user is admin.
 * Reads from sim_users.is_admin.
 */
export async function isAdmin(userId: number): Promise<boolean> {
  const { sql } = await import('@vercel/postgres');
  try {
    const result = await sql`
      SELECT is_admin FROM sim_users WHERE id = ${userId}
    `;
    return result.rows[0]?.is_admin || false;
  } catch {
    return false;
  }
}
