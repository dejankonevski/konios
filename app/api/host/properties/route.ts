import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { listProperties, listUnits } from "@/lib/portfolio";

export async function GET() {
  if (!(await verifyHostToken((await cookies()).get("konios_host")?.value))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  return Response.json({ properties, units });
}
