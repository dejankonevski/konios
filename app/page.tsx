import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bookingState, getBookingByCode } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import GuestManualView from "@/app/guest-guide/GuestManualView";

export default async function Home() {
  const code = (await cookies()).get("konios_access")?.value;
  const [booking, guide] = await Promise.all([
    code ? getBookingByCode(code) : null,
    getGuestGuide(),
  ]);
  if (!booking || bookingState(booking, new Date(), guide).status !== "active") {
    redirect("/access");
  }

  return <GuestManualView booking={booking} guide={guide} />;
}
