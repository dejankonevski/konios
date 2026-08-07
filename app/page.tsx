"use client";

import { FormEvent, useEffect, useState } from "react";

const photos = [
  { src: "/apartment-main.png", alt: "Konios House living room and bedroom" },
  { src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=86", alt: "Minimal modern apartment lounge" },
  { src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=86", alt: "Open-plan dining space" },
  { src: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=86", alt: "Calm, comfortable bedroom" },
  { src: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?auto=format&fit=crop&w=1200&q=86", alt: "Fully equipped contemporary kitchen" },
];

const amenities = [
  ["⌁", "Fast Wi-Fi", "Reliable connection for work and streaming"],
  ["◫", "Free parking", "Private space included with your stay"],
  ["◇", "Self check-in", "Arrive on your schedule with smart entry"],
  ["☼", "Climate control", "Air conditioning and heating in every season"],
  ["⌂", "Full kitchen", "Cookware, coffee and everyday essentials"],
  ["✦", "Dedicated workspace", "A quiet, naturally lit place to focus"],
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [guests, setGuests] = useState(2);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGalleryOpen(false);
      if (!galleryOpen) return;
      if (event.key === "ArrowRight") setPhotoIndex((value) => (value + 1) % photos.length);
      if (event.key === "ArrowLeft") setPhotoIndex((value) => (value - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryOpen]);

  function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  function openPhoto(index: number) {
    setPhotoIndex(index);
    setGalleryOpen(true);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Konios House home">
          <span className="brand-mark">K</span>
          <span>KONIOS HOUSE</span>
        </a>
        <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">
          <span /> <span />
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Main navigation">
          <a href="#stay" onClick={() => setMenuOpen(false)}>The stay</a>
          <a href="#amenities" onClick={() => setMenuOpen(false)}>Amenities</a>
          <a href="#neighbourhood" onClick={() => setMenuOpen(false)}>Neighbourhood</a>
          <a className="nav-cta" href="#book" onClick={() => setMenuOpen(false)}>Check availability</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <img src={photos[0].src} alt={photos[0].alt} />
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow light">A quiet corner of Skopje</p>
          <h1>Stay beautifully.<br />Live locally.</h1>
          <p className="hero-text">A design-led one-bedroom retreat made for unhurried mornings, city adventures and a very good night&apos;s sleep.</p>
          <div className="hero-actions">
            <a className="button button-light" href="#book">Plan your stay <span>↗</span></a>
            <button className="text-button" onClick={() => openPhoto(0)}>Explore the space <span>→</span></button>
          </div>
        </div>
        <div className="hero-detail"><span>01</span><span>SKOPJE, NORTH MACEDONIA</span></div>
      </section>

      <section className="intro section" id="stay">
        <div>
          <p className="eyebrow">Welcome home</p>
          <h2>Everything you need.<br />Nothing you don&apos;t.</h2>
        </div>
        <div className="intro-copy">
          <p>Thoughtfully composed for two, Konios House pairs soft natural textures with considered details. Step out into the rhythm of central Skopje, then return to a space that feels entirely your own.</p>
          <div className="facts" aria-label="Apartment details">
            <div><strong>2</strong><span>guests</span></div>
            <div><strong>1</strong><span>bedroom</span></div>
            <div><strong>1</strong><span>bathroom</span></div>
            <div><strong>52</strong><span>square metres</span></div>
          </div>
        </div>
      </section>

      <section className="gallery" aria-label="Apartment gallery">
        <button className="gallery-main" onClick={() => openPhoto(1)}><img src={photos[1].src} alt={photos[1].alt} /></button>
        <div className="gallery-stack">
          <button onClick={() => openPhoto(2)}><img src={photos[2].src} alt={photos[2].alt} /></button>
          <button onClick={() => openPhoto(3)}><img src={photos[3].src} alt={photos[3].alt} /></button>
        </div>
        <button className="gallery-count" onClick={() => openPhoto(0)}>View all photos <span>05</span></button>
      </section>

      <section className="amenities section" id="amenities">
        <div className="section-heading">
          <p className="eyebrow">Made for real life</p>
          <h2>Comfort, considered.</h2>
          <p>The practical things are already taken care of, so you can settle in from the moment you arrive.</p>
        </div>
        <div className="amenity-grid">
          {amenities.map(([icon, title, copy]) => (
            <article key={title}>
              <span className="amenity-icon" aria-hidden="true">{icon}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="neighbourhood" id="neighbourhood">
        <div className="neighbourhood-image" />
        <div className="neighbourhood-copy">
          <p className="eyebrow light">The neighbourhood</p>
          <h2>Close to the city.<br />Far from the noise.</h2>
          <p>Start with coffee around the corner, wander through the Old Bazaar, and meet the Vardar at golden hour. The best of Skopje is within easy reach.</p>
          <ul>
            <li><span>08 min</span>Macedonia Square</li>
            <li><span>12 min</span>Old Bazaar</li>
            <li><span>15 min</span>City Park</li>
          </ul>
        </div>
      </section>

      <section className="quote section">
        <span className="quote-mark">“</span>
        <blockquote>We wanted it to feel less like a rental, and more like the home you wish you had in every city.</blockquote>
        <p>— Your hosts at Konios House</p>
      </section>

      <section className="booking section" id="book">
        <div className="booking-copy">
          <p className="eyebrow">Your Skopje stay</p>
          <h2>Ready when you are.</h2>
          <p>Share your dates and we&apos;ll get back to you with availability and everything you need to know.</p>
        </div>
        <form className="booking-card" onSubmit={submitInquiry}>
          {sent ? (
            <div className="success" role="status"><span>✓</span><h3>Inquiry received</h3><p>Thank you. We&apos;ll be in touch shortly with availability for your stay.</p><button type="button" onClick={() => setSent(false)}>Send another</button></div>
          ) : (
            <>
              <div className="date-fields">
                <label>Check in<input required type="date" aria-label="Check-in date" /></label>
                <label>Check out<input required type="date" aria-label="Check-out date" /></label>
              </div>
              <div className="guest-row">
                <div><span>Guests</span><strong>{guests} {guests === 1 ? "guest" : "guests"}</strong></div>
                <div className="stepper">
                  <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Remove guest">−</button>
                  <span>{guests}</span>
                  <button type="button" onClick={() => setGuests(Math.min(4, guests + 1))} aria-label="Add guest">+</button>
                </div>
              </div>
              <label className="email-field">Email address<input required type="email" placeholder="you@example.com" /></label>
              <button className="submit-button" type="submit">Request availability <span>↗</span></button>
              <p className="fine-print">No payment required. We usually reply within a few hours.</p>
            </>
          )}
        </form>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark">K</span><span>KONIOS HOUSE</span></a>
        <p>Thoughtful stays in Skopje.</p>
        <div><a href="mailto:stay@konios.house">stay@konios.house</a><a href="#top">Back to top ↑</a></div>
      </footer>

      {galleryOpen && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo gallery">
          <button className="close" onClick={() => setGalleryOpen(false)} aria-label="Close gallery">×</button>
          <button className="previous" onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)} aria-label="Previous photo">←</button>
          <img src={photos[photoIndex].src} alt={photos[photoIndex].alt} />
          <button className="next" onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)} aria-label="Next photo">→</button>
          <span className="lightbox-count">{String(photoIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</span>
        </div>
      )}
    </main>
  );
}
