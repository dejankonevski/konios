import { cookies } from "next/headers";
import { getHostSession } from "@/lib/access-code";
import { getBookingById } from "@/lib/bookings";
import { getPropertyById } from "@/lib/portfolio";
import { stripeClient } from "@/lib/stripe-settings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getHostSession((await cookies()).get("konios_host")?.value);
  if (!session) return Response.json({ error: "Sign in again to create a payment link." }, { status: 401 });

  const booking = await getBookingById((await params).id);
  if (!booking) return Response.json({ error: "Reservation not found." }, { status: 404 });
  const propertyId = booking.propertyId || "konios-house";
  if (session.role !== "master" && !session.propertyIds.includes(propertyId)) {
    return Response.json({ error: "Property access denied." }, { status: 403 });
  }
  if (booking.revoked || booking.isNoShow) {
    return Response.json({ error: "Payment links are unavailable for revoked or no-show reservations." }, { status: 400 });
  }

  const amountDue = Math.max(0, Number(booking.grossAmount) - Number(booking.paymentCollected || 0));
  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return Response.json({ error: "This reservation has no outstanding balance." }, { status: 400 });
  }

  const property = await getPropertyById(propertyId);
  const origin = new URL(request.url).origin;

  try {
    const stripe = await stripeClient();
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: (booking.currency || "EUR").toLowerCase(),
          unit_amount: Math.round(amountDue * 100),
          product_data: {
            name: `${property?.name || "Konios stay"} · ${booking.firstName} ${booking.lastName}`,
            description: `${booking.checkIn} to ${booking.checkOut}`,
          },
        },
      }],
      metadata: { bookingId: booking.id, propertyId, createdBy: session.username },
      payment_intent_data: { metadata: { bookingId: booking.id, propertyId } },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/host`,
    });

    if (!checkout.url) throw new Error("Stripe did not return a checkout URL.");
    return Response.json({ url: checkout.url, amountDue, currency: booking.currency || "EUR" });
  } catch (error) {
    console.error("Host payment link error", error);
    return Response.json({ error: "Stripe could not create this payment link. Check the Stripe key in Properties." }, { status: 502 });
  }
}
