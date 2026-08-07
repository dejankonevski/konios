import { NextRequest, NextResponse } from "next/server";
import { verifyGuestCode } from "@/lib/access-code";

export async function proxy(request: NextRequest) {
  const code = request.cookies.get("konios_access")?.value;
  const pass = code ? await verifyGuestCode(code) : null;
  if (!pass) return NextResponse.rewrite(new URL("/access", request.url));

  if (request.nextUrl.pathname === "/apartmentpage.html") return NextResponse.rewrite(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/apartmentpage.html"] };
