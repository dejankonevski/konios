import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyHostToken } from "@/lib/access-code";
import { getGuestGuide } from "@/lib/guest-guide";
import GuestManualView from "@/app/guest-guide/GuestManualView";
import type { Booking } from "@/lib/bookings";

export default async function HostPreviewPage() {
  if (!(await verifyHostToken((await cookies()).get("konios_host")?.value))) redirect("/host");
  const guide = await getGuestGuide();
  const booking: Booking = { id: "host-preview", code: "00000", accessToken: "host-preview", firstName: "Preview", lastName: "Guest", checkIn: "2099-01-01", checkOut: "2099-01-02", guests: 2, source: "Direct", notes: "Authenticated host preview", revoked: false, createdAt: 0 };
  return <div className="host-preview-shell"><div className="host-preview-ribbon">AUTHENTICATED HOST PREVIEW · NOT A GUEST LINK</div><GuestManualView booking={booking} guide={guide} accessState={{ revealAccess: true, stayStage: "during-stay", accessDetailsAt: "2099-01-01T14:30:00.000Z" }} /></div>;
}
