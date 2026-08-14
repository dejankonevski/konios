import Image from "next/image";

type ReservationSource = "Airbnb" | "Booking.com" | "Direct" | "Other";

export default function SourceBadge({ source, iconOnly = false }: { source: ReservationSource; iconOnly?: boolean }) {
  const asset = source === "Airbnb"
    ? { src: "/brands/airbnb.svg", alt: "Airbnb" }
    : source === "Booking.com"
      ? { src: "/brands/booking-dot-com.svg", alt: "Booking.com" }
      : null;

  return (
    <span className={`source-brand source-brand-${source.toLowerCase().replace(/[^a-z]/g, "")} ${iconOnly ? "is-icon-only" : ""}`} title={source} aria-label={`Reservation source: ${source}`}>
      {asset ? <Image src={asset.src} alt={asset.alt} width={22} height={22} /> : <span className="source-brand-fallback" aria-hidden="true">{source[0]}</span>}
      {!iconOnly ? <span>{source}</span> : null}
    </span>
  );
}
