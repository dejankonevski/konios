import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { bookingState, createBooking, findOverlappingBooking, listBookings } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";

async function authorized() {
  return verifyHostToken((await cookies()).get("konios_host")?.value);
}

export async function GET() {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [records, guide] = await Promise.all([listBookings(), getGuestGuide()]);
  const bookings = records.map((booking) => ({ ...booking, accessStatus: bookingState(booking, new Date(), guide).status }));
  return Response.json({ bookings, times: { checkInTime: guide.checkInTime, checkOutTime: guide.checkOutTime } });
}

export async function POST(request: Request) {
  const data = (await request.json()) as Record<string, string>;
  if (!(await authorized())) return Response.json({ error: "Your host session has expired. Sign in again." }, { status: 401 });

  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const checkIn = data.checkIn;
  const checkOut = data.checkOut;
  if (!firstName || !lastName || !checkIn || !checkOut) return Response.json({ error: "Complete every field." }, { status: 400 });
  if (new Date(checkOut).getTime() <= new Date(checkIn).getTime()) return Response.json({ error: "Check-out date must be after check-in date." }, { status: 400 });

  const conflict = await findOverlappingBooking(checkIn, checkOut);
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
    firstName, lastName, checkIn, checkOut,
    guests: Math.max(1, Math.min(12, Number(data.guests) || 1)),
    source: (["Airbnb", "Booking.com", "Direct", "Other"].includes(data.source) ? data.source : "Other") as "Airbnb" | "Booking.com" | "Direct" | "Other",
    notes: data.notes?.trim() ?? "",
  });
  return Response.json({ ...booking, guest: `${firstName} ${lastName}` });
}
