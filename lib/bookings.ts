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
  notes: string;
  revoked: boolean;
  createdAt: number;
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

function skopjeTime(date: string, hour = 10) {
  const [year, month, day] = date.split("-").map(Number);
  const approximate = new Date(Date.UTC(year, month - 1, day, hour));
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(approximate).map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(approximate.getTime() - (representedAsUtc - approximate.getTime()));
}

export function bookingState(booking: Booking, now = new Date()) {
  const opensAt = skopjeTime(booking.checkIn);
  const closesAt = skopjeTime(booking.checkOut);
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

export async function updateBooking(id: string, updates: Partial<Pick<Booking, "notes" | "revoked">>) {
  const redis = getRedis();
  const booking = await redis.get<Booking>(`booking:${id}`);
  if (!booking) return null;
  const updated = { ...booking, ...updates };
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
