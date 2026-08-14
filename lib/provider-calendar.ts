import { getRedis } from "@/lib/bookings";

export type ProviderCalendarEvent = {
  source: "Airbnb" | "Booking.com";
  uid: string;
  start: string;
  end: string;
  summary: string;
  status?: string;
  seenAt: number;
};

function nightsBetween(start: string, end: string) {
  return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
}

export function isActionableProviderEvent(event: ProviderCalendarEvent) {
  const nights = nightsBetween(event.start, event.end);
  if (!Number.isFinite(nights) || nights < 1 || nights > 30) return false;
  if (event.source === "Airbnb") return event.summary.trim().toLowerCase() === "reserved";
  return true;
}

const key = (propertyId: string) => `provider-calendar:${propertyId}`;

export async function listProviderCalendarEvents(propertyId: string) {
  const stored = await getRedis().get<ProviderCalendarEvent[]>(key(propertyId));
  return Array.isArray(stored) ? stored.sort((a, b) => a.start.localeCompare(b.start)) : [];
}

export async function replaceProviderCalendarEvents(
  propertyId: string,
  source: ProviderCalendarEvent["source"],
  events: Omit<ProviderCalendarEvent, "source" | "seenAt">[],
) {
  const existing = await listProviderCalendarEvents(propertyId);
  const seenAt = Date.now();
  const next = [
    ...existing.filter((event) => event.source !== source),
    ...events.map((event) => ({ ...event, source, seenAt })),
  ];
  await getRedis().set(key(propertyId), next);
  return next;
}
