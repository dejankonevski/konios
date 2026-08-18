import { listBookings, createBooking, updateBooking, deleteBooking } from "./bookings";
import { defaultSummaryConfig, listProperties, listUnits } from "./portfolio";
import { notifyCancellationAlert, notifyNewBookingAlert } from "./telegram";
import { replaceProviderCalendarEvents } from "./provider-calendar";
import { subtractDateRanges } from "./date-ranges";

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

function nightsBetween(start: string, end: string) {
  return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
}

function bookingSegmentUid(providerUid: string, start: string, end: string) {
  return `booking-calendar:${providerUid}:${start}:${end}`;
}

export async function syncPropertyIcal(propertyId: string) {
  const properties = await listProperties();
  const property = properties.find((p) => p.id === propertyId);
  if (!property) throw new Error("Property not found");
  const propertyUnitId = (await listUnits()).find((unit) => unit.propertyId === propertyId && unit.active)?.id || `${propertyId}-unit`;

  const results = {
    added: 0,
    updated: 0,
    removed: 0,
    configuredFeeds: 0,
    successfullyFetchedFeeds: 0,
    eventsRead: 0,
    availabilityBlocks: 0,
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
  const explicitlyCancelledUids = new Set<string>();
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
      const activeProviderEvents = events.filter((event) => {
        const summary = event.summary.trim();
        return event.status !== "CANCELLED" && !/\bCANCELLED\b|\bCANCELED\b/i.test(summary);
      });
      await replaceProviderCalendarEvents(propertyId, feed.source, activeProviderEvents.map((event) => ({
        uid: event.uid,
        start: event.checkIn,
        end: event.checkOut,
        summary: event.summary,
        status: event.status,
      })));
      results.availabilityBlocks += activeProviderEvents.length;
      successfullyFetchedSources.add(feed.source);
      results.successfullyFetchedFeeds++;
      results.eventsRead += events.length;
      results.feeds.push({ source: feed.source, configured: true, status: "synced", events: events.length });

      for (const event of events) {
        const summary = event.summary.trim();
        const isCancelled = event.status === "CANCELLED" || /\bCANCELLED\b|\bCANCELED\b/i.test(summary);
        // Do not mark a cancelled event as active. If it was imported before,
        // the source-aware cancellation pass below will archive it and alert.
        if (isCancelled) {
          explicitlyCancelledUids.add(event.uid);
          continue;
        }


        const eventNights = nightsBetween(event.checkIn, event.checkOut);
        if (!Number.isFinite(eventNights) || eventNights < 1 || eventNights > 30) continue;

        // Booking.com exposes only merged anonymous unavailable ranges (e.g. 2026-08-24 to 2026-08-28).
        // If part of the range is closed/blocked (e.g. 24th) or already covered by an existing booking,
        // subtract those dates so guest reservations are accurate (e.g. Aug 25 to Aug 28).
        if (feed.source === "Booking.com") {
          const coveredBookings = existingBookings.filter((booking) => (
            !booking.revoked && !booking.archivedAt &&
            booking.checkIn < event.checkOut && booking.checkOut > event.checkIn
          ));
          for (const booking of coveredBookings) {
            if (booking.source === "Booking.com" && booking.icalUid) {
              activeSyncedUids.add(booking.icalUid);
            }
          }

          let uncovered = subtractDateRanges(
            { start: event.checkIn, end: event.checkOut },
            coveredBookings.map((booking) => ({ start: booking.checkIn, end: booking.checkOut })),
          );

          for (const segment of uncovered) {
            const segmentUid = bookingSegmentUid(event.uid, segment.start, segment.end);
            activeSyncedUids.add(segmentUid);
            let existing = existingIcalMap.get(segmentUid);
            if (!existing) {
              existing = existingBookings.find((booking) => (
                !booking.revoked && !booking.archivedAt && booking.source === feed.source &&
                booking.checkIn === segment.start && booking.checkOut === segment.end
              ));
            }
            if (existing) {
              if (existing.icalMissingSince || existing.icalMissingCount) {
                await updateBooking(existing.id, { icalMissingSince: 0, icalMissingCount: 0 });
              }
              continue;
            }

            const newBooking = await createBooking({
              propertyId,
              unitId: propertyUnitId,
              firstName: "Booking.com",
              lastName: "Guest",
              checkIn: segment.start,
              checkOut: segment.end,
              guests: 1,
              source: feed.source,
              notes: `Imported via iCal Sync. Guest identity is hidden by Booking.com. Original summary: ${event.summary}`,
              icalUid: segmentUid,
              icalManaged: true,
              guestNameRequired: true,
            });
            existingBookings.push(newBooking);
            existingIcalMap.set(segmentUid, newBooking);
            results.added++;
            const notificationSent = await notifyNewBookingAlert(propertyId, {
              firstName: newBooking.firstName,
              lastName: newBooking.lastName,
              checkIn: newBooking.checkIn,
              checkOut: newBooking.checkOut,
              source: newBooking.source,
              notes: "Guest name is hidden by the Booking.com calendar. Open this reservation in Konios and enter the actual guest name.",
            });
            if (notificationSent) results.notificationsSent++;
            else if (({ ...defaultSummaryConfig, ...property.telegramSummaryConfig }).notifyNewReservations !== false) results.notificationFailures++;
          }
          continue;
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
          if (existing.icalMissingSince || existing.icalMissingCount) {
            await updateBooking(existing.id, { icalMissingSince: 0, icalMissingCount: 0 });
            existing.icalMissingSince = 0;
            existing.icalMissingCount = 0;
          }
          // Only update dates if they changed, strictly preserving any guest details (name, phone, price, notes) entered by host
          if (existing.checkIn !== event.checkIn || existing.checkOut !== event.checkOut) {
            await updateBooking(existing.id, {
              checkIn: event.checkIn,
              checkOut: event.checkOut,
            });
            results.updated++;
          }
        } else {
          const newBooking = await createBooking({
            propertyId,
            unitId: propertyUnitId,
            firstName,
            lastName,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            guests: 1,
            source: feed.source,
            notes: `Imported via iCal Sync. Summary: ${event.summary}`,
            icalUid: event.uid,
            icalManaged: true,
            guestNameRequired: firstName === feed.source && lastName === "Guest",
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

  // Prevent misclassified notes/names from being automatically deleted during sync
  // Only explicitly cancelled or absent iCal events should trigger cancellation workflows.

  // A provider feed can temporarily return an empty/partial result, or a host can
  // accidentally paste an export URL into an import field. Missing once is not
  // proof of cancellation. Explicit CANCELLED events are immediate; disappearances
  // require repeated observations, and a batch disappearance is quarantined.
  const todayStr = new Date().toISOString().slice(0, 10);
  const missingBySource = new Map<"Airbnb" | "Booking.com", Array<[string, typeof existingBookings[number]]>>();
  for (const [uid, booking] of existingIcalMap.entries()) {
    const source = booking.source as "Airbnb" | "Booking.com";
    if (source === "Booking.com" && !booking.icalManaged) continue;
    if (!successfullyFetchedSources.has(source) || activeSyncedUids.has(uid) || booking.checkOut < todayStr) continue;
    const entries = missingBySource.get(source) || [];
    entries.push([uid, booking]);
    missingBySource.set(source, entries);
  }

  const cancelBooking = async (booking: typeof existingBookings[number], reason: string) => {
    await updateBooking(booking.id, {
      cancellationDetectedAt: Date.now(),
      cancellationSource: booking.source as "Airbnb" | "Booking.com",
      cancellationReason: reason,
      icalMissingSince: 0,
      icalMissingCount: 0,
      archivedAt: null,
      revoked: false,
    });
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
  };

  for (const [source, missing] of missingBySource.entries()) {
    const explicit = missing.filter(([uid]) => explicitlyCancelledUids.has(uid));
    for (const [, booking] of explicit) {
      await cancelBooking(booking, "Provider calendar explicitly marked the reservation cancelled");
    }
    const unconfirmed = missing.filter(([uid]) => !explicitlyCancelledUids.has(uid));
    if (!unconfirmed.length) continue;

    if (unconfirmed.length > 1) {
      results.errors.push(`${source}: safety stop — ${unconfirmed.length} reservations disappeared together; no cancellations were applied.`);
      continue;
    }
    const [, booking] = unconfirmed[0];
    if (booking.checkIn <= todayStr && booking.checkOut > todayStr) {
      results.errors.push(`${source}: safety stop — current stay ${booking.firstName} ${booking.lastName} was missing; it was not cancelled.`);
      continue;
    }
    const now = Date.now();
    const missingSince = booking.icalMissingSince || now;
    const missingCount = (booking.icalMissingCount || 0) + 1;
    await updateBooking(booking.id, { icalMissingSince: missingSince, icalMissingCount: missingCount });
    if (missingCount >= 3 && now - missingSince >= 15 * 60 * 1000) {
      await cancelBooking(booking, "Reservation was absent from three successful provider syncs for at least 15 minutes");
    } else {
      results.errors.push(`${source}: cancellation pending verification (${missingCount}/3 observations).`);
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
