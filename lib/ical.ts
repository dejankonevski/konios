import { listBookings, createBooking, updateBooking, deleteBooking } from "./bookings";
import { defaultSummaryConfig, listProperties } from "./portfolio";
import { notifyCancellationAlert, notifyNewBookingAlert } from "./telegram";

export interface IcalEvent {
  uid: string;
  summary: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  description?: string;
  status?: string;
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
        } else if (key === "STATUS") {
          currentEvent.status = value.trim().toUpperCase();
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
    configuredFeeds: 0,
    successfullyFetchedFeeds: 0,
    eventsRead: 0,
    cancellationsDetected: 0,
    cancellationNotificationsSent: 0,
    cancellationNotificationFailures: 0,
    notificationsSent: 0,
    notificationFailures: 0,
    feeds: [] as Array<{ source: "Airbnb" | "Booking.com"; configured: boolean; status: "not-configured" | "synced" | "failed"; events: number; error?: string }>,
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
  const successfullyFetchedSources = new Set<"Airbnb" | "Booking.com">();

  for (const feed of syncFeeds) {
    if (!feed.url?.trim()) {
      results.feeds.push({ source: feed.source, configured: false, status: "not-configured", events: 0 });
      continue;
    }

    results.configuredFeeds++;

    try {
      const response = await fetch(feed.url, {
        cache: "no-store",
        headers: { "User-Agent": "Konios-iCal-Sync/1.0", Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${feed.source} iCal`);
      }
      const icsData = await response.text();
      const events = parseIcal(icsData);
      successfullyFetchedSources.add(feed.source);
      results.successfullyFetchedFeeds++;
      results.eventsRead += events.length;
      results.feeds.push({ source: feed.source, configured: true, status: "synced", events: events.length });

      for (const event of events) {
        const summary = event.summary.trim();
        const isCancelled = event.status === "CANCELLED" || /\bCANCELLED\b|\bCANCELED\b/i.test(summary);
        // Do not mark a cancelled event as active. If it was imported before,
        // the source-aware cancellation pass below will archive it and alert.
        if (isCancelled) continue;
        const checkInAt = new Date(`${event.checkIn}T00:00:00Z`).getTime();
        const checkOutAt = new Date(`${event.checkOut}T00:00:00Z`).getTime();
        const eventNights = Math.round((checkOutAt - checkInAt) / 86_400_000);
        const isClosedOrBlocked = summary.toUpperCase().includes("CLOSED") || 
                                  summary.toUpperCase().includes("NOT AVAILABLE") || 
                                  summary.toUpperCase().includes("BLOCKED") ||
                                  summary.toUpperCase().includes("OWNER");
        // Booking.com's export intentionally hides guest details and labels real
        // reservations as "CLOSED - Not available". Import short entries as
        // anonymous reservations, but continue excluding long availability blocks.
        const isAnonymousBookingReservation = feed.source === "Booking.com" &&
          summary.toUpperCase().includes("CLOSED") &&
          eventNights > 0 && eventNights <= 30;
        if (isClosedOrBlocked && !isAnonymousBookingReservation) {
          continue; // Skip closed or blocked dates from being imported as guest bookings
        }

        activeSyncedUids.add(event.uid);

        let firstName: string = feed.source;
        let lastName: string = "Guest";

        const descName = extractGuestNameFromDescription(event.description);
        if (descName) {
          firstName = descName.firstName;
          lastName = descName.lastName;
        } else if (!isAnonymousBookingReservation && summary && summary !== "Reserved") {
          const cleanName = summary.replace(/\([^)]*\)/g, "").trim();
          const parts = cleanName.split(/\s+/);
          if (parts.length > 0 && parts[0] && parts[0].toLowerCase() !== "airbnb" && parts[0].toLowerCase() !== "booking.com") {
            firstName = parts[0];
            lastName = parts.slice(1).join(" ") || "Guest";
          }
        }

        let existing = existingIcalMap.get(event.uid);

        if (!existing) {
          const exactDateMatch = existingBookings.find(
            (b) => !b.revoked && b.checkIn === event.checkIn && b.checkOut === event.checkOut
          );
          if (exactDateMatch) {
            // A manually entered reservation already represents this unavailable
            // period. Link it when possible; otherwise simply avoid a duplicate.
            if (exactDateMatch.source === feed.source && exactDateMatch.icalUid !== event.uid) {
              if (exactDateMatch.icalUid) existingIcalMap.delete(exactDateMatch.icalUid);
              await updateBooking(exactDateMatch.id, { icalUid: event.uid });
              exactDateMatch.icalUid = event.uid;
              existingIcalMap.set(event.uid, exactDateMatch);
              results.updated++;
            }
            existing = exactDateMatch;
          } else if (existingBookings.some(
            (b) => !b.revoked && b.checkIn < event.checkOut && b.checkOut > event.checkIn
          )) {
            // Booking.com also exports short cross-channel/owner blocks as CLOSED.
            // Never turn an overlapping block into a second reservation.
            continue;
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
          existingBookings.push(newBooking);
          existingIcalMap.set(event.uid, newBooking);
          results.added++;
          const notificationSent = await notifyNewBookingAlert(propertyId, {
            firstName,
            lastName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            source: feed.source,
            notes: event.summary,
          });
          if (notificationSent) {
            results.notificationsSent++;
          } else if (({ ...defaultSummaryConfig, ...property.telegramSummaryConfig }).notifyNewReservations !== false) {
            results.notificationFailures++;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown sync error";
      results.errors.push(`${feed.source}: ${message}`);
      results.feeds.push({ source: feed.source, configured: true, status: "failed", events: 0, error: message });
    }
  }

  if (results.configuredFeeds === 0) {
    results.errors.push("No Airbnb or Booking.com import calendar URL is configured for this property.");
  }

  // Clean up any previously imported closed/blocked bookings
  for (const booking of existingBookings) {
    const notes = (booking.notes || "").toUpperCase();
    const fName = (booking.firstName || "").toUpperCase();
    // A calendar UID, not the editable guest name or imported summary, is the
    // permanent reservation identity. Renaming Booking.com Guest must never
    // make a subsequent sync archive the record.
    const isCalendarReservation = booking.source === "Booking.com" && Boolean(booking.icalUid);
    if (!isCalendarReservation &&
        (fName.includes("CLOSED") || fName.includes("NOT AVAILABLE") || fName.includes("BLOCKED") ||
         notes.includes("CLOSED") || notes.includes("NOT AVAILABLE") || notes.includes("BLOCKED"))) {
      await deleteBooking(booking.id);
      results.removed++;
    }
  }

  // Cancel imported reservations only when their source feed was fetched
  // successfully. A failed provider request must never erase reservations.
  for (const [uid, booking] of existingIcalMap.entries()) {
    if (successfullyFetchedSources.has(booking.source as "Airbnb" | "Booking.com") && !activeSyncedUids.has(uid)) {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (booking.checkOut >= todayStr) {
        await updateBooking(booking.id, {
          cancellationDetectedAt: Date.now(),
          cancellationSource: booking.source as "Airbnb" | "Booking.com",
          cancellationReason: "Reservation disappeared from or was marked cancelled in the provider calendar",
        });
        await deleteBooking(booking.id);
        results.removed++;
        results.cancellationsDetected++;
        const notificationSent = await notifyCancellationAlert(propertyId, {
          firstName: booking.firstName,
          lastName: booking.lastName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          source: booking.source,
          notes: booking.notes,
        });
        if (notificationSent) results.cancellationNotificationsSent++;
        else results.cancellationNotificationFailures++;
      }
    }
  }

  console.info("[ical-sync] completed", {
    propertyId,
    configuredFeeds: results.configuredFeeds,
    successfullyFetchedFeeds: results.successfullyFetchedFeeds,
    eventsRead: results.eventsRead,
    added: results.added,
    updated: results.updated,
    removed: results.removed,
    cancellationsDetected: results.cancellationsDetected,
    cancellationNotificationsSent: results.cancellationNotificationsSent,
    errors: results.errors,
  });

  return results;
}
