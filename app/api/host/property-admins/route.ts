import { cookies } from "next/headers";
import { getHostSession, listPropertyAdmins, savePropertyAdmin } from "@/lib/access-code";
import type { PropertyAdmin } from "@/lib/access-code";
import { listProperties } from "@/lib/portfolio";
import { resetRateLimit } from "@/lib/rate-limit";

function safe(admin: PropertyAdmin) {
  return { id: admin.id, username: admin.username, propertyIds: admin.propertyIds, active: admin.active, createdAt: admin.createdAt };
}

async function masterSession() {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  return session?.role === "master" ? session : null;
}

async function validPropertyIds(propertyIds?: string[]) {
  if (!propertyIds?.length) return null;
  const allowed = new Set((await listProperties()).filter((property) => property.active).map((property) => property.id));
  const unique = [...new Set(propertyIds)];
  return unique.every((id) => allowed.has(id)) ? unique : null;
}

export async function GET() {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const admins = (await listPropertyAdmins()).map(safe);
  return Response.json({ admins });
}

export async function POST(request: Request) {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const input = (await request.json()) as { username?: string; password?: string; propertyIds?: string[] };
  if (!input.username?.trim() || !/^[a-zA-Z0-9._-]{3,40}$/.test(input.username)) return Response.json({ error: "Use a username with 3–40 letters, numbers, dots, dashes or underscores." }, { status: 400 });
  if (!input.password || input.password.length < 12) return Response.json({ error: "Manager passwords must contain at least 12 characters." }, { status: 400 });
  const propertyIds = await validPropertyIds(input.propertyIds);
  if (!propertyIds) return Response.json({ error: "Assign at least one valid property." }, { status: 400 });
  const admin = await savePropertyAdmin({ username: input.username, password: input.password, propertyIds });
  return Response.json({ admin: safe(admin) });
}

export async function PATCH(request: Request) {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const input = (await request.json()) as { username?: string; password?: string; propertyIds?: string[]; active?: boolean };
  if (!input.username) return Response.json({ error: "Manager username is required." }, { status: 400 });
  if (input.password && input.password.length < 12) return Response.json({ error: "Manager passwords must contain at least 12 characters." }, { status: 400 });
  const propertyIds = await validPropertyIds(input.propertyIds);
  if (!propertyIds) return Response.json({ error: "Assign at least one valid property." }, { status: 400 });
  const admin = await savePropertyAdmin({ username: input.username, password: input.password, propertyIds, active: input.active });
  return Response.json({ admin: safe(admin) });
}

export async function DELETE(request: Request) {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const input = (await request.json()) as { username?: string };
  const username = input.username?.trim().toLowerCase();
  if (!username || !/^[a-zA-Z0-9._-]{3,40}$/.test(username)) return Response.json({ error: "A valid manager username is required." }, { status: 400 });
  await resetRateLimit("host-login-user", username, 15 * 60);
  return Response.json({ ok: true, username });
}
