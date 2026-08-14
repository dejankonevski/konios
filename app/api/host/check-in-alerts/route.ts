import { listBookings, skopjeTime } from "@/lib/bookings";
import { sendGuestCheckInAlert } from "@/lib/check-in-alerts";
import { getGuestGuide } from "@/lib/guest-guide";
import { defaultSummaryConfig, listProperties } from "@/lib/portfolio";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && request.headers.get("authorization") !== `Bearer ${expectedSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const properties = await listProperties();
  const results: Array<{ propertyId: string; bookingId: string; sent: boolean }> = [];
  for (const property of properties) {
    const config = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    if (!property.active || !property.telegramEnabled || config.notifyGuestCheckIn === false) continue;
    const today = localDate(config.timezone || "Europe/Skopje");
    const [bookings, guide] = await Promise.all([listBookings(property.id), getGuestGuide(property.id)]);
    const arrivals = bookings.filter((booking) => !booking.revoked && !booking.archivedAt && !booking.isNoShow && booking.checkIn === today);
    for (const booking of arrivals) {
      const checkInTime = booking.expectedArrivalTime || guide.checkInTime || "15:00";
      if (skopjeTime(booking.checkIn, checkInTime) > now) continue;
      const result = await sendGuestCheckInAlert({ property, booking, guide, trigger: "check-in-time" });
      if (!("skipped" in result)) results.push({ propertyId: property.id, bookingId: booking.id, sent: result.sent });
    }
  }
  return Response.json({ success: true, results });
}


