import { listBookings, createBooking, updateBooking } from "./bookings";
import { listProperties } from "./portfolio";

export interface IcalEvent {
  uid: string;
  summary: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  description?: string;
}

export function parseIcal(icsString: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const lines = icsString.split(/\r?\n/);
  let currentEvent: Partial<IcalEvent> | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.uid && currentEvent.checkIn && currentEvent.checkOut) {
        events.push(currentEvent as IcalEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const match = line.match(/^([A-Z0-9;=]+):(.*)$/);
      if (match) {
        const [, keyPart, value] = match;
        const key = keyPart.split(";")[0];
        
        if (key === "UID") {
          currentEvent.uid = value.trim();
        } else if (key === "SUMMARY") {
          currentEvent.summary = value.trim();
        } else if (key === "DESCRIPTION") {
          currentEvent.description = value.trim();
        } else if (key === "DTSTART") {
          currentEvent.checkIn = parseIcalDate(value.trim());
        } else if (key === "DTEND") {
          currentEvent.checkOut = parseIcalDate(value.trim());
        }
      }
    }
  }

  return events;
}

function parseIcalDate(val: string): string {
  const cleaned = val.replace(/[^0-9]/g, ""); // e.g. "20260811" or "20260811T150000Z"
  if (cleaned.length >= 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return "";
}

export async function syncPropertyIcal(propertyId: string) {
  const properties = await listProperties();
  const property = properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");

  const results = {
    added: 0,
    updated: 0,
    removed: 0,
    errors: [] as string[]
  };

  const syncFeeds = [
    { url: property.airbnbIcalUrl, source: "Airbnb" as const },
    { url: property.bookingIcalUrl, source: "Booking.com" as const }
  ];

  const existingBookings = await listBookings(propertyId);
  const existingIcalMap = new Map(
    existingBookings.filter((b) => b.icalUid).map((b) => [b.icalUid!, b])
  );

  const activeSyncedUids = new Set<string>();

  for (const feed of syncFeeds) {
    if (!feed.url?.trim()) continue;

    try {
      const response = await fetch(feed.url, { headers: { "User-Agent": "Konios-iCal-Sync/1.0" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${feed.source} iCal`);
      }
      const icsData = await response.text();
      const events = parseIcal(icsData);

      for (const event of events) {
        activeSyncedUids.add(event.uid);

        let firstName: string = feed.source;
        let lastName: string = "Guest";
        const summary = event.summary.trim();

        if (summary && summary !== "Reserved" && summary !== "Blocked") {
          const cleanName = summary.replace(/\([^)]*\)/g, "").trim();
          const parts = cleanName.split(/\s+/);
          if (parts.length > 0 && parts[0] && parts[0].toLowerCase() !== "airbnb" && parts[0].toLowerCase() !== "booking.com") {
            firstName = parts[0];
            lastName = parts.slice(1).join(" ") || "Guest";
          }
        }

        const existing = existingIcalMap.get(event.uid);

        if (existing) {
          if (existing.checkIn !== event.checkIn || existing.checkOut !== event.checkOut) {
            await updateBooking(existing.id, {
              checkIn: event.checkIn,
              checkOut: event.checkOut,
              notes: `Updated via iCal Sync. Original summary: ${event.summary}`
            });
            results.updated++;
          }
        } else {
          await createBooking({
            propertyId,
            firstName,
            lastName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            guests: 1,
            source: feed.source,
            notes: `Imported via iCal Sync. Summary: ${event.summary}`,
            icalUid: event.uid
          });
          results.added++;
        }
      }
    } catch (err: any) {
      results.errors.push(`${feed.source}: ${err.message}`);
    }
  }

  // Cancel bookings that are in the future but no longer in the iCal feeds
  for (const [uid, booking] of existingIcalMap.entries()) {
    if (!activeSyncedUids.has(uid)) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (booking.checkIn >= todayStr) {
        await updateBooking(booking.id, {
          revoked: true,
          notes: `${booking.notes} | Cancelled via iCal Sync.`
        });
        results.removed++;
      }
    }
  }

  return results;
}
