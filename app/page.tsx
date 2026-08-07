import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bookingState, getBookingByCode } from "@/lib/bookings";
import { getGuestGuide } from "@/lib/guest-guide";
import CopyButton from "@/app/guest-guide/CopyButton";

const restaurants = [
  ["Gradska Kafeana Dvor", "Local dining", "Mention you are a guest of Dejan and Ivana for 10% off. Reserve ahead on weekends."],
  ["Gostilnica Dukat", "Local favourite", "Authentic Macedonian food. Try chorba, warm bread and Ohridsko makalo."],
  ["Skopski Merak", "Dinner", "Premium Macedonian and international dishes. Reserve ahead on weekends."],
  ["Beer Garden", "Drinks & sport", "Craft beer, pub food, outdoor seating, football matches and live weekend music."],
  ["Matto Napoletano", "Pizza", "Award-winning Neapolitan pizza. Code URBANESTI includes a free lemon sorbet with food."],
  ["Café Capri", "Coffee", "A relaxed neighbourhood café and bar with pleasant outdoor seating."],
  ["Restaurant Treska", "Nature escape", "Traditional food beside the Treska River, about 20 minutes away. Family-friendly; no alcohol served."],
];
const sights = [
  ["Matka Canyon", "Cliffside walks, boat or kayak rides and Vrelo Cave, around 30 minutes from the city."],
  ["Macedonia Square", "The central square, Stone Bridge and illuminated fountains - especially atmospheric in the evening."],
  ["Old Bazaar", "Ottoman-era lanes, craft shops, Turkish coffee and local kebapi."],
  ["Skopje Fortress", "Free entry and panoramic city views; a lovely sunset stop above the Old Bazaar."],
  ["Millennium Cross", "Take the cable car from Middle Vodno for valley views. It is usually closed on Mondays."],
];
const dateLabel=(value:string)=>new Intl.DateTimeFormat("en",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));
const available=(value:string)=>value||"Contact your host for this detail";
const mapsLink=(place:string)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, Skopje, North Macedonia`)}`;

