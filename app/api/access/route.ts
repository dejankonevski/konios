import { cookies } from "next/headers";
import { bookingState, getBookingByCode } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import { getPropertyById, getPropertyBySlug } from "@/lib/portfolio";
import { rateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimit("guest-access", requestIp(request), 8, 10 * 60);
  if (!limited.success) return Response.json({ error: "Too many attempts. Please wait 10 minutes or contact your host." }, { status: 429, headers: { "Retry-After": "600" } });
  const { code, propertySlug } = (await request.json()) as { code?: string; propertySlug?: string };
  if (!code || !/^\d{5}$/.test(code.trim())) return Response.json({ error: "Enter your five-digit PIN." }, { status: 400 });
  const booking = await getBookingByCode(code.trim());
  const property = propertySlug ? await getPropertyBySlug(propertySlug) : null;
  if (!booking || (propertySlug && (!property || (booking.propertyId || "konios-house") !== property.id))) return Response.json({ error: "That guest PIN is not valid for this property." }, { status: 401 });
  const guide = await getGuestGuide(booking.propertyId || "konios-house");
  const state = bookingState(booking, new Date(), guide);
  if (state.status === "upcoming") return Response.json({ state: "upcoming", guest: booking.firstName, availableAt: state.portalOpensAt.toISOString() }, { status: 403 });
  if (state.status === "expired") return Response.json({ state: "expired", guest: booking.firstName, expiredAt: state.closesAt.toISOString() }, { status: 410 });
  if (state.status === "revoked") return Response.json({ error: "This code is no longer active. Please contact your host." }, { status: 403 });

  (await cookies()).set("konios_access", booking.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 90 });
  const bookingProperty = await getPropertyById(booking.propertyId || "konios-house");
  return Response.json({ ok: true, stage: state.stayStage, guest: `${booking.firstName} ${booking.lastName}`, propertySlug: bookingProperty?.slug || "konios-house" });
}

export async function DELETE() { (await cookies()).delete("konios_access"); return Response.json({ ok: true }); }
