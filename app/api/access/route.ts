import { cookies } from "next/headers";
import { verifyGuestCode } from "@/lib/access-code";

export async function POST(request: Request) {
  const { code } = (await request.json()) as { code?: string };
  if (!code) return Response.json({ error: "Enter your access code." }, { status: 400 });

  const pass = await verifyGuestCode(code);
  if (!pass) return Response.json({ error: "That code is invalid or has expired." }, { status: 401 });

  const expires = new Date(`${pass.checkOut}T23:59:59.999Z`);
  (await cookies()).set("konios_access", code.trim(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });

  return Response.json({ ok: true, guest: `${pass.firstName} ${pass.lastName}` });
}

export async function DELETE() {
  (await cookies()).delete("konios_access");
  return Response.json({ ok: true });
}
