import { listBookings } from "@/lib/bookings";
import { listProperties } from "@/lib/portfolio";
import type { Property, TelegramSummaryConfig } from "@/lib/portfolio";
import { defaultSummaryConfig } from "@/lib/portfolio";
import { getGuestGuide } from "@/lib/guest-guide";
import { sendTelegramMessage } from "@/lib/telegram";

function buildSummaryForProperty(
  property: Property,
  bookings: any[],
  guide: any,
  todayStr: string
): string | null {
  const cfg: TelegramSummaryConfig = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
  const departures = bookings.filter((b) => !b.revoked && b.checkOut === todayStr);
  const arrivals = bookings.filter((b) => !b.revoked && b.checkIn === todayStr);

  if (!cfg.showArrivals && !cfg.showDepartures) return null;
  if (departures.length === 0 && arrivals.length === 0) {
    if (cfg.showQuietDayNote) {
      return `${cfg.greeting || "Hey"}! 🏢 <b>${property.name}</b>\n\n☕ No departures or check-ins scheduled for today. Have a peaceful day!`;
    }
    return null;
  }

  let message = `${cfg.greeting || "Hey"}! 🏢 <b>${property.name}</b> — ${todayStr}\n\n`;

  if (cfg.showDepartures && departures.length > 0) {
    message += `🛫 <b>Checking out today:</b>\n`;
    for (const d of departures) {
      let line = "• ";
      if (cfg.showGuestName) line += `<b>${d.firstName} ${d.lastName}</b>`;
      if (cfg.showSource) line += ` (${d.source})`;
      if (cfg.showPhone && d.phone) line += ` 📞 ${d.phone}`;
      if (cfg.showCheckoutTime) line += ` — Checkout: ${guide.checkOutTime || "10:00"}`;
      message += line + "\n";
    }
    message += "\n";
  }

  if (cfg.showArrivals && arrivals.length > 0) {
    message += `🛬 <b>Checking in today:</b>\n`;
    for (const a of arrivals) {
      const arrivalTime = a.expectedArrivalTime || guide.checkInTime || "15:00";
      const d1 = new Date(`${a.checkIn}T00:00:00`);
      const d2 = new Date(`${a.checkOut}T00:00:00`);
      const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));

      let line = "• ";
      if (cfg.showGuestName) line += `<b>${a.firstName} ${a.lastName}</b>`;
      if (cfg.showSource) line += ` (${a.source})`;
      if (cfg.showPhone && a.phone) line += ` 📞 ${a.phone}`;
      if (cfg.showArrivalTime) line += ` — Arrives: ${arrivalTime}`;
      if (cfg.showNights) line += ` · ${nights} night${nights > 1 ? "s" : ""}`;
      if (cfg.showPrice && a.grossAmount) {
        const priceStr = new Intl.NumberFormat("de-DE", { style: "currency", currency: property.currency || "EUR" }).format(a.grossAmount);
        line += ` · ${priceStr}`;
      }
      message += line + "\n";
    }
    message += "\n";
  }

  if (cfg.showGapNights && departures.length > 0 && arrivals.length > 0) {
    message += `📊 Today: ${departures.length} checkout(s), ${arrivals.length} checkin(s)\n`;
  } else {
    const parts: string[] = [];
    if (departures.length > 0) parts.push(`${departures.length} checkout(s)`);
    if (arrivals.length > 0) parts.push(`${arrivals.length} checkin(s)`);
    if (parts.length) message += `📊 ${parts.join(", ")}\n`;
  }

  return message;
}

/**
 * Checks if the current time in the property's timezone matches any of its scheduled times.
 * Uses a 15-minute window to account for cron polling intervals.
 */
function isScheduledNow(property: Property, forceNow?: boolean): boolean {
  if (forceNow) return true;

  const cfg = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
  const tz = cfg.timezone || "Europe/Skopje";
  const times = cfg.scheduleTimes || ["08:00"];

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false
  });
  const currentTime = formatter.format(now); // e.g. "08:14"
  const [nowH, nowM] = currentTime.split(":").map(Number);
  const nowMinutes = nowH * 60 + nowM;

  for (const t of times) {
    const [h, m] = t.split(":").map(Number);
    const scheduledMinutes = h * 60 + m;
    // Allow a 15-minute window (cron runs every 15 min)
    if (nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + 15) {
      return true;
    }
  }

  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  const forceNow = url.searchParams.get("force") === "true" || Boolean(propertyId);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const todayStr = formatter.format(new Date());

  const properties = await listProperties();
  const targetProperties = propertyId
    ? properties.filter((p) => p.id === propertyId)
    : properties;

  const results = [];

  for (const property of targetProperties) {
    if (!property.active || !property.telegramEnabled || !property.telegramBotToken || !property.telegramChatId) {
      continue;
    }

    // Check if it's the right time to send (skip check if forced or single-property request)
    if (!isScheduledNow(property, forceNow)) {
      continue;
    }

    const cfg = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    const tz = cfg.timezone || "Europe/Skopje";
    const todayLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());

    const [bookings, guide] = await Promise.all([
      listBookings(property.id),
      getGuestGuide(property.id)
    ]);

    const message = buildSummaryForProperty(property, bookings, guide, todayLocal);
    if (!message) continue;

    const sent = await sendTelegramMessage(message, property.telegramBotToken, property.telegramChatId);
    results.push({ propertyId: property.id, propertyName: property.name, success: sent });
  }

  return Response.json({ success: true, results, today: todayStr });
}
