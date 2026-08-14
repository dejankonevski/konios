import { Redis } from "@upstash/redis";

export type Booking = {
  id: string;
  propertyId?: string;
  unitId?: string;
  guestId?: string;
  code: string;
  accessToken: string;
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: "Airbnb" | "Booking.com" | "Direct" | "Other";
  phone?: string;
  notes: string;
  revoked: boolean;
  createdAt: number;
  grossAmount?: number;
  netAmount?: number;
  currency?: string;
  paymentCollected?: number;
  idRegistrationComplete?: boolean;
  archivedAt?: number | null;
  hasCleaningAgency?: boolean;
  cleaningType?: "agency" | "self";
  cleaningFeeMkd?: number;
  cleaningStatus?: "scheduled" | "completed";
  cleaningNotes?: string;
  isNoShow?: boolean;
  expectedArrivalTime?: string;
  expectedDepartureTime?: string;
  touristTaxAmount?: number;
  icalUid?: string;
};

export function getRedis() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Booking storage is not configured");
  return new Redis({ url, token });
}

function randomCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(10000 + (values[0] % 90000));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function skopjeTime(date: string, time = "15:00") {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const approximate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(approximate).map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(approximate.getTime() - (representedAsUtc - approximate.getTime()));
}

type AccessTiming = {
  checkInTime: string;
  checkOutTime: string;
  portalLeadHours?: number;
  sensitiveRevealMinutes?: number;
  accessExpiryMinutes?: number;
};

export function bookingState(booking: Booking, now = new Date(), times: AccessTiming = { checkInTime: "15:00", checkOutTime: "10:00" }) {
  const checkInAt = skopjeTime(booking.checkIn, times.checkInTime);
  const checkoutAt = skopjeTime(booking.checkOut, booking.expectedDepartureTime || times.checkOutTime);
  const portalLeadHours = Number.isFinite(Number(times.portalLeadHours)) ? Number(times.portalLeadHours) : 48;
  const sensitiveRevealMinutes = Number.isFinite(Number(times.sensitiveRevealMinutes)) ? Number(times.sensitiveRevealMinutes) : 30;
  const accessExpiryMinutes = Number.isFinite(Number(times.accessExpiryMinutes)) ? Number(times.accessExpiryMinutes) : 30;
  const portalOpensAt = new Date(checkInAt.getTime() - portalLeadHours * 60 * 60 * 1000);
  const accessDetailsAt = new Date(checkInAt.getTime() - sensitiveRevealMinutes * 60 * 1000);
  const closesAt = new Date(checkoutAt.getTime() + accessExpiryMinutes * 60 * 1000);
  const checkoutDayStartsAt = skopjeTime(booking.checkOut, "00:00");
  const status = booking.revoked ? "revoked" : now < portalOpensAt ? "upcoming" : now >= closesAt ? "expired" : "active";
  const stayStage = now < accessDetailsAt
    ? "before-arrival"
    : now < checkInAt
      ? "arrival-ready"
      : now >= checkoutAt
        ? "after-departure"
        : now >= checkoutDayStartsAt
          ? "checkout-day"
          : "during-stay";
  return {
    status,
    stayStage,
    portalOpensAt,
    accessDetailsAt,
    revealAccess: now >= accessDetailsAt && now < closesAt,
    checkInAt,
    checkoutAt,
    closesAt,
  } as const;
}

