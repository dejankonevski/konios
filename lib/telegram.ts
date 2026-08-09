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

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = await getTelegramConfig();
  if (!config || !config.enabled || !config.botToken || !config.chatId) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML"
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}
