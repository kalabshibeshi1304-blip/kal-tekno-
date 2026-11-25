import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedSessionUser, UserRole } from '../../src/types/hotel.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedSessionUser;
    }
  }
}

const JWT_SECRET =
  process.env.JWT_SECRET?.trim() || 'kal-tekno-multi-hotel-dev-jwt-signing-secret';
const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12 hours per shift

interface JwtPayload extends AuthenticatedSessionUser {
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function signAuthToken(user: AuthenticatedSessionUser): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      ...user,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
  );
  return `${signingInput}.${signature}`;
}

export function verifyAuthToken(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }
  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
  );

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid token signature');
  }

  const decoded = JSON.parse(base64UrlDecode(payload)) as JwtPayload;
  if (!decoded.userId || !decoded.hotelId || !decoded.role) {
    throw new Error('Invalid token claims');
  }
  if (typeof decoded.exp === 'number' && Math.floor(Date.now() / 1000) > decoded.exp) {
    throw new Error('Token expired');
  }
  return decoded;
}

export interface VerifyRoleOptions {
  requireSameHotel?: boolean;
  centralAdminOnly?: boolean;
}

/**
 * Multi-Hotel JWT Authentication & Role-Based Access Control (RBAC) Middleware.
 * - Verifies Bearer JWT signature & expiration (401)
 * - Enforces branch hotelId isolation unless Central Server Admin (403)
 * - Grants Manager full access within their hotel while enforcing allowedRoles for other staff (403)
 */
export function verifyRole(allowedRoles: UserRole[], options: VerifyRoleOptions = {}) {
  const { requireSameHotel = true, centralAdminOnly = false } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;
      const token =
        authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!token) {
        res.status(401).json({
          error: 'ዕንቅፋት: ምንም ፈቃድ (Token) አልተገኘም!',
          message: 'ዕንቅፋት: ምንም ፈቃድ (Token) አልተገኘም!',
        });
        return;
      }

      const decoded = verifyAuthToken(token);
      req.user = {
        userId: decoded.userId,
        hotelId: decoded.hotelId,
        role: decoded.role,
        name: decoded.name,
        amharicName: decoded.amharicName,
        departmentLabel: decoded.departmentLabel,
        isCentralAdmin: Boolean(decoded.isCentralAdmin),
      };

      if (centralAdminOnly && !req.user.isCentralAdmin) {
        res.status(403).json({
          error: 'ይህንን የዋና ሰርቨር ገጽ ለመጠቀም የማዕከላዊ አድሚን ፈቃድ ያስፈልጋል!',
          message: 'ይህንን የዋና ሰርቨር ገጽ ለመጠቀም የማዕከላዊ አድሚን ፈቃድ ያስፈልጋል!',
        });
        return;
      }

      // Multi-hotel tenant isolation check: branch staff/managers cannot cross into another hotel
      if (requireSameHotel && !req.user.isCentralAdmin) {
        const headerHotel = req.headers['x-hotel-id'];
        const requestedHotel =
          typeof headerHotel === 'string' && headerHotel.trim()
            ? headerHotel.trim()
            : req.params.id && req.baseUrl.includes('/hotels')
              ? req.params.id
              : req.user.hotelId;

        if (requestedHotel !== req.user.hotelId) {
          res.status(403).json({
            error: 'የሌላ ሆቴል መረጃ የመጠቀም ፈቃድ የለዎትም!',
            message: 'የሌላ ሆቴል መረጃ የመጠቀም ፈቃድ የለዎትም!',
          });
          return;
        }
      }

      // Role check: Manager (and Central Admin) always has operational authority within scope
      if (
        !allowedRoles.includes(req.user.role) &&
        req.user.role !== 'manager' &&
        !req.user.isCentralAdmin
      ) {
        res.status(403).json({
          error: 'ይህንን ገጽ ለመጠቀም ፈቃድ አልለዎትም!',
          message: 'ይህንን ገጽ ለመጠቀም ፈቃድ አልለዎትም!',
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({
        error: 'የማረጋገጫ ስህተት, እባክዎ እንደገና ይግቡ።',
        message: 'የማረጋገጫ ስህተት, እባክዎ እንደገና ይግቡ።',
      });
    }
  };
}
