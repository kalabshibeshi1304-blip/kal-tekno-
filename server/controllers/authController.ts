import type { Request, Response } from 'express';
import { readDb } from '../config/database.ts';
import { signAuthToken } from '../middleware/authMiddleware.ts';
import { appendActivityLog } from '../models/ActivityLog.ts';
import type { AuthenticatedSessionUser } from '../../src/types/hotel.ts';

export function loginWithPin(req: Request, res: Response): void {
  const { hotelId, userId, pinCode } = req.body as {
    hotelId?: string;
    userId?: string;
    pinCode?: string;
  };

  if (!hotelId?.trim() || !pinCode?.trim()) {
    res.status(400).json({
      error: 'እባክዎ ሆቴል እና የሰራተኛ PIN ያስገቡ።',
      message: 'Hotel and staff PIN are required.',
    });
    return;
  }

  const cleanHotelId = hotelId.trim();
  const db = readDb();
  const isCentralLogin = cleanHotelId === 'central' || userId?.trim() === 'central-admin-1';
  const scopeUsers = isCentralLogin
    ? db.users.filter((u) => u.hotelId === 'central')
    : db.users.filter((u) => u.hotelId === cleanHotelId);

  if (scopeUsers.length === 0) {
    res.status(404).json({
      error: 'የተመረጠው ሆቴል አልተገኘም።',
      message: 'Selected hotel property not found.',
    });
    return;
  }

  const cleanPin = pinCode.trim();
  const matchedUser = userId?.trim()
    ? scopeUsers.find((u) => u.id === userId.trim() && u.pinCode === cleanPin)
    : scopeUsers.find((u) => u.pinCode === cleanPin);

  if (!matchedUser) {
    res.status(401).json({
      error: isCentralLogin
        ? 'የተሳሳተ የዋና አድሚን PIN ነው! እባክዎ ትክክለኛውን ኮድ (9999) ያስገቡ።'
        : 'የተሳሳተ የሰራተኛ PIN ነው! እባክዎ ትክክለኛውን ኮድ ያስገቡ።',
      message: 'Invalid PIN code.',
    });
    return;
  }

  const isCentralAdmin = matchedUser.hotelId === 'central';
  const effectiveHotelId = isCentralAdmin ? db.hotels[0]?.id || 'htl-addis' : matchedUser.hotelId;

  const sessionUser: AuthenticatedSessionUser = {
    userId: matchedUser.id,
    hotelId: effectiveHotelId,
    role: matchedUser.role,
    name: matchedUser.name,
    amharicName: matchedUser.amharicName,
    departmentLabel: matchedUser.departmentLabel,
    isCentralAdmin,
  };

  const token = signAuthToken(sessionUser);

  appendActivityLog({
    hotelId: effectiveHotelId,
    staffId: matchedUser.id,
    portal: 'System',
    action: `${matchedUser.name} (${matchedUser.role}) authenticated via PIN`,
    amharicAction: `${matchedUser.amharicName} በPIN ወደ ቃል ቴክኖ ሲስተም ገብተዋል`,
    targetRef: matchedUser.departmentLabel,
    details: sessionUser.isCentralAdmin ? 'Kal Tekno Central Server Admin Session' : 'Branch Staff Session',
  });

  res.json({ token, user: sessionUser });
}

export function getCurrentSession(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({
      error: 'ዕንቅፋት: ምንም ፈቃድ (Token) አልተገኘም!',
      message: 'ዕንቅፋት: ምንም ፈቃድ (Token) አልተገኘም!',
    });
    return;
  }
  res.json({ user: req.user });
}
