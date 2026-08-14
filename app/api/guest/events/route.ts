import { cookies } from "next/headers";
import { getBookingByToken, getRedis, listBookings } from "@/lib/bookings";
import { sendCleaningAlert } from "@/lib/cleaning-alerts";
import { sendGuestCheckInAlert } from "@/lib/check-in-alerts";
import { getGuestGuide } from "@/lib/guest-guide";
import { getPropertyById } from "@/lib/portfolio";

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
  if (type === "checked-out") {
    try {
      const propertyId = booking.propertyId || "konios-house";
      const property = await getPropertyById(propertyId);
      if (property) {
        const [bookings, guide] = await Promise.all([listBookings(propertyId), getGuestGuide(propertyId)]);
        await sendCleaningAlert({ property, departure: booking, bookings, guide, trigger: "guest-checkout" });
      }
    } catch (error) {
      console.error("Failed to send checkout cleaning alert:", error);
    }
  }
  if (type === "arrived" || type === "entered") {
    try {
      const propertyId = booking.propertyId || "konios-house";
      const property = await getPropertyById(propertyId);
      if (property) {
        const guide = await getGuestGuide(propertyId);
        await sendGuestCheckInAlert({ property, booking, guide });
      }
    } catch (error) {
      console.error("Failed to send guest check-in alert:", error);
    }
  }
  return Response.json({ ok:true });
}