export async function createBooking(input: Omit<Booking, "id" | "code" | "accessToken" | "revoked" | "createdAt">) {
  const redis = getRedis();
  let code = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomCode();
    if (!(await redis.exists(`code:${candidate}`))) { code = candidate; break; }
  }
  if (!code) throw new Error("Unable to allocate a unique code");

  const booking: Booking = { propertyId: "konios-house", unitId: "konios-house-32", guestId: crypto.randomUUID(), currency: "EUR", paymentCollected: 0, idRegistrationComplete: false, ...input, id: crypto.randomUUID(), code, accessToken: randomToken(), revoked: false, createdAt: Date.now() };
  await Promise.all([
    redis.set(`booking:${booking.id}`, booking),
    redis.set(`code:${code}`, booking.id),
    redis.set(`access-token:${booking.accessToken}`, booking.id),
    redis.zadd("bookings", { score: booking.createdAt, member: booking.id }),
  ]);
  await logAudit("reservation.created", booking.id, { guest: `${booking.firstName} ${booking.lastName}` });
  return booking;
}

async function logAudit(action: string, entityId: string, details: Record<string, unknown> = {}) {
  const redis = getRedis();
  const event = { id: crypto.randomUUID(), action, entityId, actor: "authenticated-host", details, createdAt: Date.now() };
  await Promise.all([redis.set(`audit:${event.id}`, event), redis.zadd("audit-events", { score: event.createdAt, member: event.id })]);
}

export async function getBookingByCode(code: string) {
  const redis = getRedis();
  const id = await redis.get<string>(`code:${code}`);
  return id ? redis.get<Booking>(`booking:${id}`) : null;
}

export async function getBookingByToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const redis = getRedis();
  const id = await redis.get<string>(`access-token:${token}`);
  return id ? redis.get<Booking>(`booking:${id}`) : null;
}

export async function getBookingById(id: string) {
  return getRedis().get<Booking>(`booking:${id}`);
}

export async function listBookings(propertyId?: string) {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>("bookings", 0, -1, { rev: true });
  if (!ids.length) return [];
  const records = (await Promise.all(ids.map((id) => redis.get<Booking>(`booking:${id}`)))).filter((record): record is Booking => Boolean(record));
  await Promise.all(records.map(async (record) => {
    if (record.accessToken) return;
    record.accessToken = randomToken();
    await Promise.all([redis.set(`booking:${record.id}`, record), redis.set(`access-token:${record.accessToken}`, record.id)]);
  }));
  return records.filter((record) => {
    if (record.archivedAt) return false;
    if (propertyId && (record.propertyId || "konios-house") !== propertyId) return false;
    
    const fName = (record.firstName || "").toUpperCase();
    const notes = (record.notes || "").toUpperCase();
    if (fName.includes("CLOSED") || fName.includes("NOT AVAILABLE") || fName.includes("BLOCKED") ||
        notes.includes("CLOSED") || notes.includes("NOT AVAILABLE") || notes.includes("BLOCKED")) {
      return false;
    }
    
    return true;
  });
}

export async function updateBooking(
  id: string,
  updates: Partial<Omit<Booking, "id" | "code" | "createdAt">>
) {
  const redis = getRedis();
  const booking = await redis.get<Booking>(`booking:${id}`);
  if (!booking) return null;
  const updated: Booking = { ...booking, ...updates };
  await redis.set(`booking:${id}`, updated);
  await logAudit("reservation.updated", id, { fields: Object.keys(updates) });
  return updated;
}

export async function deleteBooking(id: string) {
  const redis = getRedis();
  const booking = await redis.get<Booking>(`booking:${id}`);
  if (!booking) return false;
  const archived: Booking = { ...booking, revoked: true, archivedAt: Date.now() };
  await redis.set(`booking:${id}`, archived);
  await logAudit("reservation.archived", id, { guest: `${booking.firstName} ${booking.lastName}` });
  return true;
}

export function isDateRangeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA < endB && endA > startB;
}

export async function findOverlappingBooking(
  checkIn: string,
  checkOut: string,
  excludeId?: string,
  propertyId?: string,
): Promise<Booking | null> {
  const allBookings = await listBookings(propertyId);
  for (const booking of allBookings) {
    if (booking.revoked) continue;
    if (excludeId && booking.id === excludeId) continue;
    if (isDateRangeOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut)) {
      return booking;
    }
  }
  return null;
}
