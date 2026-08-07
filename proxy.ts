import { NextRequest, NextResponse } from "next/server";
import { bookingState, getBookingByCode } from "@/lib/bookings";

export async function proxy(request: NextRequest) {
  const code = request.cookies.get("konios_access")?.value;
  const booking = code ? await getBookingByCode(code) : null;
  if (!booking || bookingState(booking).status !== "active") return NextResponse.rewrite(new URL("/access", request.url));

  if (request.nextUrl.pathname === "/apartmentpage.html") return NextResponse.rewrite(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/apartmentpage.html"] };
