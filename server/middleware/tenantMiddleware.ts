import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      tenantHotelId?: string;
    }
  }
}

/**
 * Multi-Hotel Tenant Isolation Middleware (`tenantMiddleware`).
 * Resolves the active `hotelId` from `x-hotel-id` or authenticated JWT claims,
 * ensuring branch users cannot spoof another hotel's `hotelId`.
 */
export function resolveTenantHotel(req: Request, res: Response, next: NextFunction): void {
  const headerHotel =
    typeof req.headers['x-hotel-id'] === 'string' && req.headers['x-hotel-id'].trim()
      ? req.headers['x-hotel-id'].trim()
      : undefined;

  if (req.user) {
    if (req.user.isCentralAdmin) {
      req.tenantHotelId = headerHotel || req.user.hotelId || 'htl-addis';
      next();
      return;
    }

    if (headerHotel && headerHotel !== req.user.hotelId) {
      res.status(403).json({
        error: 'የሌላ ሆቴል መረጃ የመጠቀም ፈቃድ የለዎትም!',
        message: 'Cross-hotel access denied for branch staff.',
      });
      return;
    }

    req.tenantHotelId = req.user.hotelId;
    next();
    return;
  }

  req.tenantHotelId = headerHotel || 'htl-addis';
  next();
}
