import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bookingState, getBookingByToken } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import GuestManualView from "@/app/guest-guide/GuestManualView";

export default async function Home() {
  const code = (await cookies()).get("konios_access")?.value;
  const booking = code ? await getBookingByToken(code) : null;
  const guide = await getGuestGuide(booking?.propertyId || "konios-house");
  const state = booking ? bookingState(booking, new Date(), guide) : null;
  if (!booking || !state || state.status === "expired" || state.status === "revoked") {
    redirect("/access");
  }

  return <GuestManualView booking={booking} guide={guide} accessState={{ revealAccess: state.revealAccess, stayStage: state.stayStage, accessDetailsAt: state.accessDetailsAt.toISOString() }} />;
}
