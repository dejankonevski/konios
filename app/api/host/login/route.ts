import { cookies } from "next/headers";
import { createHostToken, revokeHostToken, verifyMasterPassword, verifyPropertyAdminPassword } from "@/lib/access-code";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { username, password } = (await request.json()) as { username?: string; password?: string };
  const normalizedUsername = username?.trim().toLowerCase() || "master";
  const isMaster = normalizedUsername === "master";
  const lockoutSeconds = isMaster ? 60 : 15 * 60;
  const limited = await rateLimit(isMaster ? "host-login-master" : "host-login-user", normalizedUsername, isMaster ? 10 : 5, lockoutSeconds);
  if (!limited.success) return Response.json({ error: isMaster ? "Too many attempts. Try again in one minute." : "Too many attempts. Ask the master administrator to reset your login attempts." }, { status: 429, headers: { "Retry-After": String(lockoutSeconds) } });
  if (!password) return Response.json({ error: "Enter your password." }, { status: 400 });
  const admin = normalizedUsername === "master" ? null : await verifyPropertyAdminPassword(normalizedUsername, password);
  const master = normalizedUsername === "master" && await verifyMasterPassword(password);
  if (!master && !admin) return Response.json({ error: "Incorrect username or password." }, { status: 401 });

  const session = master
    ? { id: "master", role: "master" as const, username: "master", propertyIds: [] }
    : { id: admin!.id, role: "property-admin" as const, username: admin!.username, propertyIds: admin!.propertyIds };

  await resetRateLimit(isMaster ? "host-login-master" : "host-login-user", normalizedUsername, lockoutSeconds);

  (await cookies()).set("konios_host", await createHostToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ ok: true, session: { role: session.role, username: session.username, propertyIds: session.propertyIds } });
}

export async function DELETE() {
  const store = await cookies();
  await revokeHostToken(store.get("konios_host")?.value);
  store.delete("konios_host");
  return Response.json({ ok: true });
}
