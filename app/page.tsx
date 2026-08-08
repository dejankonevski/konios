import Link from "next/link";
import { listProperties } from "@/lib/portfolio";

export default async function Home() {
  const properties = (await listProperties()).filter((property) => property.active);

  return (
    <main className="property-chooser-page">
      <header className="property-chooser-header">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>KONIOS STAYS</span>
        </div>
        <span>Private guest portals</span>
      </header>

      <section className="property-chooser-hero">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>Choose your property.</h1>
          <p>Select the apartment from your reservation, then enter the five-digit guest PIN sent by your host.</p>
        </div>
        <div className="property-chooser-count">
          <strong>{properties.length}</strong>
          <span>{properties.length === 1 ? "guest property" : "guest properties"}</span>
        </div>
      </section>

      <section className="property-choice-grid" aria-label="Available properties">
        {properties.map((property, index) => (
          <Link href={`/${property.slug}`} key={property.id}>
            <span className="property-choice-number">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>Guest portal</small>
              <h2>{property.name}</h2>
              <p>{property.address}</p>
            </div>
            <b>Enter PIN <i>→</i></b>
          </Link>
        ))}
      </section>

      <footer className="property-chooser-footer">
        <p>Your PIN works only for the property and dates on your reservation.</p>
        <Link href="/host">Host access →</Link>
      </footer>
    </main>
  );
}
