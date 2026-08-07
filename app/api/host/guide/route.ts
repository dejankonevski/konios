import { cookies } from "next/headers";
import { verifyHostToken } from "@/lib/access-code";
import { defaultGuestGuide, getGuestGuide, GuestGuide, saveGuestGuide } from "@/lib/guest-guide";

async function authorised() {
  return verifyHostToken((await cookies()).get("konios_host")?.value);
}

export async function GET() {
  if (!(await authorised())) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json({ guide: await getGuestGuide() });
}

export async function PUT(request: Request) {
  if (!(await authorised())) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const input = (await request.json()) as Partial<GuestGuide>;
  const guide = Object.fromEntries(Object.keys(defaultGuestGuide).map((key) => [key, String(input[key as keyof GuestGuide] ?? "").trim()])) as GuestGuide;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(guide.checkInTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(guide.checkOutTime)) return Response.json({ error: "Choose valid check-in and checkout times." }, { status: 400 });
  return Response.json({ guide: await saveGuestGuide(guide) });
}
