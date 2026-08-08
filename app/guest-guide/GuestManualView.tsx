"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Booking } from "@/lib/bookings";
import type { GuestGuide } from "@/lib/guest-guide";
import CopyButton from "@/app/guest-guide/CopyButton";

export const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch (German)", flag: "🇩🇪" },
  { code: "tr", name: "Türkçe (Turkish)", flag: "🇹🇷" },
  { code: "es", name: "Español (Spanish)", flag: "🇪🇸" },
  { code: "fr", name: "Français (French)", flag: "🇫🇷" },
  { code: "sr", name: "Српски (Serbian)", flag: "🇷🇸" },
  { code: "hr", name: "Hrvatski (Croatian)", flag: "🇭🇷" },
  { code: "sl", name: "Slovenščina (Slovenian)", flag: "🇸🇮" },
  { code: "sq", name: "Shqip (Albanian)", flag: "🇦🇱" },
  { code: "el", name: "Ελληνικά (Greek)", flag: "🇬🇷" },
  { code: "pt", name: "Português (Portuguese)", flag: "🇵🇹" },
  { code: "mk", name: "Македонски (Macedonian)", flag: "🇲🇰" },
  { code: "it", name: "Italiano (Italian)", flag: "🇮🇹" },
];

const restaurants = [
  ["Gradska Kafeana Dvor", "Local dining", "Mention you are a guest of Dejan and Ivana for 10% off. Reserve ahead on weekends.", "/guide-places/gradska-kafeana-dvor.jpg"],
  ["Gostilnica Dukat", "Local favourite", "Authentic Macedonian food. Try chorba, warm bread and Ohridsko makalo.", "/guide-places/gostilnica-dukat.jpg"],
  ["Skopski Merak", "Dinner", "Premium Macedonian and international dishes. Reserve ahead on weekends.", "/guide-places/skopski-merak.jpg"],
  ["Beer Garden", "Drinks & sport", "Craft beer, pub food, outdoor seating, football matches and live weekend music.", "/guide-places/beer-garden.jpg"],
  ["Matto Napoletano", "Pizza", "Award-winning Neapolitan pizza. Code URBANESTI includes a free lemon sorbet with food.", "/guide-places/matto-napoletano.jpg"],
  ["Café Capri", "Coffee", "A relaxed neighbourhood café and bar with pleasant outdoor seating.", "/guide-places/cafe-capri.jpg"],
  ["Restaurant Treska", "Nature escape", "Traditional food beside the Treska River, about 20 minutes away. Family-friendly; no alcohol served.", "/guide-places/restaurant-treska.jpg"],
];
const sights = [
  ["Matka Canyon", "Cliffside walks, boat or kayak rides and Vrelo Cave, around 30 minutes from the city.", "/guide-places/matka-canyon.jpg"],
  ["Macedonia Square", "The central square, Stone Bridge and illuminated fountains - especially atmospheric in the evening.", "/guide-places/macedonia-square.jpg"],
  ["Old Bazaar", "Ottoman-era lanes, craft shops, Turkish coffee and local kebapi.", "/guide-places/old-bazaar.jpg"],
  ["Skopje Fortress", "Free entry and panoramic city views; a lovely sunset stop above the Old Bazaar.", "/guide-places/skopje-fortress.jpg"],
  ["Millennium Cross", "Take the cable car from Middle Vodno for valley views. It is usually closed on Mondays.", "/guide-places/millennium-cross.jpg"],
];
const nearbyPlaces = [
  ["Kipper Market", "Groceries next door", "Everyday groceries, cold drinks and useful basics, right beside the building.", "/guide-places/kipper-market.jpg"],
  ["Crown 1985", "Bakery · 100 m away", "Fresh bread, burek and pastries for an easy breakfast close to home.", "/guide-places/crown-1985.jpg"],
  ["Silbo Bakery", "Local bakery favourite", "A well-known Skopje stop for savoury pies, pastries and a quick snack.", "/guide-places/silbo-bakery.jpg"],
];

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
const available = (value: string) => value || "Contact your host for this detail";
const mapsLink = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, Skopje, North Macedonia`)}`;

