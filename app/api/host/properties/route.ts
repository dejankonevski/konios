import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { createProperty, listProperties, listUnits } from "@/lib/portfolio";
import { defaultGuestGuide, saveGuestGuide } from "@/lib/guest-guide";

export async function GET() {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  const allowed = session.role === "master" ? properties : properties.filter((property) => session.propertyIds.includes(property.id));
  return Response.json({ properties: allowed, units: units.filter((unit) => allowed.some((property) => property.id === unit.propertyId)), session: { role: session.role, username: session.username } });
}

export async function POST(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session || session.role !== "master") return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const input = (await request.json()) as { name?: string; slug?: string; address?: string; currency?: string };
  if (!input.name?.trim() || !input.address?.trim()) return Response.json({ error: "Property name and address are required." }, { status: 400 });
  const property = await createProperty({ name: input.name, slug: input.slug, address: input.address, currency: input.currency });
  await saveGuestGuide({ ...defaultGuestGuide, propertyName: property.name, address: property.address, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}` }, property.id);
  return Response.json({ property });
}
