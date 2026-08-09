import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { bookingState, createBooking, findOverlappingBooking, listBookings } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";

async function authorized() {
  return getHostSession((await cookies()).get("konios_host")?.value);
}

export async function GET(request: Request) {
  const session = await authorized();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const requestedProperty = new URL(request.url).searchParams.get("propertyId") || (session.role === "property-admin" ? session.propertyIds[0] : "konios-house");
  if (session.role !== "master" && !session.propertyIds.includes(requestedProperty)) return Response.json({ error: "Property access denied." }, { status: 403 });
  const [records, guide] = await Promise.all([listBookings(requestedProperty), getGuestGuide(requestedProperty)]);
  const bookings = records.map((booking) => { const state = bookingState(booking, new Date(), guide); return { ...booking, accessStatus: state.status, stayStage: state.stayStage }; });
  return Response.json({ bookings, times: { checkInTime: guide.checkInTime, checkOutTime: guide.checkOutTime, portalLeadHours: guide.portalLeadHours, sensitiveRevealMinutes: guide.sensitiveRevealMinutes, accessExpiryMinutes: guide.accessExpiryMinutes } });
}

export async function POST(request: Request) {
  const data = (await request.json()) as Record<string, string>;
  const session = await authorized();
  if (!session) return Response.json({ error: "Your host session has expired. Sign in again." }, { status: 401 });
  const propertyId = data.propertyId || (session.role === "property-admin" ? session.propertyIds[0] : "konios-house");
  if (session.role !== "master" && !session.propertyIds.includes(propertyId)) return Response.json({ error: "Property access denied." }, { status: 403 });

  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const checkIn = data.checkIn;
  const checkOut = data.checkOut;
  if (!firstName || !lastName || !checkIn || !checkOut) return Response.json({ error: "Complete every field." }, { status: 400 });
  if (new Date(checkOut).getTime() <= new Date(checkIn).getTime()) return Response.json({ error: "Check-out date must be after check-in date." }, { status: 400 });

  const conflict = await findOverlappingBooking(checkIn, checkOut, undefined, propertyId);
  if (conflict) {
    return Response.json(
      {
        error: `Dates overlap with an existing booking for ${conflict.firstName} ${conflict.lastName} (${conflict.checkIn} to ${conflict.checkOut}).`,
        conflictBooking: conflict,
      },
      { status: 409 }
    );
  }

  const booking = await createBooking({
    propertyId,
    unitId: `${propertyId}-unit`,
    firstName, lastName, checkIn, checkOut,
    guests: Math.max(1, Math.min(12, Number(data.guests) || 1)),
    source: (["Airbnb", "Booking.com", "Direct", "Other"].includes(data.source) ? data.source : "Other") as "Airbnb" | "Booking.com" | "Direct" | "Other",
    phone: data.phone?.trim() ?? "",
    notes: data.notes?.trim() ?? "",
    grossAmount: Math.max(0, Number(data.grossAmount) || 0),
    netAmount: Math.max(0, Number(data.netAmount) || 0),
    currency: data.currency?.trim().toUpperCase() || "EUR",
    paymentCollected: Math.max(0, Number(data.paymentCollected) || 0),
    idRegistrationComplete: Boolean(data.idRegistrationComplete),
    hasCleaningAgency: Boolean(data.hasCleaningAgency),
    cleaningFeeMkd: Math.max(0, Number(data.cleaningFeeMkd) || 750),
    cleaningStatus: data.cleaningStatus === "completed" ? "completed" : "scheduled",
    cleaningNotes: data.cleaningNotes?.trim() ?? "",
    isNoShow: Boolean(data.isNoShow),
  });
  return Response.json({ ...booking, guest: `${firstName} ${lastName}` });
}