export default async function Home(){
  const code=(await cookies()).get("konios_access")?.value;
  const [booking,guide]=await Promise.all([code?getBookingByCode(code):null,getGuestGuide()]);
  if(!booking||bookingState(booking).status!=="active")redirect("/access");
  const phone=guide.hostPhone.replace(/[^+\d]/g,"");
  return <main className="guest-manual" id="top">
    <header className="manual-header"><a className="brand" href="#top"><span className="brand-mark">K</span><span>{guide.propertyName}</span></a><nav aria-label="Guide sections"><a href="#arrival">Arrival</a><a href="#essentials">Essentials</a><a href="#apartment">Apartment</a><a href="#explore">Explore</a><a href="#checkout">Checkout</a></nav><span className="manual-stay">{dateLabel(booking.checkIn)} - {dateLabel(booking.checkOut)}</span></header>
    <section className="manual-hero"><div><p className="eyebrow">Your private guest guide</p><h1>Welcome,<br/>{booking.firstName}.</h1><p>Everything you need for an easy arrival and a comfortable stay in Skopje, collected in one place.</p></div><aside><span>Your stay</span><div className="stay-date"><b>Check-in</b><strong>{dateLabel(booking.checkIn)}</strong><i><em>10:00</em> arrival time</i></div><span className="stay-rule"/><div className="stay-date"><b>Checkout</b><strong>{dateLabel(booking.checkOut)}</strong><i><em>10:00</em> departure time</i></div>{guide.hostPhone?<a href={`tel:${phone}`}>Call {guide.hostName||"your host"} ↗</a>:null}</aside></section>

    <section className="manual-section" id="arrival"><div className="manual-heading"><p className="eyebrow">Start here</p><h2>Arrival, step by step.</h2><p>Keep this page open as you approach the building.</p></div><div className="arrival-steps">
      <article><span>01</span><div><small>Find the building</small><h3>{available(guide.address)}</h3><p>{available(guide.directions)}</p>{guide.mapsUrl?<a href={guide.mapsUrl} target="_blank" rel="noreferrer">Open in Maps ↗</a>:null}</div></article>
      <article><span>02</span><div><small>Enter the building</small><h3>Building code</h3><div className="access-number">{available(guide.buildingCode)}</div>{guide.buildingCode?<CopyButton value={guide.buildingCode}/>:null}</div></article>
      <article><span>03</span><div><small>Collect the key</small><h3>Lockbox code</h3><div className="access-number">{available(guide.lockboxCode)}</div>{guide.lockboxCode?<CopyButton value={guide.lockboxCode}/>:null}<p>{available(guide.lockboxInstructions)}</p></div></article>
      <article><span>04</span><div><small>Find your door</small><h3>{guide.floor?`Floor ${guide.floor}`:"Apartment location"}{guide.apartmentNumber?` · ${guide.apartmentNumber}`:""}</h3><p>If anything is unclear, contact {guide.hostName||"your host"} before trying another door.</p></div></article>
      <article><span>05</span><div><small>Get connected</small><h3>Wi-Fi</h3><p className="flow-label">Network</p><div className="flow-value">{available(guide.wifiName)}</div>{guide.wifiName?<CopyButton value={guide.wifiName}/>:null}<p className="flow-label">Password</p><div className="flow-value clear-value">{available(guide.wifiPassword)}</div>{guide.wifiPassword?<CopyButton value={guide.wifiPassword}/>:null}</div></article>
    </div></section>

    <section className="manual-section manual-dark" id="essentials"><div className="manual-heading"><p className="eyebrow light">Settle in</p><h2>The essentials.</h2></div><div className="essential-grid"><article><span>Wi-Fi network</span><strong>{available(guide.wifiName)}</strong>{guide.wifiName?<CopyButton value={guide.wifiName}/>:null}</article><article><span>Wi-Fi password</span><strong className="clear-value">{available(guide.wifiPassword)}</strong>{guide.wifiPassword?<CopyButton value={guide.wifiPassword}/>:null}</article><article><span>Your host</span><strong>{guide.hostName||"Your host"}</strong>{guide.hostPhone?<a href={`tel:${phone}`}>{guide.hostPhone} ↗</a>:<small>Phone not yet added</small>}</article><article><span>Parking</span><p>{available(guide.parking)}</p></article></div></section>

    <section className="manual-section" id="apartment"><div className="manual-heading"><p className="eyebrow">At home</p><h2>How everything works.</h2><p>Quick answers for the most-used parts of the apartment.</p></div><div className="how-list">{[["Air conditioning",guide.airConditioning],["Heating",guide.heating],["Hot water",guide.hotWater],["Rubbish & recycling",guide.rubbish]].map(([title,copy],i)=><details key={title} open={i===0}><summary><span>{String(i+1).padStart(2,"0")}</span>{title}<b>＋</b></summary><p>{available(copy)}</p></details>)}</div></section>

    <section className="manual-section explore-section" id="explore"><div className="manual-heading"><p className="eyebrow">Host favourites</p><h2>Explore Skopje.</h2><p>Personal recommendations from Dejan and Ivana, selected for an easy and memorable stay.</p></div><h3 className="category-title">Eat & drink</h3><div className="recommendation-grid">{restaurants.map(([name,type,copy])=><article key={name}><span>{type}</span><h3>{name}</h3><p>{copy}</p><a className="map-link" href={mapsLink(name)} target="_blank" rel="noreferrer">Directions in Google Maps <b>↗</b></a></article>)}</div><h3 className="category-title">See the city</h3><div className="sight-list">{sights.map(([name,copy],i)=><article key={name}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{name}</h3><p>{copy}</p><a className="map-link" href={mapsLink(name)} target="_blank" rel="noreferrer">Directions in Google Maps <b>↗</b></a></div></article>)}</div><div className="local-tips"><article><span>Nearby essentials</span><h3>Kipper Market is next door</h3><p>Useful for groceries, snacks and drinks. Bakery Crown 1985 is about 100 metres away; Silbo is another beloved bakery worth visiting.</p><div className="tip-links"><a href={mapsLink("Kipper Market")} target="_blank" rel="noreferrer">Kipper Market ↗</a><a href={mapsLink("Bakery Crown 1985")} target="_blank" rel="noreferrer">Crown 1985 ↗</a><a href={mapsLink("Silbo Bakery")} target="_blank" rel="noreferrer">Silbo ↗</a></div></article><article><span>Useful words</span><h3>A little Macedonian</h3><p><b>Zdravo</b> - Hello<br/><b>Blagodaram / Fala</b> - Thank you<br/><b>Ve molam</b> - Please<br/><b>Prijatno</b> - Goodbye<br/><b>Nazdravje</b> - Cheers!</p></article></div>
    <div className="transport-panel"><div className="transport-heading"><p className="eyebrow light">Getting around</p><h3>Taxis & airport transfers.</h3><p>Use an app or call a dispatcher. For street taxis, choose a clearly marked licensed vehicle and ask for the meter.</p></div><div className="transport-options"><article className="wizi-card"><span>Recommended taxi app</span><h4>Wizi</h4><p>Book and track a taxi from your phone. Card or cash payment may be available depending on the ride.</p><a href="https://wizi.mk/gradovi/skopje/" target="_blank" rel="noreferrer">Open Wizi / download app <b>↗</b></a></article><article className="featured-taxi"><span>Airport transfer · recommended</span><h4>Nashe Takvi</h4><a className="taxi-number" href="tel:15152">15152</a><p>Call to arrange a transfer to the airport or a pickup from the airport. Booking in advance is recommended.</p><a href="tel:15152">Call Nashe Takvi <b>↗</b></a></article><article><span>Official airport taxi</span><h4>Airport Taxi</h4><a className="taxi-number" href="tel:+38970813037">+389 70 813 037</a><p>Official taxi desk at Skopje International Airport, available around scheduled landings.</p><a href="tel:+38970813037">Call Airport Taxi <b>↗</b></a></article></div></div></section>

    <section className="manual-section checkout-section" id="checkout"><div className="manual-heading"><p className="eyebrow light">Before 10:00</p><h2>A smooth checkout.</h2></div><div className="checkout-card"><p>{guide.checkoutInstructions}</p><ul><li>Take a final look for personal belongings</li><li>Close and lock the apartment door</li><li>Return the key exactly as instructed</li></ul></div><div className="rules-card"><div><span>Quiet hours</span><strong>{guide.quietHours}</strong></div><p>{guide.houseRules}</p></div></section>

    <section className="help-strip"><div><p className="eyebrow light">Need help?</p><h2>We are here.</h2><p>For apartment questions, contact {guide.hostName||"your host"}. For a police, fire or medical emergency, call {guide.emergencyPhone||"112"}.</p></div><div>{guide.hostPhone?<a href={`tel:${phone}`}>Call host <span>↗</span></a>:null}<a href={`tel:${guide.emergencyPhone||"112"}`}>Emergency {guide.emergencyPhone||"112"} <span>↗</span></a></div></section>
    <footer className="manual-footer"><a className="brand" href="#top"><span className="brand-mark">K</span><span>{guide.propertyName}</span></a><p>Enjoy your stay in Skopje.</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}
