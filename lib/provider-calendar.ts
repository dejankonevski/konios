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
