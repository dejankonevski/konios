import { rateLimit, requestIp } from "@/lib/rate-limit";
import { bookingState, getBookingByToken } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import { getPropertyById } from "@/lib/portfolio";
import { stripeClient } from "@/lib/stripe-settings";

export async function POST(request: Request) {
  const limited = await rateLimit("guest-checkout", requestIp(request), 8, 10 * 60);
  if (!limited.success) return Response.json({ error: "Too many payment attempts. Please wait and try again." }, { status: 429 });
  const { accessToken } = (await request.json()) as { accessToken?: string };
  const booking = accessToken ? await getBookingByToken(accessToken) : null;
  if (!booking) return Response.json({ error: "Your guest access is no longer valid. Enter your PIN again." }, { status: 401 });
  const guide = await getGuestGuide(booking.propertyId || "konios-house");
  const state = bookingState(booking, new Date(), guide);
  if (state.status !== "active") return Response.json({ error: "Online payment is not available for this stay." }, { status: 403 });
  const amountDue = Math.max(0, Number(booking.grossAmount) - Number(booking.paymentCollected || 0));
  if (!Number.isFinite(amountDue) || amountDue <= 0) return Response.json({ error: "This reservation has no outstanding balance." }, { status: 400 });

  const currency = (booking.currency || "EUR").toLowerCase();
  const unitAmount = Math.round(amountDue * 100);
  const property = await getPropertyById(booking.propertyId || "konios-house");
  const origin = new URL(request.url).origin;

  try {
    const stripe = await stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: { name: `${property?.name || "Konios stay"} · ${booking.checkIn} to ${booking.checkOut}` },
        },
      }],
      metadata: { bookingId: booking.id, propertyId: booking.propertyId || "konios-house" },
      payment_intent_data: { metadata: { bookingId: booking.id, propertyId: booking.propertyId || "konios-house" } },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/${property?.slug || "konios-house"}`,
    });
    return Response.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error", error);
    return Response.json({ error: "Payment checkout could not be started. Please contact your host." }, { status: 502 });
  }
}
