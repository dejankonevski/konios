import { listBookings } from "@/lib/bookings";
import { listUnits } from "@/lib/portfolio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  const { unitId } = await params;
  const units = await listUnits();
  const unit = units.find((u) => u.id === unitId);

  if (!unit) {
    return new Response("Apartment unit not found", { status: 404 });
  }

  // Get active future/current bookings for this apartment
  const bookings = await listBookings(unit.propertyId);
  const unitBookings = bookings.filter(
    (b) => !b.revoked && (b.unitId === unitId || (!b.unitId && unitId === "konios-house-32"))
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
