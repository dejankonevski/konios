import { listBookings } from "@/lib/bookings";
import { listProperties } from "@/lib/portfolio";
import { getGuestGuide } from "@/lib/guest-guide";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const todayStr = formatter.format(new Date());

  const properties = await listProperties();
  let message = `<b>🌅 Morning Summary Update (${todayStr})</b>\n\n`;

  let totalDepartures = 0;
  let totalArrivals = 0;

  for (const property of properties) {
    if (!property.active) continue;

    const [bookings, guide] = await Promise.all([
      listBookings(property.id),
      getGuestGuide(property.id)
    ]);

    const departures = bookings.filter((b) => !b.revoked && b.checkOut === todayStr);
    const arrivals = bookings.filter((b) => !b.revoked && b.checkIn === todayStr);

    if (departures.length === 0 && arrivals.length === 0) continue;

    message += `🏢 <b>${property.name}</b>:\n`;

    if (departures.length > 0) {
      message += `  🛫 <b>Checking out today:</b>\n`;
      for (const d of departures) {
        message += `  • <b>${d.firstName} ${d.lastName}</b> (${d.source}) - Checkout time: ${guide.checkOutTime || "10:00"}\n`;
        totalDepartures++;
      }
    }

    if (arrivals.length > 0) {
      message += `  🛬 <b>Checking in today:</b>\n`;
      for (const a of arrivals) {
        const arrivalTime = a.expectedArrivalTime || guide.checkInTime || "15:00";
        const d1 = new Date(`${a.checkIn}T00:00:00`);
        const d2 = new Date(`${a.checkOut}T00:00:00`);
        const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
        
        let priceStr = "+ Add price";
        if (a.grossAmount) {
          priceStr = new Intl.NumberFormat("de-DE", { style: "currency", currency: property.currency || "EUR" }).format(a.grossAmount);
        }

        message += `  • <b>${a.firstName} ${a.lastName}</b> (${a.source}) - Arriving at ${arrivalTime} (${nights} nights, total: ${priceStr})\n`;
        totalArrivals++;
      }
    }
    message += `\n`;
  }

  if (totalDepartures === 0 && totalArrivals === 0) {
    message += `☕ No departures or check-ins scheduled for today. Have a peaceful day!`;
  } else {
    message += `📊 Summary: ${totalDepartures} check-out(s), ${totalArrivals} check-in(s).`;
  }

  const sent = await sendTelegramMessage(message);

  return Response.json({ success: sent, today: todayStr, departuresCount: totalDepartures, arrivalsCount: totalArrivals });
}
