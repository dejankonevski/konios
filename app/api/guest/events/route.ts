import { cookies } from "next/headers";
import { getBookingByToken, getRedis } from "@/lib/bookings";

const allowed = new Set(["arrived", "entered", "payment-placed", "parking-occupied", "help", "checked-out"]);

export async function POST(request: Request) {
  const token = (await cookies()).get("konios_access")?.value;
  const booking = token ? await getBookingByToken(token) : null;
  if (!booking) return Response.json({ error:"Unauthorized" }, { status:401 });
  const { type } = await request.json() as { type?: string };
  if (!type || !allowed.has(type)) return Response.json({ error:"Invalid event" }, { status:400 });
  const event = { id:crypto.randomUUID(), reservationId:booking.id, type, createdAt:Date.now() };
  const redis = getRedis();
  await Promise.all([redis.set(`guest-event:${event.id}`,event),redis.zadd(`guest-events:${booking.id}`,{score:event.createdAt,member:event.id})]);
  return Response.json({ ok:true });
}
