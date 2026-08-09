import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { getStripeStatus, verifyAndSaveStripeSecret } from "@/lib/stripe-settings";

async function masterSession() {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  return session?.role === "master" ? session : null;
}

export async function GET() {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  return Response.json({ stripe: await getStripeStatus() });
}

export async function PUT(request: Request) {
  if (!(await masterSession())) return Response.json({ error: "Master administrator access required." }, { status: 403 });
  const { secretKey } = (await request.json()) as { secretKey?: string };
  if (!secretKey) return Response.json({ error: "Enter the replacement Stripe secret key." }, { status: 400 });
  try {
    const saved = await verifyAndSaveStripeSecret(secretKey);
    return Response.json({ ok: true, stripe: { configured: true, ...saved, source: "admin", updatedAt: Date.now() } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Stripe could not verify this key." }, { status: 400 });
  }
}
