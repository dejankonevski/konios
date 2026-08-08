import { cookies } from "next/headers";
import { bookingState, getBookingByToken } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import { rateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimit("guest-access", requestIp(request), 8, 10 * 60);
  if (!limited.success) return Response.json({ error: "Too many attempts. Please wait 10 minutes or contact your host." }, { status: 429, headers: { "Retry-After": "600" } });
  const { code, token } = (await request.json()) as { code?: string; token?: string };
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return Response.json({ error: "Open the private reservation link sent by your host." }, { status: 400 });
  if (!code || !/^\d{5}$/.test(code.trim())) return Response.json({ error: "Enter your five-digit PIN." }, { status: 400 });
  const booking = await getBookingByToken(token);
  if (!booking || booking.code !== code.trim()) return Response.json({ error: "That private link and PIN do not match." }, { status: 401 });
  const guide = await getGuestGuide(booking.propertyId || "konios-house");
  const state = bookingState(booking, new Date(), guide);
  if (state.status === "upcoming") return Response.json({ state: "upcoming", guest: booking.firstName, availableAt: state.portalOpensAt.toISOString() }, { status: 403 });
  if (state.status === "expired") return Response.json({ state: "expired", guest: booking.firstName, expiredAt: state.closesAt.toISOString() }, { status: 410 });
  if (state.status === "revoked") return Response.json({ error: "This code is no longer active. Please contact your host." }, { status: 403 });

  (await cookies()).set("konios_access", booking.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", expires: state.closesAt });
  return Response.json({ ok: true, stage: state.stayStage, guest: `${booking.firstName} ${booking.lastName}` });
}

export async function DELETE() { (await cookies()).delete("konios_access"); return Response.json({ ok: true }); }
