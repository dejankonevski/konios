import type { Booking } from "@/lib/bookings";
import { getRedis } from "@/lib/bookings";
import type { GuestGuide } from "@/lib/guest-guide";
import { defaultSummaryConfig, type Property } from "@/lib/portfolio";
import { renderTelegramAlertTemplate } from "@/lib/telegram-alert-templates";
import { sendTelegramMessage } from "@/lib/telegram";

export async function sendGuestCheckInAlert({ property, booking, guide, trigger = "guest-event" }: {
  property: Property;
  booking: Booking;
  guide: GuestGuide;
  trigger?: "guest-event" | "check-in-time";
}) {
  const config = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
  if (!property.active || !property.telegramEnabled || !property.telegramBotToken || !property.telegramChatId || config.notifyGuestCheckIn === false) {
    return { sent: false, skipped: "disabled" } as const;
  }

  const redis = getRedis();
  const dedupeKey = `telegram:check-in-alert:${property.id}:${booking.id}`;
  const claimed = await redis.set(dedupeKey, "pending", { nx: true, ex: 60 * 60 * 72 });
  if (!claimed) return { sent: false, skipped: "duplicate" } as const;

  const message = renderTelegramAlertTemplate(config.checkInAlertTemplate || defaultSummaryConfig.checkInAlertTemplate || "", {
    propertyName: property.name,
    guestName: `${booking.firstName} ${booking.lastName}`,
    phone: booking.phone || "Not provided",
    bookingSource: booking.source,
    checkInDate: booking.checkIn,
    checkInTime: booking.expectedArrivalTime || guide.checkInTime || "15:00",
    checkInStatus: trigger === "guest-event" ? "The guest reported their arrival." : "The official check-in time has been reached.",
    checkOutDate: booking.checkOut,
    checkOutTime: booking.expectedDepartureTime || guide.checkOutTime || "10:00",
  });
  const sent = await sendTelegramMessage(message, property.telegramBotToken, property.telegramChatId);
  if (sent) await redis.set(dedupeKey, "sent", { ex: 60 * 60 * 72 });
  else await redis.del(dedupeKey);
  return { sent } as const;
}


