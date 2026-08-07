import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { getGuestGuide, GuestGuide, saveGuestGuide } from "@/lib/guest-guide";

async function authorised() {
  return verifyHostToken((await cookies()).get("konios_host")?.value);
}

export async function GET() {
  if (!(await authorised())) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json({ guide: await getGuestGuide() });
}

export async function PUT(request: Request) {
  try {
    if (!(await authorised())) return Response.json({ error: "Unauthorised" }, { status: 401 });
    const input = (await request.json()) as Partial<GuestGuide>;
    const current = await getGuestGuide();
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
    const saved = await saveGuestGuide(guide);
    return Response.json({ guide: saved });
  } catch (error) {
    console.error("Failed to save guest guide:", error);
    return Response.json({ error: "Failed to save guest guide. Payload size might be too large." }, { status: 500 });
  }
}
