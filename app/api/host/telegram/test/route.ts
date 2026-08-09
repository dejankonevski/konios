import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session || session.role !== "master") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await request.json()) as { botToken?: string; chatId?: string; propertyName?: string };
  if (!input.botToken || !input.chatId) {
    return Response.json({ error: "Bot token and Chat ID are required for test." }, { status: 400 });
  }

  const propName = input.propertyName || "Test Apartment";
  const sent = await sendTelegramMessage(
    `<b>Telegram Alert Test</b> 🚀\nIntegration is working correctly for property: <b>${propName}</b>!`,
    input.botToken,
    input.chatId
  );

  if (!sent) {
    return Response.json({ error: "Failed to send message. Please verify your bot token and chat ID." }, { status: 400 });
  }

  return Response.json({ success: true });
}
