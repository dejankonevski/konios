import { cookies } from "next/headers";
import { getHostSession, listPropertyAdmins, savePropertyAdmin } from "@/lib/access-code";
import type { PropertyAdmin } from "@/lib/access-code";

function safe(admin: PropertyAdmin) {
  return { id: admin.id, username: admin.username, propertyIds: admin.propertyIds, active: admin.active, createdAt: admin.createdAt };
}

async function masterSession() {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  return session?.role === "master" ? session : null;
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
  if (!input.propertyIds?.length) return Response.json({ error: "Assign at least one property." }, { status: 400 });
  const admin = await savePropertyAdmin({ username: input.username, password: input.password, propertyIds: input.propertyIds });
  return Response.json({ admin: safe(admin) });
}

export async function PATCH(request: Request) {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const input = (await request.json()) as { username?: string; password?: string; propertyIds?: string[]; active?: boolean };
  if (!input.username) return Response.json({ error: "Manager username is required." }, { status: 400 });
  if (input.password && input.password.length < 12) return Response.json({ error: "Manager passwords must contain at least 12 characters." }, { status: 400 });
  const admin = await savePropertyAdmin({ username: input.username, password: input.password, propertyIds: input.propertyIds || [], active: input.active });
  return Response.json({ admin: safe(admin) });
}
