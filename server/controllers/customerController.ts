import type { Request, Response } from 'express';
import { readDb, writeDb } from '../config/database.ts';
import { appendActivityLog, resolveHotelId, resolveStaff } from '../models/ActivityLog.ts';
import type {
  CustomerInquiry,
  CustomerProfile,
  InquiryCategory,
  InquiryStatus,
  RoomType,
} from '../../src/types/hotel.ts';

export function listCustomers(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const db = readDb();

  let customers = db.customers.filter((c) => c.hotelId === hotelId);
  if (query) {
    customers = customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.idNumber.toLowerCase().includes(query) ||
        c.company.toLowerCase().includes(query)
    );
  }
  res.json(customers);
}

export function registerCustomer(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const {
    fullName,
    phone,
    email,
    idType,
    idNumber,
    nationality,
    cityOrAddress,
    company,
    preferences,
    staffId,
  } = req.body as {
    fullName?: string;
    phone?: string;
    email?: string;
    idType?: CustomerProfile['idType'];
    idNumber?: string;
    nationality?: string;
    cityOrAddress?: string;
    company?: string;
    preferences?: string;
    staffId?: string;
  };

  if (!fullName?.trim() || !phone?.trim() || !idNumber?.trim()) {
    res.status(400).json({ error: 'Customer full name, phone number, and ID/Passport number are required.' });
    return;
  }

  const db = readDb();
  const duplicate = db.customers.find(
    (c) =>
      c.hotelId === hotelId &&
      c.idNumber.trim().toLowerCase() === idNumber.trim().toLowerCase()
  );
  if (duplicate) {
    res.status(409).json({
      error: `Customer with ID ${idNumber.trim()} is already registered (${duplicate.fullName}).`,
    });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const customer: CustomerProfile = {
    id: `cust-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    fullName: fullName.trim(),
    phone: phone.trim(),
    email: email?.trim() || '',
    idType: idType || 'National ID',
    idNumber: idNumber.trim(),
    nationality: nationality?.trim() || 'Ethiopian',
    cityOrAddress: cityOrAddress?.trim() || '',
    company: company?.trim() || '',
    preferences: preferences?.trim() || '',
    totalStays: 0,
    lastVisitAt: null,
    registeredBy: actor.name,
    createdAt: new Date().toISOString(),
  };

  db.customers = [customer, ...db.customers];
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Registered customer profile: ${customer.fullName} (${customer.idNumber})`,
    amharicAction: `አዲስ የከስተመር መዝገብ ፈጥረዋል: ${customer.fullName} (${customer.idNumber})`,
    targetRef: customer.idNumber,
    details: `${customer.phone}${customer.company ? ` · ${customer.company}` : ''}`,
  });

  res.status(201).json(customer);
}

export function updateCustomer(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { phone, email, cityOrAddress, company, preferences, staffId } = req.body as Partial<CustomerProfile> & {
    staffId?: string;
  };

  const db = readDb();
  const idx = db.customers.findIndex((c) => c.id === id && c.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Customer profile not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const customer = db.customers[idx];
  if (typeof phone === 'string' && phone.trim()) customer.phone = phone.trim();
  if (typeof email === 'string') customer.email = email.trim();
  if (typeof cityOrAddress === 'string') customer.cityOrAddress = cityOrAddress.trim();
  if (typeof company === 'string') customer.company = company.trim();
  if (typeof preferences === 'string') customer.preferences = preferences.trim();

  db.customers[idx] = customer;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Updated customer info for ${customer.fullName}`,
    amharicAction: `የከስተመር ${customer.fullName}ን መረጃ አዘምነዋል`,
    targetRef: customer.idNumber,
    details: customer.preferences || customer.phone,
  });

  res.json(customer);
}

export function listInquiries(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const db = readDb();
  res.json(db.inquiries.filter((inq) => inq.hotelId === hotelId));
}

export function createInquiry(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const {
    customerId,
    contactName,
    contactPhone,
    category,
    channel,
    subject,
    details,
    preferredRoomType,
    staffId,
  } = req.body as {
    customerId?: string | null;
    contactName?: string;
    contactPhone?: string;
    category?: InquiryCategory;
    channel?: CustomerInquiry['channel'];
    subject?: string;
    details?: string;
    preferredRoomType?: RoomType | 'Any';
    staffId?: string;
  };

  if (!contactName?.trim() || !contactPhone?.trim() || !subject?.trim()) {
    res.status(400).json({ error: 'Contact name, phone, and inquiry subject are required.' });
    return;
  }

  const db = readDb();
  const actor = resolveStaff(hotelId, staffId);
  const inquiry: CustomerInquiry = {
    id: `inq-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    hotelId,
    customerId: customerId || null,
    contactName: contactName.trim(),
    contactPhone: contactPhone.trim(),
    category: category || 'Room Inquiry',
    channel: channel || 'Walk-In',
    subject: subject.trim(),
    details: details?.trim() || '',
    preferredRoomType: preferredRoomType || 'Any',
    status: 'Open',
    receivedBy: actor.name,
    handledBy: null,
    responseNotes: '',
    createdAt: new Date().toISOString(),
    handledAt: null,
  };

  db.inquiries = [inquiry, ...db.inquiries];
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Logged ${inquiry.category} (${inquiry.channel}) from ${inquiry.contactName}`,
    amharicAction: `ከ${inquiry.contactName} የመጣ ${inquiry.category} መረጃ መዝግበዋል`,
    targetRef: inquiry.id,
    details: inquiry.subject,
  });

  res.status(201).json(inquiry);
}

export function updateInquiryStatus(req: Request, res: Response): void {
  const hotelId = resolveHotelId(req);
  const { id } = req.params;
  const { status, responseNotes, staffId } = req.body as {
    status?: InquiryStatus;
    responseNotes?: string;
    staffId?: string;
  };

  if (!status || !['Open', 'Handled'].includes(status)) {
    res.status(400).json({ error: 'Invalid inquiry status' });
    return;
  }

  const db = readDb();
  const idx = db.inquiries.findIndex((i) => i.id === id && i.hotelId === hotelId);
  if (idx === -1) {
    res.status(404).json({ error: 'Inquiry not found in this hotel.' });
    return;
  }

  const actor = resolveStaff(hotelId, staffId);
  const inquiry = db.inquiries[idx];
  inquiry.status = status;
  if (typeof responseNotes === 'string') {
    inquiry.responseNotes = responseNotes.trim();
  }
  if (status === 'Handled') {
    inquiry.handledBy = actor.name;
    inquiry.handledAt = new Date().toISOString();
  } else {
    inquiry.handledBy = null;
    inquiry.handledAt = null;
  }

  db.inquiries[idx] = inquiry;
  writeDb(db);

  appendActivityLog({
    hotelId,
    staffId: actor.id,
    portal: 'Reception',
    action: `Marked inquiry ${inquiry.id} (${inquiry.contactName}) as ${status}`,
    amharicAction: `የከስተመር መረጃ ${inquiry.id} (${inquiry.contactName}) ሁኔታን ${status} አድርገዋል`,
    targetRef: inquiry.id,
    details: inquiry.responseNotes || inquiry.subject,
  });

  res.json(inquiry);
}
