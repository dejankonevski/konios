import { getGuestGuide } from "@/lib/guest-guide";
import { listBookings, skopjeTime } from "@/lib/bookings";
import { sendCleaningAlert } from "@/lib/cleaning-alerts";
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
  const results: Array<{ propertyId: string; bookingId: string; kind: string; sent: boolean }> = [];

  for (const property of properties) {
    const config = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    if (!property.active || !property.telegramEnabled || !property.telegramBotToken || !property.telegramChatId || config.autoCleaningAlerts === false) continue;

    const today = localDate(config.timezone || "Europe/Skopje");
    const [bookings, guide] = await Promise.all([listBookings(property.id), getGuestGuide(property.id)]);
    const departures = bookings.filter((booking) => !booking.revoked && !booking.archivedAt && !booking.isNoShow && booking.checkOut === today);

    for (const departure of departures) {
      const checkoutTime = departure.expectedDepartureTime || guide.checkOutTime || "10:00";
      if (skopjeTime(departure.checkOut, checkoutTime) > now) continue;
      const result = await sendCleaningAlert({ property, departure, bookings, guide, trigger: "checkout-time" });
      if (typeof result.kind === "string") {
        results.push({ propertyId: property.id, bookingId: departure.id, kind: result.kind, sent: result.sent });
      }
    }
  }

  return Response.json({ success: true, results });
}


