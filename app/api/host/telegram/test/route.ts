import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { listBookings } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import { getPropertyById } from "@/lib/portfolio";
import {
  defaultTelegramAlertTemplates,
  renderTelegramAlertTemplate,
  type TelegramAlertTemplateKey,
} from "@/lib/telegram-alert-templates";
import { sendTelegramMessage } from "@/lib/telegram";

const templateKeys = new Set<TemplateKey>([
  "checkInAlertTemplate",
  "scheduledCleaningAlertTemplate",
  "unscheduledCleaningAlertTemplate",
  "turnaroundAlertTemplate",
]);
type TemplateKey = TelegramAlertTemplateKey;

export async function POST(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await request.json()) as {
    propertyId?: string;
    templateKey?: TemplateKey;
    template?: string;
    botToken?: string;
    chatId?: string;
  };
  if (!input.propertyId || !input.templateKey || !templateKeys.has(input.templateKey)) {
    return Response.json({ error: "Choose a valid property and message template." }, { status: 400 });
  }
  if (session.role !== "master" && !session.propertyIds.includes(input.propertyId)) {
    return Response.json({ error: "Property access denied." }, { status: 403 });
  }

  const property = await getPropertyById(input.propertyId);
  if (!property) return Response.json({ error: "Property not found." }, { status: 404 });
  const botToken = input.botToken?.trim() || property.telegramBotToken;
  const chatId = input.chatId?.trim() || property.telegramChatId;
  if (!botToken || !chatId) return Response.json({ error: "Bot token and Chat ID are required for testing." }, { status: 400 });

  const [bookings, guide] = await Promise.all([listBookings(property.id), getGuestGuide(property.id)]);
  const booking = bookings
    .filter((item) => !item.revoked && !item.archivedAt && !item.isNoShow)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const nextBooking = bookings
    .filter((item) => item.id !== booking?.id && !item.revoked && !item.archivedAt && !item.isNoShow)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const checkInTime = booking?.expectedArrivalTime || guide.checkInTime || "15:00";
  const checkOutTime = booking?.expectedDepartureTime || guide.checkOutTime || "10:00";
  const nextArrivalTime = nextBooking?.expectedArrivalTime || guide.checkInTime || "15:00";
  const template = input.template?.trim() || property.telegramSummaryConfig?.[input.templateKey] || defaultTelegramAlertTemplates[input.templateKey];
  const preview = renderTelegramAlertTemplate(template, {
    propertyName: property.name,
    guestName: booking ? `${booking.firstName} ${booking.lastName}` : "Example Guest",
    phone: booking?.phone || "+389 70 123 456",
    bookingSource: booking?.source || "Booking.com",
    checkInDate: booking?.checkIn || "2026-08-12",
    checkInTime,
    checkInStatus: "The official check-in time has been reached.",
    checkOutDate: booking?.checkOut || "2026-08-15",
    checkOutTime,
    cleaningStatus: input.templateKey === "unscheduledCleaningAlertTemplate" ? "CLEANING IS NOT SCHEDULED" : "Cleaning is scheduled",
    cleaningFee: booking?.cleaningFeeMkd ? `${booking.cleaningFeeMkd} MKD` : "1,500 MKD",
    nextGuestName: nextBooking ? `${nextBooking.firstName} ${nextBooking.lastName}` : "Next Example Guest",
    nextArrivalTime,
    cleaningWindow: `${checkOutTime}–${nextArrivalTime}`,
  });

  const sent = await sendTelegramMessage(`🧪 <b>TEST MESSAGE — NOT A LIVE ALERT</b>\n\n${preview}`, botToken, chatId);
  if (!sent) return Response.json({ error: "Telegram rejected the test. Check the bot credentials and template formatting." }, { status: 400 });
  return Response.json({ success: true, preview });
}
