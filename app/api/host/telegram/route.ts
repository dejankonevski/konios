import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { getTelegramConfig, saveTelegramConfig, sendTelegramMessage } from "@/lib/telegram";

export async function GET() {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session || session.role !== "master") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getTelegramConfig();
  if (!config) {
    return Response.json({ botToken: "", chatId: "", enabled: false });
  }

  const maskedToken = config.botToken
    ? `${config.botToken.slice(0, 6)}...${config.botToken.slice(-6)}`
    : "";

  return Response.json({
    botToken: maskedToken,
    chatId: config.chatId,
    enabled: config.enabled,
    hasToken: Boolean(config.botToken)
  });
}

export async function PUT(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session || session.role !== "master") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await request.json()) as { botToken?: string; chatId?: string; enabled?: boolean; test?: boolean };
  const existing = await getTelegramConfig();

  let botToken = input.botToken || "";
  if (botToken.includes("...") && existing?.botToken) {
    botToken = existing.botToken;
  }

  const nextConfig = {
    botToken: botToken.trim(),
    chatId: (input.chatId || "").trim(),
    enabled: Boolean(input.enabled)
  };

  if (nextConfig.enabled && (!nextConfig.botToken || !nextConfig.chatId)) {
    return Response.json({ error: "Bot token and Chat ID are required when enabled." }, { status: 400 });
  }

  await saveTelegramConfig(nextConfig);

  if (input.test) {
    const testSent = await sendTelegramMessage("<b>Hey Dejan!</b> 🚀 Telegram alerts from Konios House are now active and working perfectly.");
    if (!testSent) {
      return Response.json({ error: "Failed to send test message. Check your bot token and chat ID." }, { status: 400 });
    }
  }

  return Response.json({ success: true });
}
