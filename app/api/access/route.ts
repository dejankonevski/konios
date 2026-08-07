import { cookies } from "next/headers";
import { bookingState, getBookingByCode } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";

export async function POST(request: Request) {
  const { code } = (await request.json()) as { code?: string };
  if (!code || !/^\d{5}$/.test(code.trim())) return Response.json({ error: "Enter your five-digit access code." }, { status: 400 });
  const booking = await getBookingByCode(code.trim());
  if (!booking) return Response.json({ error: "We couldn't find that code. Please check it and try again." }, { status: 401 });
  const guide = await getGuestGuide();
  const state = bookingState(booking, new Date(), guide);
  if (state.status === "upcoming") return Response.json({ state: "upcoming", guest: booking.firstName, availableAt: state.opensAt.toISOString() }, { status: 403 });
  if (state.status === "expired") return Response.json({ state: "expired", guest: booking.firstName, expiredAt: state.closesAt.toISOString() }, { status: 410 });
  if (state.status === "revoked") return Response.json({ error: "This code is no longer active. Please contact your host." }, { status: 403 });

  (await cookies()).set("konios_access", booking.code, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: state.closesAt });
  return Response.json({ ok: true, guest: `${booking.firstName} ${booking.lastName}` });
}

export async function DELETE() { (await cookies()).delete("konios_access"); return Response.json({ ok: true }); }
