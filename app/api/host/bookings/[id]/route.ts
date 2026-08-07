import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { deleteBooking, updateBooking } from "@/lib/bookings";

async function authorized() { return verifyHostToken((await cookies()).get("konios_host")?.value); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const booking = await updateBooking(id, { ...(typeof body.revoked === "boolean" ? { revoked: body.revoked } : {}), ...(typeof body.notes === "string" ? { notes: body.notes } : {}) });
  return booking ? Response.json({ booking }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  return (await deleteBooking(id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
