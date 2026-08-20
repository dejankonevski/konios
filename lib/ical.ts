import { listBookings, createBooking, updateBooking, deleteBooking, isDateRangeOverlap } from "./bookings";
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
  const cleaned = val.replace(/[^0-9]/g, "");
  if (cleaned.length >= 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  return "";
}

// Calendar Sync Disabled per host request
export async function syncPropertyIcal(_propertyId: string) {
  return {
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
    feeds: [],
    errors: ["Calendar sync is disabled."],
  };
}

export interface PendingSyncItem {
  tempId: string;
  source: "Airbnb" | "Booking.com";
  icalUid: string;
  checkIn: string;
  checkOut: string;
  summary: string;
  firstName: string;
  lastName: string;
  phone?: string;
  grossAmount?: number;
  netAmount?: number;
  channelFeeAmount?: number;
  touristTaxAmount?: number;
  notes?: string;
  status: "new" | "date-update" | "conflict" | "already-synced";
  existingBookingId?: string;
  conflictBookingId?: string;
  conflictReason?: string;
}

export async function previewPropertyIcal(_propertyId: string): Promise<{
  pendingItems: PendingSyncItem[];
  configuredFeeds: number;
  eventsRead: number;
  errors: string[];
}> {
  return { pendingItems: [], configuredFeeds: 0, eventsRead: 0, errors: ["Calendar sync is disabled."] };
}

export async function commitPropertyIcalSync(
  _propertyId: string,
  _approvedItems: PendingSyncItem[]
): Promise<{ added: number; updated: number; notificationsSent: number }> {
  return { added: 0, updated: 0, notificationsSent: 0 };
}
