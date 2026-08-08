import { getRedis } from "@/lib/bookings";

export async function rateLimit(scope: string, identifier: string, limit: number, windowSeconds: number) {
  const redis = getRedis();
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `ratelimit:${scope}:${identifier}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds + 5);
  return { success: count <= limit, remaining: Math.max(0, limit - count) };
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}
