import { Redis } from "@upstash/redis";

export type Booking = {
  id: string;
  code: string;
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

function skopjeTime(date: string, time = "10:00") {
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

export function bookingState(booking: Booking, now = new Date(), times = { checkInTime: "10:00", checkOutTime: "10:00" }) {
  const opensAt = skopjeTime(booking.checkIn, times.checkInTime);
  const closesAt = skopjeTime(booking.checkOut, times.checkOutTime);
  const status = booking.revoked ? "revoked" : now < opensAt ? "upcoming" : now >= closesAt ? "expired" : "active";
  return { status, opensAt, closesAt } as const;
}

export async function createBooking(input: Omit<Booking, "id" | "code" | "revoked" | "createdAt">) {
  const redis = getRedis();
  let code = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomCode();
    if (!(await redis.exists(`code:${candidate}`))) { code = candidate; break; }
  }
  if (!code) throw new Error("Unable to allocate a unique code");

  const booking: Booking = { ...input, id: crypto.randomUUID(), code, revoked: false, createdAt: Date.now() };
  await Promise.all([
    redis.set(`booking:${booking.id}`, booking),
    redis.set(`code:${code}`, booking.id),
    redis.zadd("bookings", { score: booking.createdAt, member: booking.id }),
  ]);
  return booking;
}

export async function getBookingByCode(code: string) {
  const redis = getRedis();
  const storedGuide = await redis.get<Record<string, unknown>>("guest-guide");
  const testCode = String(storedGuide?.testAccessCode || "1508").trim();

  if (code.trim() === testCode) {
    const today = new Date();
    const checkIn = new Date(today.getTime() - 86400000).toISOString().split("T")[0];
    const checkOut = new Date(today.getTime() + 86400000 * 30).toISOString().split("T")[0];
    return {
      id: "test-preview-mode",
      code: testCode,
      firstName: "Test",
      lastName: "Guest",
      checkIn,
      checkOut,
      guests: 2,
      source: "Direct",
      phone: "+389 70 000 000",
      notes: "Master Test / Preview Access Code",
      revoked: false,
      createdAt: Date.now(),
    } as Booking;
  }

  const id = await redis.get<string>(`code:${code}`);
  return id ? redis.get<Booking>(`booking:${id}`) : null;
}

export async function listBookings() {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>("bookings", 0, -1, { rev: true });
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => redis.get<Booking>(`booking:${id}`)));
  return records.filter((record): record is Booking => Boolean(record));
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
  return updated;
}

export async function deleteBooking(id: string) {
  const redis = getRedis();
  const booking = await redis.get<Booking>(`booking:${id}`);
  if (!booking) return false;
  await Promise.all([redis.del(`booking:${id}`), redis.del(`code:${booking.code}`), redis.zrem("bookings", id)]);
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
  excludeId?: string
): Promise<Booking | null> {
  const allBookings = await listBookings();
  for (const booking of allBookings) {
    if (booking.revoked) continue;
    if (excludeId && booking.id === excludeId) continue;
    if (isDateRangeOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut)) {
      return booking;
    }
  }
  return null;
}
