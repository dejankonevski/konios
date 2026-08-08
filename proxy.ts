import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/apartmentpage.html") return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/apartmentpage.html"] };
