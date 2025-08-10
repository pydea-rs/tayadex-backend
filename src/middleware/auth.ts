import { Context, Next } from 'hono';
import { extractToken, verifyToken } from '../utils/auth';
import { prisma } from '../services/prisma';

// Extend the context to include user information
export interface AuthContext extends Context {
  user?: {
    id: number;
    address: string;
  };
}

// Authentication middleware
export async function authMiddleware(c: AuthContext, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return c.json({ error: 'Authorization token required' }, 401);
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, address: true }
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    // Verify address matches (in case user was updated)
    if (user.address.toLowerCase() !== decoded.address.toLowerCase()) {
      return c.json({ error: 'Token address mismatch' }, 401);
    }

    // Add user info to context
    c.set('user', user);
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

// Optional authentication middleware (doesn't fail if no token)
export async function optionalAuthMiddleware(c: AuthContext, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    const token = extractToken(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, address: true }
        });

        if (user && user.address.toLowerCase() === decoded.address.toLowerCase()) {
          c.set('user', user);
        }
      }
    }
    
    await next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // Continue without authentication
    await next();
  }
} 