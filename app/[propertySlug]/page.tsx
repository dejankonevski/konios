import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AccessView from "@/app/access/AccessView";
import GuestManualView from "@/app/guest-guide/GuestManualView";
import { bookingState, getBookingByToken } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import { getPropertyBySlug } from "@/lib/portfolio";

export default async function PropertyGuestPage({ params }: { params: Promise<{ propertySlug: string }> }) {
  const { propertySlug } = await params;
  const property = await getPropertyBySlug(propertySlug);
  if (!property) notFound();

  const accessToken = (await cookies()).get("konios_access")?.value;
  const booking = accessToken ? await getBookingByToken(accessToken) : null;
  if (!booking || (booking.propertyId || "konios-house") !== property.id) {
    return <AccessView propertySlug={property.slug} propertyName={property.name} />;
  }

  const guide = await getGuestGuide(property.id);
  const state = bookingState(booking, new Date(), guide);
  if (state.status === "expired" || state.status === "revoked" || state.status === "upcoming") {
    return <AccessView propertySlug={property.slug} propertyName={property.name} />;
  }

  return <GuestManualView booking={booking} guide={guide} accessState={{ revealAccess: state.revealAccess, stayStage: state.stayStage, accessDetailsAt: state.accessDetailsAt.toISOString() }} />;
}
