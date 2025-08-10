import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const JWT_SECRET = process.env.JWT_SECRET || 'PayaSecret';
const JWT_ISSUER = process.env.JWT_ISSUER || 'PayaSaysTheWord';
const JWT_EXPIRY_DAYS: number = +(process.env.JWT_EXPIRY_DAYS ?? 1)

export const WEB3_AUTH_MESSAGE = `Welcome to Tayadex!

Click to sign in and accept the Tayadex Terms of Service.

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet: {address}
Nonce: {nonce}
Timestamp: {timestamp}`;

export const Web3AuthSchema = z.object({
  address: z.string().min(42).max(42),
  signature: z.string(),
  message: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
});

export type Web3AuthData = z.infer<typeof Web3AuthSchema>;

export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function generateAuthMessage(address: string, nonce: string): string {
  const timestamp = new Date().toISOString();
  return WEB3_AUTH_MESSAGE
    .replace('{address}', address)
    .replace('{nonce}', nonce)
    .replace('{timestamp}', timestamp);
}

export function verifySignature(address: string, message: string, signature: string): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export function generateToken(payload: { userId: number; address: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXPIRY_DAYS}d`, issuer: JWT_ISSUER });
}

export function verifyToken(token: string): { userId: number; address: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER }) as { userId: number; address: string };
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
} 