import { getRedis } from "./bookings";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}
const TELEGRAM_CONFIG_KEY = "settings:telegram";

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  return getRedis().get<TelegramConfig>(TELEGRAM_CONFIG_KEY);
}

export async function saveTelegramConfig(config: TelegramConfig): Promise<void> {
  await getRedis().set(TELEGRAM_CONFIG_KEY, config);
}

export async function sendTelegramMessage(text: string, customBotToken?: string, customChatId?: string): Promise<boolean> {
  let botToken = customBotToken;
  let chatId = customChatId;

  if (!botToken || !chatId) {
    const config = await getTelegramConfig();
    if (!config || !config.enabled) return false;
    botToken = botToken || config.botToken;
    chatId = chatId || config.chatId;
  }

  if (!botToken || !chatId) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML"
      })
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { description?: string } | null;
      console.error("[telegram] Telegram rejected a message", {
        status: response.status,
        description: failure?.description || "Unknown Telegram error",
      });
    }
    return response.ok;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

export async function notifyNewBookingAlert(propertyId: string, booking: {
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  source: string;
  guests?: number;
  phone?: string;
  grossAmount?: number;
  currency?: string;
  notes?: string;
}) {
  try {
    const { listProperties, defaultSummaryConfig } = await import("./portfolio");
    const properties = await listProperties();
    const property = properties.find((p) => p.id === propertyId);

    if (!property || !property.active) {
      return false;
    }

    const hasPropertyTelegram = Boolean(property.telegramEnabled && property.telegramBotToken && property.telegramChatId);
    const globalTelegram = hasPropertyTelegram ? null : await getTelegramConfig();
    if (!hasPropertyTelegram && (!globalTelegram || !globalTelegram.enabled || !globalTelegram.botToken || !globalTelegram.chatId)) return false;

    const cfg = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    if (cfg.notifyNewReservations === false) {
      return false;
    }

    const d1 = new Date(`${booking.checkIn}T00:00:00`);
    const d2 = new Date(`${booking.checkOut}T00:00:00`);
    const nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));

    let msg = `🎉 <b>New Booking Alert!</b>\n`;
    msg += `🏢 <b>Property:</b> ${property.name}\n`;
    msg += `👤 <b>Guest:</b> ${booking.firstName} ${booking.lastName}\n`;
    msg += `📅 <b>Dates:</b> ${booking.checkIn} ➔ ${booking.checkOut} (${nights} night${nights > 1 ? "s" : ""})\n`;
    msg += `🌐 <b>Source:</b> ${booking.source}\n`;

    if (booking.guests) {
      msg += `👥 <b>Guests:</b> ${booking.guests}\n`;
    }
    if (booking.phone) {
      msg += `📞 <b>Phone:</b> ${booking.phone}\n`;
    }
    if (booking.grossAmount) {
      const priceStr = new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: booking.currency || property.currency || "EUR",
      }).format(booking.grossAmount);
      msg += `💰 <b>Total:</b> ${priceStr}\n`;
    }
    if (booking.notes) {
      msg += `📝 <b>Notes:</b> ${booking.notes}\n`;
    }

    return await sendTelegramMessage(
      msg,
      hasPropertyTelegram ? property.telegramBotToken : globalTelegram?.botToken,
      hasPropertyTelegram ? property.telegramChatId : globalTelegram?.chatId,
    );
  } catch (err) {
    console.error("Failed to send new booking alert:", err);
    return false;
  }
}

export async function notifyCancellationAlert(propertyId: string, booking: {
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  source: string;
  notes?: string;
}) {
  try {
    const { listProperties, defaultSummaryConfig } = await import("./portfolio");
    const property = (await listProperties()).find((item) => item.id === propertyId);
    if (!property || !property.active) return false;

    const config = { ...defaultSummaryConfig, ...property.telegramSummaryConfig };
    if (config.notifyCancellations === false) return false;

    // A property may deliberately use the shared Telegram connection. New
    // booking alerts already support this fallback; cancellations must behave
    // identically or they silently disappear for properties such as Konios.
    const hasPropertyTelegram = Boolean(property.telegramEnabled && property.telegramBotToken && property.telegramChatId);
    const globalTelegram = hasPropertyTelegram ? null : await getTelegramConfig();
    if (!hasPropertyTelegram && (!globalTelegram?.enabled || !globalTelegram.botToken || !globalTelegram.chatId)) return false;

    const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const start = new Date(`${booking.checkIn}T00:00:00`).getTime();
    const end = new Date(`${booking.checkOut}T00:00:00`).getTime();
    const nights = Math.max(1, Math.round((end - start) / 86_400_000));
    const message = [
      "🚨 <b>Cancellation Alert</b>",
      `🏢 <b>Property:</b> ${escapeHtml(property.name)}`,
      `❌ <b>Cancelled guest:</b> ${escapeHtml(`${booking.firstName} ${booking.lastName}`)}`,
      `📅 <b>Freed dates:</b> ${booking.checkIn} → ${booking.checkOut} (${nights} night${nights === 1 ? "" : "s"})`,
      `🌐 <b>Channel:</b> ${escapeHtml(booking.source)}`,
      "💡 Dates are now unblocked and available.",
    ].join("\n");
    return await sendTelegramMessage(
      message,
      hasPropertyTelegram ? property.telegramBotToken : globalTelegram?.botToken,
      hasPropertyTelegram ? property.telegramChatId : globalTelegram?.chatId,
    );
  } catch (error) {
    console.error("Failed to send cancellation alert:", error);
    return false;
  }
}
