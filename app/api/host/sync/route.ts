import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { syncPropertyIcal } from "@/lib/ical";

export async function POST(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await request.json()) as { propertyId?: string };
  if (!input.propertyId) return Response.json({ error: "Property ID is required." }, { status: 400 });

  if (session.role !== "master" && !session.propertyIds.includes(input.propertyId)) {
    return Response.json({ error: "Access denied." }, { status: 403 });
  }

  try {
    const results = await syncPropertyIcal(input.propertyId);
    return Response.json({ success: true, results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
