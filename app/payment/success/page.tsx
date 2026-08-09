import Link from "next/link";
import { getBookingById, updateBooking } from "@/lib/bookings";
import { getPropertyById } from "@/lib/portfolio";
import { stripeClient } from "@/lib/stripe-settings";

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams;
  let paid = false;
  let propertySlug = "konios-house";
  let amountLabel = "";

  if (sessionId?.startsWith("cs_")) {
    try {
      const stripe = await stripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const bookingId = session.metadata?.bookingId;
      const booking = bookingId ? await getBookingById(bookingId) : null;
      if (booking) {
        const property = await getPropertyById(booking.propertyId || "konios-house");
        propertySlug = property?.slug || "konios-house";
        if (session.payment_status === "paid") {
          const paidAmount = (session.amount_total || 0) / 100;
          await updateBooking(booking.id, { paymentCollected: Math.min(Number(booking.grossAmount) || paidAmount, (Number(booking.paymentCollected) || 0) + paidAmount) });
          paid = true;
          amountLabel = new Intl.NumberFormat("en", { style: "currency", currency: (session.currency || booking.currency || "EUR").toUpperCase() }).format(paidAmount);
        }
      }
    } catch (error) {
      console.error("Stripe success verification error", error);
    }
  }

  return <main className="payment-result-page"><section><span className={paid ? "payment-result-icon paid" : "payment-result-icon"}>{paid ? "✓" : "!"}</span><p className="eyebrow">Secure payment</p><h1>{paid ? "Payment received." : "Payment not confirmed."}</h1><p>{paid ? `Thank you. Your ${amountLabel} payment was confirmed and recorded on your reservation.` : "We could not confirm a completed payment. No reservation balance was changed."}</p><Link href={`/${propertySlug}`}>{paid ? "Return to guest access" : "Return to the property page"} →</Link></section></main>;
}
