import { listBookings, createBooking, updateBooking, deleteBooking } from "./bookings";
import { listProperties } from "./portfolio";
import { notifyNewBookingAlert, notifyCancellationAlert } from "./telegram";

export interface IcalEvent {
  uid: string;
  summary: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  description?: string;
}

export function parseIcal(icsString: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const rawLines = icsString.split(/\r?\n/);
  
  // Unfold folded lines
  const lines: string[] = [];
  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

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
          currentEvent.description = value.trim().replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\,/g, ",");
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

function extractGuestNameFromDescription(description?: string): { firstName: string; lastName: string } | null {
  if (!description) return null;
  const lines = description.split("\n");
  for (const line of lines) {
    const cleanLine = line.trim();
    const match = cleanLine.match(/^(?:Guest|Guest\s*Name|Name)\s*:\s*(.+)$/i);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name && name.toLowerCase() !== "reserved" && name.toLowerCase() !== "blocked") {
        const parts = name.split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ") || "Guest";
        return { firstName, lastName };
      }
    }
  }
  return null;
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
        const summary = event.summary.trim();
        const isClosedOrBlocked = summary.toUpperCase().includes("CLOSED") || 
                                  summary.toUpperCase().includes("NOT AVAILABLE") || 
                                  summary.toUpperCase().includes("BLOCKED") ||
                                  summary.toUpperCase().includes("OWNER");
        if (isClosedOrBlocked) {
          continue; // Skip closed or blocked dates from being imported as guest bookings
        }

        activeSyncedUids.add(event.uid);

        let firstName: string = feed.source;
        let lastName: string = "Guest";

        const descName = extractGuestNameFromDescription(event.description);
        if (descName) {
          firstName = descName.firstName;
          lastName = descName.lastName;
        } else if (summary && summary !== "Reserved") {
          const cleanName = summary.replace(/\([^)]*\)/g, "").trim();
          const parts = cleanName.split(/\s+/);
          if (parts.length > 0 && parts[0] && parts[0].toLowerCase() !== "airbnb" && parts[0].toLowerCase() !== "booking.com") {
            firstName = parts[0];
            lastName = parts.slice(1).join(" ") || "Guest";
          }
        }

        let existing = existingIcalMap.get(event.uid);

        if (!existing) {
          const manualMatch = existingBookings.find(
            (b) => !b.icalUid && !b.revoked && b.source === feed.source && b.checkIn === event.checkIn
          );
          if (manualMatch) {
            await updateBooking(manualMatch.id, { icalUid: event.uid });
            manualMatch.icalUid = event.uid;
            existingIcalMap.set(event.uid, manualMatch);
            existing = manualMatch;
          }
        }

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
          const newBooking = await createBooking({
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
          notifyNewBookingAlert(propertyId, {
            firstName,
            lastName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            source: feed.source,
            notes: event.summary,
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      results.errors.push(`${feed.source}: ${err.message}`);
    }
  }

  // Clean up any previously imported closed/blocked bookings
  for (const booking of existingBookings) {
    const notes = (booking.notes || "").toUpperCase();
    const fName = (booking.firstName || "").toUpperCase();
    if (fName.includes("CLOSED") || fName.includes("NOT AVAILABLE") || fName.includes("BLOCKED") ||
        notes.includes("CLOSED") || notes.includes("NOT AVAILABLE") || notes.includes("BLOCKED")) {
      await deleteBooking(booking.id);
      results.removed++;
    }
  }

  // Cancel & remove bookings that were imported via iCal but no longer exist in the active feeds (Cancellation Handling)
  for (const [uid, booking] of existingIcalMap.entries()) {
    if (!activeSyncedUids.has(uid)) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (booking.checkOut >= todayStr) {
        // Automatically delete the cancelled booking from list & database
        await deleteBooking(booking.id);
        results.removed++;

        // Trigger Telegram alert informing host of guest cancellation
        notifyCancellationAlert(propertyId, {
          firstName: booking.firstName,
          lastName: booking.lastName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          source: booking.source,
          notes: booking.notes,
        }).catch(() => {});
      }
    }
  }

  return results;
}
