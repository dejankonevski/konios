import { listBookings } from "@/lib/bookings";
import { listUnits, listProperties } from "@/lib/portfolio";
import { listCalendarBlocks } from "@/lib/calendar-blocks";

function escapeIcalText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcStamp(timestamp: number) {
  return new Date(timestamp).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await params;
  const excludedSource = new URL(request.url).searchParams.get("exclude");
  const [properties, units] = await Promise.all([listProperties(), listUnits()]);
  
  let unit = units.find((u) => u.id === unitId);
  let propertyId = unit?.propertyId;

  if (!unit) {
    // If unit is not found, check if it matches a property ID with the "-unit" suffix
    const potentialPropId = unitId.endsWith("-unit") ? unitId.slice(0, -5) : unitId;
    const property = properties.find((p) => p.id === potentialPropId || p.slug === potentialPropId);
    if (property) {
      propertyId = property.id;
    } else {
      return new Response("Apartment unit not found", { status: 404 });
    }
  }

  // Get active bookings and personal calendar blocks for this property
  const [bookings, blocks] = await Promise.all([
    listBookings(propertyId),
    listCalendarBlocks(propertyId || ""),
  ]);

  const propertyUnits = units.filter((candidate) => candidate.propertyId === propertyId && candidate.active);
  const primaryUnitId = propertyUnits[0]?.id;
  const unitBookings = bookings.filter((booking) => {
    if (booking.revoked || booking.archivedAt) return false;
    if (excludedSource) {
      if (booking.source.toLowerCase() === excludedSource.toLowerCase()) return false;
    } else if (booking.source === "Airbnb" || booking.source === "Booking.com") {
      // The legacy generic URL may already be subscribed by either provider.
      // Never echo provider reservations through that ambiguous feed: doing so
      // turns a platform's own reservation into an imported external block and
      // can make its extranet report "No inventory". Destination-specific URLs
      // below intentionally carry only the other platform's reservations.
      return false;
    }
    // A property-level feed contains the whole property's availability. A real
    // unit feed contains that unit plus legacy reservations that predate unit IDs
    // when it is the property's primary unit.
    if (!unit) return true;
    return booking.unitId === unit.id || (!booking.unitId && primaryUnitId === unit.id);
  });

  let icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Konios//iCal Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  for (const b of unitBookings) {
    const startVal = b.checkIn.replace(/-/g, "");
    const endVal = b.checkOut.replace(/-/g, "");
    const uid = `booking-${b.id}@konios.vercel.app`;
    const summary = `Reserved (${b.source})`;

    icsLines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${utcStamp(b.createdAt || Date.now())}`,
      `LAST-MODIFIED:${utcStamp(Date.now())}`,
      "SEQUENCE:0",
      `DTSTART;VALUE=DATE:${startVal}`,
      `DTEND;VALUE=DATE:${endVal}`,
      `SUMMARY:${escapeIcalText(summary)}`,
      `DESCRIPTION:${escapeIcalText(`Reserved in Konios · Source: ${b.source}`)}`,
      "END:VEVENT"
    );
  }

  // Also export admin blocked / closed dates so external platforms (Airbnb, Booking.com) sync them as unavailable
  for (const block of blocks) {
    const startVal = block.start.replace(/-/g, "");
    const endVal = block.end.replace(/-/g, "");
    const uid = `block-${block.id}@konios.com`;
    const summary = `Closed / Blocked (${block.note || "Owner Use"})`;

    icsLines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${utcStamp(block.createdAt || Date.now())}`,
      `LAST-MODIFIED:${utcStamp(Date.now())}`,
      "SEQUENCE:0",
      `DTSTART;VALUE=DATE:${startVal}`,
      `DTEND;VALUE=DATE:${endVal}`,
      `SUMMARY:${escapeIcalText(summary)}`,
      `DESCRIPTION:${escapeIcalText(`Blocked by host: ${block.note || "Closed"}`)}`,
      "END:VEVENT"
    );
  }

  icsLines.push("END:VCALENDAR");

  const icsData = icsLines.join("\r\n");

  return new Response(icsData, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="calendar-${unitId}.ics"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    }
  });
}
