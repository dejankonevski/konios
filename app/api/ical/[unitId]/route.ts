import { listBookings } from "@/lib/bookings";
import { listUnits, listProperties } from "@/lib/portfolio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await params;
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

  // Get active bookings for this property and unit
  const bookings = await listBookings(propertyId);
  const unitBookings = bookings.filter(
    (b) => !b.revoked && (b.unitId === unitId || (!b.unitId && (unitId === "konios-house-32" || unitId.endsWith("-unit"))))
  );

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
    const uid = b.icalUid || `booking-${b.id}@konios.com`;
    const summary = `${b.firstName} ${b.lastName} (${b.source})`;

    icsLines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${startVal}`,
      `DTEND;VALUE=DATE:${endVal}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:Guests: ${b.guests}\\nSource: ${b.source}\\nNotes: ${b.notes || ""}`,
      "END:VEVENT"
    );
  }

  icsLines.push("END:VCALENDAR");

  const icsData = icsLines.join("\r\n");

  return new Response(icsData, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendar-${unitId}.ics"`
    }
  });
}
