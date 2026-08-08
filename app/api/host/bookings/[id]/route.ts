import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { findOverlappingBooking, deleteBooking, updateBooking } from "@/lib/bookings";

async function authorized() { return verifyHostToken((await cookies()).get("konios_host")?.value); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};

  if (typeof body.firstName === "string" && body.firstName.trim()) updates.firstName = body.firstName.trim();
  if (typeof body.lastName === "string" && body.lastName.trim()) updates.lastName = body.lastName.trim();
  if (typeof body.guests === "number" && body.guests > 0) updates.guests = Math.floor(body.guests);
  if (typeof body.phone === "string") updates.phone = body.phone.trim();
  if (typeof body.notes === "string") updates.notes = body.notes.trim();
  if (typeof body.revoked === "boolean") updates.revoked = body.revoked;
  if (["Airbnb", "Booking.com", "Direct", "Other"].includes(body.source)) updates.source = body.source;
  if (typeof body.grossAmount === "number") updates.grossAmount = Math.max(0, body.grossAmount);
  if (typeof body.netAmount === "number") updates.netAmount = Math.max(0, body.netAmount);
  if (typeof body.hasCleaningAgency === "boolean") updates.hasCleaningAgency = body.hasCleaningAgency;
  if (typeof body.cleaningFeeMkd === "number") updates.cleaningFeeMkd = Math.max(0, body.cleaningFeeMkd);
  if (["scheduled", "completed"].includes(body.cleaningStatus)) updates.cleaningStatus = body.cleaningStatus;
  if (typeof body.cleaningNotes === "string") updates.cleaningNotes = body.cleaningNotes.trim();
  if (typeof body.isNoShow === "boolean") updates.isNoShow = body.isNoShow;

  if (typeof body.checkIn === "string" && typeof body.checkOut === "string") {
    if (body.checkIn >= body.checkOut) {
      return Response.json({ error: "Checkout date must be after arrival date." }, { status: 400 });
    }
    const conflict = await findOverlappingBooking(body.checkIn, body.checkOut, id);
    if (conflict) {
      return Response.json(
        {
          error: "Selected dates overlap with an existing booking.",
          conflictBooking: conflict,
        },
        { status: 409 }
      );
    }
    updates.checkIn = body.checkIn;
    updates.checkOut = body.checkOut;
  }

  const booking = await updateBooking(id, updates);
  return booking ? Response.json({ booking }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return (await deleteBooking(id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
