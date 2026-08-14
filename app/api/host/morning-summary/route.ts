import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { getRedis, listBookings, skopjeTime } from "@/lib/bookings";
import type { Booking } from "@/lib/bookings";
import { listProperties } from "@/lib/portfolio";
import type { Property, TelegramSummaryConfig } from "@/lib/portfolio";
import { defaultSummaryConfig } from "@/lib/portfolio";
import { getGuestGuide } from "@/lib/guest-guide";
import { sendTelegramMessage } from "@/lib/telegram";
import { syncPropertyIcal } from "@/lib/ical";

function escapeTelegramHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function stayNights(booking: Booking) {
  const start = new Date(`${booking.checkIn}T00:00:00`).getTime();
  const end = new Date(`${booking.checkOut}T00:00:00`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);
}

function guestIdentity(booking: Booking, cfg: TelegramSummaryConfig) {
  const details: string[] = [];
  if (cfg.showGuestName) details.push(`<b>${escapeTelegramHtml(`${booking.firstName} ${booking.lastName}`)}</b>`);
  if (cfg.showSource) details.push(`(${escapeTelegramHtml(booking.source)})`);
  if (cfg.showPhone && booking.phone) details.push(`📞 ${escapeTelegramHtml(booking.phone)}`);
  return details.join(" ") || "Reservation";
}

function buildSummaryForProperty(
  property: Property,
  bookings: Booking[],
  guide: { checkInTime?: string; checkOutTime?: string },
  todayStr: string,
  now = new Date()
): string | null {
  const cfg: TelegramSummaryConfig = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
  const available = bookings.filter((booking) => !booking.revoked && !booking.archivedAt && !booking.isNoShow);
  const departures = available.filter((booking) => booking.checkOut === todayStr);
  const arrivals = available.filter((booking) => booking.checkIn === todayStr);
  const currentStays = available
    .filter((booking) => {
      const arrivalAt = skopjeTime(booking.checkIn, booking.expectedArrivalTime || guide.checkInTime || "15:00");
      const departureAt = skopjeTime(booking.checkOut, booking.expectedDepartureTime || guide.checkOutTime || "10:00");
      return arrivalAt <= now && departureAt > now;
    })
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const nextReservation = available
    .filter((booking) => skopjeTime(booking.checkIn, booking.expectedArrivalTime || guide.checkInTime || "15:00") > now)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const arrivalPaymentsDue = arrivals
    .map((booking) => ({
      booking,
      due: Math.max(0, Number(booking.grossAmount || 0) - Number(booking.paymentCollected || 0)),
    }))
    .filter(({ due }) => due > 0);
  const cleaningToday = [...departures].sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const hasTurnaround = departures.length > 0 && arrivals.length > 0;

  const hasSelectedOperationalData =
    (cfg.showCurrentStay && currentStays.length > 0) ||
    (cfg.showDepartures && departures.length > 0) ||
    (cfg.showArrivals && arrivals.length > 0) ||
    (cfg.showNextReservation && Boolean(nextReservation)) ||
    (cfg.showOutstandingPayments && arrivalPaymentsDue.length > 0) ||
    (cfg.showCleaningToday && cleaningToday.length > 0) ||
    (cfg.showTurnaroundAlert && hasTurnaround);

  if (!hasSelectedOperationalData && !cfg.showQuietDayNote) return null;

  let message = `${escapeTelegramHtml(cfg.greeting || "Hey")}! 🏢 <b>${escapeTelegramHtml(property.name)}</b> — ${todayStr}\n\n`;

  if (cfg.showCurrentStay) {
    message += "🏠 <b>Currently staying:</b>\n";
    if (currentStays.length === 0) {
      message += "• No guest is currently in the property.\n";
    } else {
      for (const booking of currentStays) {
        let line = `• ${guestIdentity(booking, cfg)} — leaves ${booking.checkOut}`;
        if (cfg.showCheckoutTime) line += ` at ${booking.expectedDepartureTime || guide.checkOutTime || "10:00"}`;
        if (cfg.showNights) line += ` · ${stayNights(booking)} night${stayNights(booking) === 1 ? "" : "s"}`;
        message += line + "\n";
      }
    }
    message += "\n";
  }

  if (cfg.showTurnaroundAlert && hasTurnaround) {
    const checkoutTime = departures[0].expectedDepartureTime || guide.checkOutTime || "10:00";
    const arrivalTime = arrivals[0].expectedArrivalTime || guide.checkInTime || "15:00";
    message += `⚡ <b>Same-day turnaround:</b> ${departures.length} departure${departures.length === 1 ? "" : "s"} → ${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"} · cleaning window ${checkoutTime}–${arrivalTime}\n\n`;
  }

  if (cfg.showDepartures && departures.length > 0) {
    message += "🛫 <b>Departing today:</b>\n";
    for (const booking of departures) {
      let line = `• ${guestIdentity(booking, cfg)}`;
      if (cfg.showCheckoutTime) line += ` — checkout ${booking.expectedDepartureTime || guide.checkOutTime || "10:00"}`;
      message += line + "\n";
    }
    message += "\n";
  }

  if (cfg.showArrivals && arrivals.length > 0) {
    message += "🛬 <b>Arriving today:</b>\n";
    for (const booking of arrivals) {
      let line = `• ${guestIdentity(booking, cfg)}`;
      if (cfg.showArrivalTime) line += ` — arrival ${booking.expectedArrivalTime || guide.checkInTime || "15:00"}`;
      if (cfg.showNights) line += ` · ${stayNights(booking)} night${stayNights(booking) === 1 ? "" : "s"}`;
      if (cfg.showPrice && booking.grossAmount) line += ` · ${money(Number(booking.grossAmount), booking.currency || property.currency || "EUR")}`;
      message += line + "\n";
    }
    message += "\n";
  }

  if (cfg.showOutstandingPayments && arrivalPaymentsDue.length > 0) {
    message += "💳 <b>Payment due from today’s arrival:</b>\n";
    for (const { booking, due } of arrivalPaymentsDue) {
      message += `• ${guestIdentity(booking, cfg)} — <b>${money(due, booking.currency || property.currency || "EUR")}</b> outstanding\n`;
    }
    message += "\n";
  }

  if (cfg.showCleaningToday && cleaningToday.length > 0) {
    message += "🧹 <b>Cleaning today:</b>\n";
    for (const booking of cleaningToday) {
      const status = !booking.hasCleaningAgency
        ? "NOT SCHEDULED ⚠️"
        : booking.cleaningStatus === "completed"
          ? "completed ✓"
          : "scheduled";
      const fee = booking.cleaningFeeMkd ? ` · ${booking.cleaningFeeMkd} MKD` : "";
      message += `• ${escapeTelegramHtml(booking.firstName)} ${escapeTelegramHtml(booking.lastName)} — ${status}${fee}\n`;
    }
    message += "\n";
  }

  if (cfg.showNextReservation) {
    message += "⏭ <b>Next reservation:</b>\n";
    if (!nextReservation) {
      message += "• No upcoming reservation.\n";
    } else {
      let line = `• ${guestIdentity(nextReservation, cfg)} — ${nextReservation.checkIn} → ${nextReservation.checkOut}`;
      if (cfg.showArrivalTime) line += ` · arrives ${nextReservation.expectedArrivalTime || guide.checkInTime || "15:00"}`;
      if (cfg.showNights) line += ` · ${stayNights(nextReservation)} night${stayNights(nextReservation) === 1 ? "" : "s"}`;
      if (cfg.showPrice && nextReservation.grossAmount) line += ` · ${money(Number(nextReservation.grossAmount), nextReservation.currency || property.currency || "EUR")}`;
      message += line + "\n";
    }
    message += "\n";
  }

  if (cfg.showGapNights) {
    const counts: string[] = [];
    if (departures.length > 0) counts.push(`${departures.length} departure${departures.length === 1 ? "" : "s"}`);
    if (arrivals.length > 0) counts.push(`${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"}`);
    if (counts.length > 0) message += `📊 Today: ${counts.join(", ")}\n`;
  }

  if (!hasSelectedOperationalData && cfg.showQuietDayNote) {
    message += "☕ No arrivals, departures, active stay, cleaning, or upcoming reservation to report today.\n";
  }

  return message.trim();
}

