import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { createCalendarBlock, deleteCalendarBlock, listCalendarBlocks } from "@/lib/calendar-blocks";
import { listBookings } from "@/lib/bookings";

async function sessionFor(propertyId: string) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  return session && (session.role === "master" || session.propertyIds.includes(propertyId)) ? session : null;
}

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get("propertyId") || "konios-house";
  if (!(await sessionFor(propertyId))) return Response.json({ error: "Property access denied." }, { status: 403 });
  return Response.json({ blocks: await listCalendarBlocks(propertyId) });
}

export async function POST(request: Request) {
  const input = (await request.json()) as { propertyId?: string; start?: string; end?: string; note?: string };
  const propertyId = input.propertyId || "konios-house";
  if (!(await sessionFor(propertyId))) return Response.json({ error: "Property access denied." }, { status: 403 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.end || "") || input.start! >= input.end!) {
    return Response.json({ error: "Choose a valid blocked period with an end date after the start date." }, { status: 400 });
  }
  const conflict = (await listBookings(propertyId)).find((booking) => !booking.revoked && input.start! < booking.checkOut && input.end! > booking.checkIn);
  if (conflict) return Response.json({ error: `This period overlaps ${conflict.firstName} ${conflict.lastName}'s reservation.` }, { status: 409 });
  const existing = (await listCalendarBlocks(propertyId)).find((block) => input.start! < block.end && input.end! > block.start);
  if (existing) return Response.json({ error: "This period overlaps another personal block." }, { status: 409 });
  const block = await createCalendarBlock({ propertyId, start: input.start!, end: input.end!, note: input.note?.trim() || "Personal use" });
  return Response.json({ block });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId") || "konios-house";
  const id = url.searchParams.get("id");
  if (!(await sessionFor(propertyId))) return Response.json({ error: "Property access denied." }, { status: 403 });
  if (!id) return Response.json({ error: "Block ID is required." }, { status: 400 });
  return (await deleteCalendarBlock(propertyId, id)) ? Response.json({ ok: true }) : Response.json({ error: "Block not found." }, { status: 404 });
}
