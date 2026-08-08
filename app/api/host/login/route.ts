import { cookies } from "next/headers";
import { createHostToken, revokeHostToken } from "@/lib/access-code";
import { rateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await rateLimit("host-login", requestIp(request), 5, 15 * 60);
  if (!limited.success) return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900" } });
  const { password } = (await request.json()) as { password?: string };
  const configured = process.env.HOST_PASSWORD;
  if (!configured) return Response.json({ error: "Host login is temporarily disabled until a secure password is configured." }, { status: 503 });
  if (!password || password.length !== configured.length) return Response.json({ error: "Incorrect password." }, { status: 401 });
  let mismatch = 0;
  for (let index = 0; index < password.length; index += 1) mismatch |= password.charCodeAt(index) ^ configured.charCodeAt(index);
  if (mismatch !== 0) return Response.json({ error: "Incorrect password." }, { status: 401 });

  (await cookies()).set("konios_host", await createHostToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  await revokeHostToken(store.get("konios_host")?.value);
  store.delete("konios_host");
  return Response.json({ ok: true });
}