type GuideSection = "checkin" | "essentials" | "explore" | "checkout";

const sectionForStage = (stayStage: string): GuideSection => {
  if (stayStage === "checkout-day" || stayStage === "after-departure") return "checkout";
  if (stayStage === "during-stay") return "essentials";
  return "checkin";
};

export default function GuestManualView({
  booking,
  guide,
  accessState,
}: {
  booking: Booking;
  guide: GuestGuide;
  accessState: { revealAccess: boolean; stayStage: string; accessDetailsAt: string };
}) {
  const [selectedLang, setSelectedLang] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("konios_lang") || "en";
    }
    return "en";
  });
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string; subtitle?: string } | null>(null);
  const [activeSection, setActiveSection] = useState<GuideSection>(() => sectionForStage(accessState.stayStage));
  const accessDetailsLabel = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Skopje",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(accessState.accessDetailsAt));

  function showSection(section: GuideSection) {
    setActiveSection(section);
    window.setTimeout(() => {
      document.getElementById("guide-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (booking.id === "host-preview") return;
    void fetch("/api/access", { method: "DELETE", keepalive: true });
  }, [booking.id]);

  useEffect(() => {
    // Inject Google Translate script if needed
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateInit";
      script.async = true;
      document.body.appendChild(script);

      (window as unknown as Record<string, unknown>).googleTranslateInit = () => {
        const TranslateElement = (window as unknown as { google?: { translate?: { TranslateElement?: new (options: unknown, id: string) => void } } })?.google?.translate?.TranslateElement;
        if (TranslateElement) {
          new TranslateElement(
            {
              pageLanguage: "en",
              includedLanguages: "en,de,tr,es,fr,sr,hr,sl,sq,el,pt,mk,it",
              autoDisplay: false,
            },
            "google_translate_element"
          );
        }
      };
    }
  }, []);

  function handleLanguageChange(langCode: string) {
    setSelectedLang(langCode);
    localStorage.setItem("konios_lang", langCode);

    if (langCode === "en") {
      document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
      window.location.reload();
    } else {
      document.cookie = `googtrans=/en/${langCode}; path=/;`;
      document.cookie = `googtrans=/en/${langCode}; path=/; domain=.${window.location.hostname};`;
      
      const select = document.querySelector(".goog-te-combo") as HTMLSelectElement;
      if (select) {
        select.value = langCode;
        select.dispatchEvent(new Event("change"));
      } else {
        window.location.reload();
      }
    }
  }

  const phone = guide.hostPhone.replace(/[^+\d]/g, "");
  const apartmentInstructions = [
    ["Air conditioning", guide.airConditioning],
    ["Heating", guide.heating],
    ["Hot water", guide.hotWater],
    ["Rubbish & recycling", guide.rubbish],
  ].filter(([, copy]) => copy.trim());

  const currentLangObj = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[0];

  return (
    <main className="guest-manual" id="top">
      {/* Hidden Google Translate container */}
      <div id="google_translate_element" style={{ display: "none" }} />

      <header className="manual-header">
        <a className="brand" href="#top">
          <span className="brand-mark">K</span>
          <span>{guide.propertyName}</span>
        </a>
        <nav aria-label="Guide sections">
          <button type="button" onClick={() => showSection("checkin")}>Check in</button>
          <button type="button" onClick={() => showSection("essentials")}>Essentials</button>
          <button type="button" onClick={() => showSection("explore")}>Explore</button>
          <button type="button" onClick={() => showSection("checkout")}>Check out</button>
        </nav>

        {/* Multi-Lingual Selector */}
        <div className="header-actions">
          <div className="lang-dropdown-wrapper">
            <span className="lang-current-pill">
              <span className="lang-flag">{currentLangObj.flag}</span>
              <span className="lang-code-txt">{currentLangObj.code.toUpperCase()}</span>
              <span className="dropdown-caret">▾</span>
            </span>
            <select
              className="lang-select-native"
              value={selectedLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
              title="Select language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>
          <span className="manual-stay">
            {dateLabel(booking.checkIn)} - {dateLabel(booking.checkOut)}
          </span>
        </div>
      </header>

      <section className="guide-hub" aria-labelledby="guide-hub-title">
        <div className="guide-hub-intro">
          <p className="eyebrow">Your guide for right now</p>
          <h1 id="guide-hub-title">
            {activeSection === "checkin" ? "Ready for arrival." : null}
            {activeSection === "essentials" ? "Settle in comfortably." : null}
            {activeSection === "explore" ? "Discover our Skopje." : null}
            {activeSection === "checkout" ? "A simple departure." : null}
          </h1>
          <p>
            {activeSection === "checkin" ? "Your arrival steps are ready. Codes appear only when the apartment is ready for you." : null}
            {activeSection === "essentials" ? "Wi-Fi and the apartment answers you are most likely to need are shown first." : null}
            {activeSection === "explore" ? "Open our personal food, city and transport recommendations whenever you are ready." : null}
            {activeSection === "checkout" ? `Checkout is at ${guide.checkOutTime}. Everything to do before you leave is below.` : null}
          </p>
        </div>
        <div className="guide-hub-grid">
          {([
            ["checkin", "01", "Check in", "Directions, parking, entrance and key"],
            ["essentials", "02", "Apartment essentials", "Wi-Fi, controls, house info and answers"],
            ["explore", "03", "Explore Skopje", "Food, sights, nearby places and taxis"],
            ["checkout", "04", "Check out", `Your ${guide.checkOutTime} departure checklist`],
          ] as [GuideSection, string, string, string][]).map(([id, number, title, copy]) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? "is-active" : ""}
              aria-pressed={activeSection === id}
              onClick={() => showSection(id)}
            >
              <span>{number}</span>
              <strong>{title}</strong>
              <small>{copy}</small>
              <b aria-hidden="true">→</b>
            </button>
          ))}
        </div>
      </section>

      <section className="manual-hero">
        <div>
          <p className="eyebrow">Your private guest guide</p>
          <h1>
            Welcome,
            <br />
            {booking.firstName}.
          </h1>
          <p>
            Everything you need for an easy arrival and a comfortable stay in Skopje, collected in one place.
          </p>
          <div className="hero-host-banner">
            <div className="hero-host-avatar">
              <Image
                src={guide.hostPhotoUrl || "/host-profile.jpg"}
                alt={guide.hostName || "Dejan & Ivana"}
                fill
                sizes="140px"
                priority
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="hero-host-copy">
              <span className="hero-host-tag">A welcome note from your hosts</span>
              <h3>{guide.hostName || "Dejan & Ivana"}</h3>
              <p>
                “
                {guide.welcomeMessage ||
                  "Welcome to Konios House! We are delighted to host you in Skopje. If you need anything during your stay, don't hesitate to reach out. Wish you a wonderful visit!"}
                ”
              </p>
            </div>
          </div>
        </div>
        <aside>
          <span>Your stay</span>
          <div className="stay-date">
            <b>Check-in</b>
            <strong>{dateLabel(booking.checkIn)}</strong>
            <i>
              <em>{guide.checkInTime}</em> arrival time
            </i>
          </div>
          <span className="stay-rule" />
          <div className="stay-date">
            <b>Checkout</b>
            <strong>{dateLabel(booking.checkOut)}</strong>
            <i>
              <em>{guide.checkOutTime}</em> departure time
            </i>
          </div>
          {guide.hostPhone ? <a href={`tel:${phone}`}>Call {guide.hostName || "your host"} ↗</a> : null}
        </aside>
      </section>

      <div className="guide-content" id="guide-content">
      {activeSection === "checkin" ? (
      <section className="manual-section" id="arrival">
        <div className="manual-heading">
          <p className="eyebrow">Start here</p>
          <h2>Arrival, step by step.</h2>
          <p>Keep this page open as you approach the building.</p>
        </div>
        {!accessState.revealAccess ? <div className="access-release-notice"><strong>Apartment access details unlock {accessDetailsLabel}.</strong><p>You can already use the general guide, directions and parking information. The intercom, building and lockbox codes remain hidden until the apartment is ready.</p></div> : null}
        <div className="arrival-steps">
          <article>
            <span>01</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step1PhotoUrl || "/self-checkin-guide.png",
                    title: "Step 01: Find the building",
                    subtitle: available(guide.address),
                  })
                }
              >
                <Image
                  src={guide.step1PhotoUrl || "/self-checkin-guide.png"}
                  alt="Konios House building and main entrance"
                  fill
                  sizes="300px"
                  unoptimized
                  style={
                    guide.step1PhotoUrl && guide.step1PhotoUrl !== "/self-checkin-guide.png"
                      ? undefined
                      : { objectPosition: "center 18%" }
                  }
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Find the building</small>
              <h3>{available(guide.address)}</h3>
              <p>{available(guide.directions)}</p>
              {guide.mapsUrl ? (
                <a className="arrival-map" href={guide.mapsUrl} target="_blank" rel="noreferrer">
                  ⌖ Open directions in Google Maps ↗
                </a>
              ) : null}
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step2PhotoUrl || "/self-checkin-guide.png",
                    title: "Step 02: Park",
                    subtitle: `Parking space ${available(guide.parkingSpace)}`,
                  })
                }
              >
                <Image
                  src={guide.step2PhotoUrl || "/self-checkin-guide.png"}
                  alt="Outdoor parking space"
                  fill
                  sizes="300px"
                  unoptimized
                  style={
                    guide.step2PhotoUrl && guide.step2PhotoUrl !== "/self-checkin-guide.png"
                      ? undefined
                      : { objectPosition: "center 39%" }
                  }
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Park</small>
              <h3>Parking space</h3>
              <div className="access-number">{available(guide.parkingSpace)}</div>
              <p>{available(guide.parking)}</p>
            </div>
          </article>
          {accessState.revealAccess ? <><article>
            <span>03</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step3PhotoUrl || "/self-checkin-guide.png",
                    title: "Step 03: Enter the building",
                    subtitle: `Building code: ${available(guide.buildingCode)}`,
                  })
                }
              >
                <Image
                  src={guide.step3PhotoUrl || "/self-checkin-guide.png"}
                  alt="Building intercom and entrance code"
                  fill
                  sizes="300px"
                  unoptimized
                  style={
                    guide.step3PhotoUrl && guide.step3PhotoUrl !== "/self-checkin-guide.png"
                      ? undefined
                      : { objectPosition: "center 59%" }
                  }
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Enter the building</small>
              <h3>Building code</h3>
              <div className="access-number">{available(guide.buildingCode)}</div>
              {guide.buildingCode ? <CopyButton value={guide.buildingCode} /> : null}
              <p className="instruction-lines">{available(guide.buildingEntryInstructions)}</p>
            </div>
          </article>
          <article>
            <span>04</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step4PhotoUrl || "/self-checkin-guide.png",
                    title: "Step 04: Find your door",
                    subtitle: guide.floor ? `Floor ${guide.floor} · Apartment ${guide.apartmentNumber}` : "Apartment door",
                  })
                }
              >
                <Image
                  src={guide.step4PhotoUrl || "/self-checkin-guide.png"}
                  alt="Hallway leading to apartment 32"
                  fill
                  sizes="300px"
                  unoptimized
                  style={
                    guide.step4PhotoUrl && guide.step4PhotoUrl !== "/self-checkin-guide.png"
                      ? undefined
                      : { objectPosition: "center 79%" }
                  }
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Find your door</small>
              <h3>
                {guide.floor ? `Floor ${guide.floor}` : "Apartment location"}
                {guide.apartmentNumber ? ` · ${guide.apartmentNumber}` : ""}
              </h3>
              <p>{available(guide.apartmentDirections)}</p>
            </div>
          </article>
          <article>
            <span>05</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step5PhotoUrl || "/self-checkin-guide.png",
                    title: "Step 05: Collect the key",
                    subtitle: `Keybox code: ${available(guide.lockboxCode)}`,
                  })
                }
              >
                <Image
                  src={guide.step5PhotoUrl || "/self-checkin-guide.png"}
                  alt="Keybox beside apartment 32"
                  fill
                  sizes="300px"
                  unoptimized
                  style={
                    guide.step5PhotoUrl && guide.step5PhotoUrl !== "/self-checkin-guide.png"
                      ? undefined
                      : { objectPosition: "center 98%" }
                  }
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Collect the key</small>
              <h3>Keybox code</h3>
              <div className="access-number">{available(guide.lockboxCode)}</div>
              {guide.lockboxCode ? <CopyButton value={guide.lockboxCode} /> : null}
              <p>{available(guide.lockboxInstructions)}</p>
            </div>
          </article>
          <article>
            <span>06</span>
            <div>
              <div
                className="arrival-photo clickable-photo"
                title="Tap to view full image"
                onClick={() =>
                  setPreviewImage({
                    src: guide.step6PhotoUrl || "/apartment-main.png",
                    title: "Step 06: Get connected",
                    subtitle: `Wi-Fi: ${available(guide.wifiName)}`,
                  })
                }
              >
                <Image
                  src={guide.step6PhotoUrl || "/apartment-main.png"}
                  alt="Konios House apartment interior"
                  fill
                  sizes="300px"
                  unoptimized
                />
                <span className="photo-expand-badge">🔍 Zoom photo</span>
              </div>
              <small>Get connected</small>
              <h3>Wi-Fi</h3>
              <p className="flow-label">Network</p>
              <div className="flow-value">{available(guide.wifiName)}</div>
              {guide.wifiName ? <CopyButton value={guide.wifiName} /> : null}
              <p className="flow-label">Password</p>
              <div className="flow-value clear-value">{available(guide.wifiPassword)}</div>
              {guide.wifiPassword ? <CopyButton value={guide.wifiPassword} /> : null}
            </div>
          </article></> : null}
        </div>
      </section>
      ) : null}

      {activeSection === "essentials" ? (
        <section className="manual-section manual-dark" id="essentials">
          <div className="manual-heading">
            <p className="eyebrow">At home</p>
            <h2>Apartment essentials.</h2>
            <p>Wi-Fi and quick answers for a comfortable stay, all in one place.</p>
          </div>
          <div className="essential-grid essentials-now">
            <article>
              <span>Wi-Fi network</span>
              <strong>{accessState.revealAccess ? available(guide.wifiName) : "Available when access unlocks"}</strong>
              {accessState.revealAccess && guide.wifiName ? <CopyButton value={guide.wifiName} /> : <small>Unlocks {accessDetailsLabel}</small>}
            </article>
            <article>
              <span>Wi-Fi password</span>
              <strong className="clear-value">{accessState.revealAccess ? available(guide.wifiPassword) : "Hidden until arrival"}</strong>
              {accessState.revealAccess && guide.wifiPassword ? <CopyButton value={guide.wifiPassword} /> : <small>Protected until the apartment is ready</small>}
            </article>
            <article>
              <span>Your host</span>
              <strong>{guide.hostName || "Your host"}</strong>
              {guide.hostPhone ? <a href={`tel:${phone}`}>Call {guide.hostName || "your host"} ↗</a> : <small>Contact details are not available</small>}
            </article>
            <article>
              <span>Quiet hours</span>
              <strong>{guide.quietHours || "Please keep noise low at night"}</strong>
              <p>{guide.houseRules || "Please treat the apartment and neighbours with care."}</p>
            </article>
          </div>
          {apartmentInstructions.length > 0 ? <div className="how-list essentials-how-list">
            {apartmentInstructions.map(([title, copy], i) => (
              <details key={title} open={i === 0}>
                <summary>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {title}
                  <b>＋</b>
                </summary>
                <p>{copy}</p>
              </details>
            ))}
          </div> : null}
        </section>
      ) : null}

      {activeSection === "explore" ? (
      <section className="manual-section explore-section" id="explore">
        <div className="manual-heading">
          <p className="eyebrow">Host favourites</p>
          <h2>Explore Skopje.</h2>
          <p>Personal recommendations from Dejan and Ivana, selected for an easy and memorable stay.</p>
        </div>
        <h3 className="category-title">Eat & drink</h3>
        <div className="recommendation-grid">
          {restaurants.map(([name, type, copy, photo]) => (
            <article key={name}>
              <div className="place-image">
                <Image
                  src={photo}
                  alt={name}
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw"
                />
              </div>
              <div className="place-content">
                <span>{type}</span>
                <h3>{name}</h3>
                <p>{copy}</p>
                <a
                  className="map-link"
                  href={mapsLink(name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i>⌖</i> Get directions <b>Open Google Maps ↗</b>
                </a>
              </div>
            </article>
          ))}
        </div>
        <h3 className="category-title">See the city</h3>
        <div className="sight-list">
          {sights.map(([name, copy, photo], i) => (
            <article key={name}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div className="sight-image">
                <Image
                  src={photo}
                  alt={name}
                  fill
                  sizes="(max-width: 600px) 34vw, 220px"
                />
              </div>
              <div>
                <h3>{name}</h3>
                <p>{copy}</p>
                <a
                  className="map-link"
                  href={mapsLink(name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <i>⌖</i> Get directions <b>Open Google Maps ↗</b>
                </a>
              </div>
            </article>
          ))}
        </div>
        <div className="nearby-section">
          <div className="nearby-heading">
            <div>
              <p className="eyebrow">Around the corner</p>
              <h3>Useful places nearby.</h3>
            </div>
            <p>Tap any card for clear door-to-door directions from the apartment.</p>
          </div>
          <div className="nearby-grid">
            {nearbyPlaces.map(([name, type, copy, photo]) => (
              <article key={name}>
                <div className="nearby-image">
                  <Image
                    src={photo}
                    alt={`${name} recommendation`}
                    fill
                    sizes="(max-width: 700px) 100vw, 33vw"
                  />
                </div>
                <div className="nearby-content">
                  <span>{type}</span>
                  <h4>{name}</h4>
                  <p>{copy}</p>
                  <a href={mapsLink(name)} target="_blank" rel="noreferrer">
                    <i>⌖</i>
                    <span>Get directions</span>
                    <b>Google Maps ↗</b>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
        <article className="language-card">
          <div>
            <span>Useful words</span>
            <h3>A little Macedonian goes a long way.</h3>
          </div>
          <div className="phrase-list">
            <p>
              <b>Zdravo</b>
              <span>Hello</span>
            </p>
            <p>
              <b>Blagodaram / Fala</b>
              <span>Thank you</span>
            </p>
            <p>
              <b>Ve molam</b>
              <span>Please</span>
            </p>
            <p>
              <b>Prijatno</b>
              <span>Goodbye</span>
            </p>
            <p>
              <b>Nazdravje</b>
              <span>Cheers!</span>
            </p>
          </div>
        </article>
        <div className="transport-panel">
          <div className="transport-heading">
            <p className="eyebrow light">Getting around</p>
            <h3>Taxis & airport transfers.</h3>
            <p>
              Use an app or call a dispatcher. For street taxis, choose a clearly marked licensed vehicle and ask for the meter.
            </p>
          </div>
          <div className="transport-options">
            <article className="wizi-card">
              <span>Recommended taxi app</span>
              <h4>Wizi</h4>
              <p>
                Book and track a taxi from your phone. Card or cash payment may be available depending on the ride.
              </p>
              <a href="https://wizi.mk/gradovi/skopje/" target="_blank" rel="noreferrer">
                Open Wizi / download app <b>↗</b>
              </a>
            </article>
            <article className="featured-taxi">
              <span>Airport transfer · recommended</span>
              <h4>Nashe Taxi</h4>
              <a className="taxi-number" href="tel:15152">
                15152
              </a>
              <p>
                Call to arrange a transfer to the airport or a pickup from the airport. Booking in advance is recommended.
              </p>
              <a href="tel:15152">Call Nashe Taxi <b>↗</b></a>
            </article>
            <article>
              <span>Official airport taxi</span>
              <h4>Airport Taxi</h4>
              <a className="taxi-number" href="tel:+38970813037">
                +389 70 813 037
              </a>
              <p>Official taxi desk at Skopje International Airport, available around scheduled landings.</p>
              <a href="tel:+38970813037">Call Airport Taxi <b>↗</b></a>
            </article>
          </div>
        </div>
      </section>
      ) : null}

      {activeSection === "essentials" && guide.faqs && guide.faqs.length > 0 ? (
        <section className="manual-section faq-section" id="faq">
          <div className="manual-heading">
            <p className="eyebrow">Good to know</p>
            <h2>Frequently asked questions.</h2>
            <p>Quick answers to common questions during your stay.</p>
          </div>
          <div className="faq-accordion-list">
            {guide.faqs.map((faq, i) => (
              <details key={faq.id || i} open={i === 0}>
                <summary>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    {faq.category ? <small className="faq-cat-label">{faq.category}</small> : null}
                    <h3>{faq.question}</h3>
                  </div>
                  <b>＋</b>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {activeSection === "checkout" ? (
      <section className="manual-section checkout-section" id="checkout">
        <div className="manual-heading">
          <p className="eyebrow light">Before {guide.checkOutTime}</p>
          <h2>A smooth checkout.</h2>
        </div>
        <div className="checkout-card">
          <p>{guide.checkoutInstructions}</p>
          <ul>
            <li>Take a final look for personal belongings</li>
            <li>Close and lock the apartment door</li>
            <li>Return the key exactly as instructed</li>
          </ul>
        </div>
        <div className="rules-card">
          <div>
            <span>Quiet hours</span>
            <strong>{guide.quietHours}</strong>
          </div>
          <p>{guide.houseRules}</p>
        </div>
      </section>
      ) : null}
      </div>

      <section className="help-strip">
        <div>
          <p className="eyebrow light">Need help?</p>
          <h2>We are here.</h2>
          <p>
            For apartment questions, contact {guide.hostName || "your host"}. For a police, fire or medical emergency, call {guide.emergencyPhone || "112"}.
          </p>
        </div>
        <div>
          {guide.hostPhone ? <a href={`tel:${phone}`}>Call host <span>↗</span></a> : null}
          <a href={`tel:${guide.emergencyPhone || "112"}`}>
            Emergency {guide.emergencyPhone || "112"} <span>↗</span>
          </a>
        </div>
      </section>

      <footer className="manual-footer">
        <a className="brand" href="#top">
          <span className="brand-mark">K</span>
          <span>{guide.propertyName}</span>
        </a>
        <p>Enjoy your stay in Skopje.</p>
        <a href="#top">Back to top ↑</a>
      </footer>

      {/* Full Image Preview Modal */}
      {previewImage ? (
        <div className="guest-photo-modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="guest-photo-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="guest-photo-close-btn" onClick={() => setPreviewImage(null)} title="Close preview (ESC)">
              ✕
            </button>
            <div className="guest-photo-modal-body">
              <Image
                src={previewImage.src}
                alt={previewImage.title}
                fill
                sizes="100vw"
                style={{ objectFit: "contain" }}
                unoptimized
              />
            </div>
            <div className="guest-photo-modal-caption">
              <h3>{previewImage.title}</h3>
              {previewImage.subtitle ? <p>{previewImage.subtitle}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
