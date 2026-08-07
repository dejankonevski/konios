import { createGuestCode } from "@/lib/access-code";

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(request: Request) {
  const data = (await request.json()) as Record<string, string>;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return Response.json({ error: "Host access is not configured." }, { status: 503 });
  if (!data.password || !safeEqual(data.password, adminPassword)) return Response.json({ error: "Incorrect host password." }, { status: 401 });

  const firstName = data.firstName?.trim();
  const lastName = data.lastName?.trim();
  const checkIn = data.checkIn;
  const checkOut = data.checkOut;
  if (!firstName || !lastName || !checkIn || !checkOut) return Response.json({ error: "Complete every field." }, { status: 400 });
  if (new Date(checkOut).getTime() < new Date(checkIn).getTime()) return Response.json({ error: "Check-out must be after check-in." }, { status: 400 });

  const code = await createGuestCode({ firstName, lastName, checkIn, checkOut, issuedAt: Date.now() });
  return Response.json({ code, guest: `${firstName} ${lastName}`, checkIn, checkOut });
}
