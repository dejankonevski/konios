import type { Booking } from "@/lib/bookings";
import { getRedis } from "@/lib/bookings";
import type { GuestGuide } from "@/lib/guest-guide";
import { defaultSummaryConfig, type Property } from "@/lib/portfolio";
import { renderTelegramAlertTemplate } from "@/lib/telegram-alert-templates";
import { sendTelegramMessage } from "@/lib/telegram";

export async function sendCleaningAlert({ property, departure, bookings, guide, trigger }: {
  property: Property;
  departure: Booking;
  bookings: Booking[];
  guide: GuestGuide;
  trigger: "guest-checkout" | "checkout-time";
}) {
  const config = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
  if (!property.active || !property.telegramEnabled || !property.telegramBotToken || !property.telegramChatId || config.autoCleaningAlerts === false) {
    return { sent: false, skipped: "disabled" } as const;
  }

  const activeBookings = bookings.filter((booking) => !booking.revoked && !booking.archivedAt && !booking.isNoShow);
  const nextArrival = activeBookings
    .filter((booking) => booking.id !== departure.id && booking.checkIn === departure.checkOut)
    .sort((a, b) => (a.expectedArrivalTime || guide.checkInTime || "15:00").localeCompare(b.expectedArrivalTime || guide.checkInTime || "15:00"))[0];
  const cleaningScheduled = Boolean(departure.hasCleaningAgency);
  const turnaroundAlertEnabled = Boolean(nextArrival) && config.notifySameDayTurnaround !== false;
  const cleaningStateAlertEnabled = cleaningScheduled ? config.notifyScheduledCleaning !== false : config.notifyUnscheduledCleaning !== false;
  if (!turnaroundAlertEnabled && !cleaningStateAlertEnabled) return { sent: false, skipped: "unchecked" } as const;

  const kind = turnaroundAlertEnabled ? "turnaround" : cleaningScheduled ? "scheduled" : "unscheduled";
  const dedupeKey = `telegram:cleaning-alert:${property.id}:${departure.checkOut}:${departure.id}:${kind}`;
  const redis = getRedis();
  const claimed = await redis.set(dedupeKey, "pending", { nx: true, ex: 60 * 60 * 72 });
  if (!claimed) return { sent: false, skipped: "duplicate" } as const;

  const checkoutTime = departure.expectedDepartureTime || guide.checkOutTime || "10:00";
  const cleaningStatus = cleaningScheduled
    ? departure.cleaningStatus === "completed" ? "Cleaning already marked complete ✓" : "Cleaning is scheduled"
    : "CLEANING IS NOT SCHEDULED";
  const nextArrivalTime = nextArrival?.expectedArrivalTime || guide.checkInTime || "15:00";
  const template = turnaroundAlertEnabled
    ? config.turnaroundAlertTemplate || defaultSummaryConfig.turnaroundAlertTemplate || ""
    : cleaningScheduled
      ? config.scheduledCleaningAlertTemplate || defaultSummaryConfig.scheduledCleaningAlertTemplate || ""
      : config.unscheduledCleaningAlertTemplate || defaultSummaryConfig.unscheduledCleaningAlertTemplate || "";
  const message = renderTelegramAlertTemplate(template, {
    propertyName: property.name,
    guestName: `${departure.firstName} ${departure.lastName}`,
    phone: departure.phone || "Not provided",
    bookingSource: departure.source,
    checkInDate: departure.checkIn,
    checkInTime: departure.expectedArrivalTime || guide.checkInTime || "15:00",
    checkOutDate: departure.checkOut,
    checkOutTime: trigger === "guest-checkout" ? "now (guest confirmed)" : checkoutTime,
    cleaningStatus,
    cleaningFee: departure.cleaningFeeMkd ? `${departure.cleaningFeeMkd} MKD` : "Not entered",
    nextGuestName: nextArrival ? `${nextArrival.firstName} ${nextArrival.lastName}` : "No same-day arrival",
    nextArrivalTime,
    cleaningWindow: `${trigger === "guest-checkout" ? "now" : checkoutTime}–${nextArrivalTime}`,
  });

  const sent = await sendTelegramMessage(message, property.telegramBotToken, property.telegramChatId);
  if (sent) await redis.set(dedupeKey, "sent", { ex: 60 * 60 * 72 });
  else await redis.del(dedupeKey);
  return { sent, kind } as const;
}