/**
 * Returns the matching configured time in the property's timezone.
 * The scheduler polls every five minutes; the wider window tolerates provider delays.
 */
function scheduledSlot(property: Property, forceNow?: boolean): string | null {
  if (forceNow) return "manual";

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
    if (nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + 30) {
      return t;
    }
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get("propertyId");
  const suppliedCronSecret = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const cronAuthorized = Boolean(cronSecret) && suppliedCronSecret === `Bearer ${cronSecret}`;
  const session = cronAuthorized ? null : await getHostSession((await cookies()).get("konios_host")?.value);
  if (!cronAuthorized && !session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!cronAuthorized && !propertyId) return Response.json({ error: "Select a property." }, { status: 400 });
  if (session?.role === "property-admin" && propertyId && !session.propertyIds.includes(propertyId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const forceNow = !cronAuthorized && Boolean(propertyId);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const todayStr = formatter.format(new Date());

  const properties = await listProperties();
  const targetProperties = propertyId
    ? properties.filter((p) => p.id === propertyId)
    : properties;

  const results = [];
  const calendarSyncResults = [];

  for (const property of targetProperties) {
    if (!property.active) {
      continue;
    }

    if (property.airbnbIcalUrl?.trim() || property.bookingIcalUrl?.trim()) {
      try {
        const sync = await syncPropertyIcal(property.id);
        calendarSyncResults.push({ propertyId: property.id, propertyName: property.name, success: true, ...sync });
      } catch (error: unknown) {
        calendarSyncResults.push({
          propertyId: property.id,
          propertyName: property.name,
          success: false,
          error: error instanceof Error ? error.message : "Calendar sync failed",
        });
      }
    }

    if (!property.telegramEnabled || !property.telegramBotToken || !property.telegramChatId) continue;

    const cfg = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    const tz = cfg.timezone || "Europe/Skopje";
    const todayLocal = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    const slot = scheduledSlot(property, forceNow);
    if (!slot) continue;

    const dedupeKey = `telegram-summary:${property.id}:${todayLocal}:${slot}`;
    if (!forceNow) {
      const claimed = await getRedis().set(dedupeKey, "pending", { nx: true, ex: 60 * 60 * 48 });
      if (!claimed) continue;
    }

    const [bookings, guide] = await Promise.all([
      listBookings(property.id),
      getGuestGuide(property.id)
    ]);

    const message = buildSummaryForProperty(property, bookings, guide, todayLocal);
    if (!message) continue;

    const sent = await sendTelegramMessage(message, property.telegramBotToken, property.telegramChatId);
    if (!sent && !forceNow) await getRedis().del(dedupeKey);
    results.push({ propertyId: property.id, propertyName: property.name, success: sent, slot });
  }

  return Response.json({ success: true, calendarSyncResults, results, today: todayStr });
}
