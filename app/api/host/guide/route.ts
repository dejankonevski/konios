import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { getGuestGuide, GuestGuide, saveGuestGuide } from "@/lib/guest-guide";

async function authorised(propertyId: string) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  return session && (session.role === "master" || session.propertyIds.includes(propertyId)) ? session : null;
}

export async function GET(request: Request) {
  const propertyId = new URL(request.url).searchParams.get("propertyId") || "konios-house";
  if (!(await authorised(propertyId))) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json({ guide: await getGuestGuide(propertyId) });
}

export async function PUT(request: Request) {
  try {
    const propertyId = new URL(request.url).searchParams.get("propertyId") || "konios-house";
    if (!(await authorised(propertyId))) return Response.json({ error: "Unauthorised" }, { status: 401 });
    const input = (await request.json()) as Partial<GuestGuide>;
    const current = await getGuestGuide(propertyId);
    const guide: GuestGuide = {
      ...current,
      ...input,
      messageTemplates: Array.isArray(input.messageTemplates) ? input.messageTemplates : current.messageTemplates,
      faqs: Array.isArray(input.faqs) ? input.faqs : current.faqs,
      gallery: Array.isArray(input.gallery) ? input.gallery : current.gallery,
    };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(guide.checkInTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(guide.checkOutTime)) {
      return Response.json({ error: "Choose valid check-in and checkout times." }, { status: 400 });
    }
    guide.portalLeadHours = Number(guide.portalLeadHours);
    guide.sensitiveRevealMinutes = Number(guide.sensitiveRevealMinutes);
    guide.accessExpiryMinutes = Number(guide.accessExpiryMinutes);
    if (!Number.isFinite(guide.portalLeadHours) || guide.portalLeadHours < 1 || guide.portalLeadHours > 168) {
      return Response.json({ error: "Portal opening must be between 1 and 168 hours before check-in." }, { status: 400 });
    }
    if (!Number.isFinite(guide.sensitiveRevealMinutes) || guide.sensitiveRevealMinutes < 0 || guide.sensitiveRevealMinutes > 180) {
      return Response.json({ error: "Sensitive details must reveal between 0 and 180 minutes before check-in." }, { status: 400 });
    }
    if (!Number.isFinite(guide.accessExpiryMinutes) || guide.accessExpiryMinutes < 0 || guide.accessExpiryMinutes > 1440) {
      return Response.json({ error: "Access expiry must be between 0 and 1,440 minutes after checkout." }, { status: 400 });
    }
    const saved = await saveGuestGuide(guide, propertyId);
    return Response.json({ guide: saved });
  } catch (error) {
    console.error("Failed to save guest guide:", error);
    return Response.json({ error: "Failed to save guest guide. Payload size might be too large." }, { status: 500 });
  }
}
