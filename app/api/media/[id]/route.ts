import { getRedis } from "@/lib/bookings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const media = await getRedis().get<{ mimeType: string; base64: string }>(`media:${id}`);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(media.base64, "base64"), { headers: { "Content-Type": media.mimeType, "Cache-Control": "private, max-age=3600" } });
}
