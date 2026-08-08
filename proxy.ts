import { NextRequest, NextResponse } from "next/server";
import { bookingState, getBookingByToken } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";

export async function proxy(request: NextRequest) {
  const code = request.cookies.get("konios_access")?.value;
  const [booking, guide] = await Promise.all([code ? getBookingByToken(code) : null, getGuestGuide()]);
  const status = booking ? bookingState(booking, new Date(), guide).status : null;
  if (!booking || status === "expired" || status === "revoked") return NextResponse.rewrite(new URL("/access", request.url));

  if (request.nextUrl.pathname === "/apartmentpage.html") return NextResponse.rewrite(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/apartmentpage.html"] };
