import { cookies } from "next/headers";
import { getHostSession, getPropertyAdmin, revokeHostSessions, savePropertyAdmin, setMasterPassword, verifyMasterPassword, verifyPropertyAdminPassword } from "@/lib/access-code";

export async function PUT(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { currentPassword, newPassword } = (await request.json()) as { currentPassword?: string; newPassword?: string };
  if (!newPassword || newPassword.length < 12) return Response.json({ error: "Use at least 12 characters for the new password." }, { status: 400 });
  const currentValid = session.role === "master"
    ? Boolean(currentPassword && await verifyMasterPassword(currentPassword))
    : Boolean(currentPassword && await verifyPropertyAdminPassword(session.username, currentPassword));
  if (!currentValid) return Response.json({ error: "Current password is incorrect." }, { status: 401 });
  if (session.role === "master") { await setMasterPassword(newPassword); await revokeHostSessions(session.id); }
  else {
    const admin = await getPropertyAdmin(session.username);
    if (!admin) return Response.json({ error: "Manager account not found." }, { status: 404 });
    await savePropertyAdmin({ ...admin, password: newPassword });
  }
  (await cookies()).delete("konios_host");
  return Response.json({ ok: true, signInAgain: true });
}
