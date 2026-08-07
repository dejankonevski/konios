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

export default async function Home(){
  const code=(await cookies()).get("konios_access")?.value;
  const [booking,guide]=await Promise.all([code?getBookingByCode(code):null,getGuestGuide()]);
  if(!booking||bookingState(booking).status!=="active")redirect("/access");
  const phone=guide.hostPhone.replace(/[^+\d]/g,"");
  return <main className="guest-manual" id="top">
    <header className="manual-header"><a className="brand" href="#top"><span className="brand-mark">K</span><span>{guide.propertyName}</span></a><nav aria-label="Guide sections"><a href="#arrival">Arrival</a><a href="#essentials">Essentials</a><a href="#apartment">Apartment</a><a href="#explore">Explore</a><a href="#checkout">Checkout</a></nav><span className="manual-stay">{dateLabel(booking.checkIn)} - {dateLabel(booking.checkOut)}</span></header>
    <section className="manual-hero"><div><p className="eyebrow">Your private guest guide</p><h1>Welcome,<br/>{booking.firstName}.</h1><p>Everything you need for an easy arrival and a comfortable stay in Skopje, collected in one place.</p></div><aside><span>Your stay</span><strong>{dateLabel(booking.checkIn)}</strong><i>10:00 check-in</i><span className="stay-rule"/><strong>{dateLabel(booking.checkOut)}</strong><i>10:00 checkout</i>{guide.hostPhone?<a href={`tel:${phone}`}>Call {guide.hostName||"your host"} ↗</a>:null}</aside></section>

    <section className="manual-section" id="arrival"><div className="manual-heading"><p className="eyebrow">Start here</p><h2>Arrival, step by step.</h2><p>Keep this page open as you approach the building.</p></div><div className="arrival-steps">
      <article><span>01</span><div><small>Find the building</small><h3>{available(guide.address)}</h3><p>{available(guide.directions)}</p>{guide.mapsUrl?<a href={guide.mapsUrl} target="_blank" rel="noreferrer">Open in Maps ↗</a>:null}</div></article>
      <article><span>02</span><div><small>Enter the building</small><h3>Building code</h3><div className="access-number">{available(guide.buildingCode)}</div>{guide.buildingCode?<CopyButton value={guide.buildingCode}/>:null}</div></article>
      <article><span>03</span><div><small>Collect the key</small><h3>Lockbox code</h3><div className="access-number">{available(guide.lockboxCode)}</div>{guide.lockboxCode?<CopyButton value={guide.lockboxCode}/>:null}<p>{available(guide.lockboxInstructions)}</p></div></article>
      <article><span>04</span><div><small>Find your door</small><h3>{guide.floor?`Floor ${guide.floor}`:"Apartment location"}{guide.apartmentNumber?` · ${guide.apartmentNumber}`:""}</h3><p>If anything is unclear, contact {guide.hostName||"your host"} before trying another door.</p></div></article>
    </div></section>

    <section className="manual-section manual-dark" id="essentials"><div className="manual-heading"><p className="eyebrow light">Settle in</p><h2>The essentials.</h2></div><div className="essential-grid"><article><span>Wi-Fi network</span><strong>{available(guide.wifiName)}</strong>{guide.wifiName?<CopyButton value={guide.wifiName}/>:null}</article><article><span>Wi-Fi password</span><strong className="clear-value">{available(guide.wifiPassword)}</strong>{guide.wifiPassword?<CopyButton value={guide.wifiPassword}/>:null}</article><article><span>Your host</span><strong>{guide.hostName||"Your host"}</strong>{guide.hostPhone?<a href={`tel:${phone}`}>{guide.hostPhone} ↗</a>:<small>Phone not yet added</small>}</article><article><span>Parking</span><p>{available(guide.parking)}</p></article></div></section>

    <section className="manual-section" id="apartment"><div className="manual-heading"><p className="eyebrow">At home</p><h2>How everything works.</h2><p>Quick answers for the most-used parts of the apartment.</p></div><div className="how-list">{[["Air conditioning",guide.airConditioning],["Heating",guide.heating],["Hot water",guide.hotWater],["Rubbish & recycling",guide.rubbish]].map(([title,copy],i)=><details key={title} open={i===0}><summary><span>{String(i+1).padStart(2,"0")}</span>{title}<b>＋</b></summary><p>{available(copy)}</p></details>)}</div></section>

    <section className="manual-section explore-section" id="explore"><div className="manual-heading"><p className="eyebrow">Host favourites</p><h2>Explore Skopje.</h2><p>Personal recommendations from Dejan and Ivana, selected for an easy and memorable stay.</p></div><h3 className="category-title">Eat & drink</h3><div className="recommendation-grid">{restaurants.map(([name,type,copy])=><article key={name}><span>{type}</span><h3>{name}</h3><p>{copy}</p></article>)}</div><h3 className="category-title">See the city</h3><div className="sight-list">{sights.map(([name,copy],i)=><article key={name}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{name}</h3><p>{copy}</p></div></article>)}</div><div className="local-tips"><article><span>Nearby essentials</span><h3>Kipper Market is next door</h3><p>Useful for groceries, snacks and drinks. Bakery Crown 1985 is about 100 metres away; Silbo is another beloved bakery worth visiting.</p></article><article><span>Useful words</span><h3>A little Macedonian</h3><p><b>Zdravo</b> - Hello<br/><b>Blagodaram / Fala</b> - Thank you<br/><b>Ve molam</b> - Please<br/><b>Prijatno</b> - Goodbye<br/><b>Nazdravje</b> - Cheers!</p></article></div></section>

    <section className="manual-section checkout-section" id="checkout"><div className="manual-heading"><p className="eyebrow light">Before 10:00</p><h2>A smooth checkout.</h2></div><div className="checkout-card"><p>{guide.checkoutInstructions}</p><ul><li>Take a final look for personal belongings</li><li>Close and lock the apartment door</li><li>Return the key exactly as instructed</li></ul></div><div className="rules-card"><div><span>Quiet hours</span><strong>{guide.quietHours}</strong></div><p>{guide.houseRules}</p></div></section>

    <section className="help-strip"><div><p className="eyebrow light">Need help?</p><h2>We are here.</h2><p>For apartment questions, contact {guide.hostName||"your host"}. For a police, fire or medical emergency, call {guide.emergencyPhone||"112"}.</p></div><div>{guide.hostPhone?<a href={`tel:${phone}`}>Call host <span>↗</span></a>:null}<a href={`tel:${guide.emergencyPhone||"112"}`}>Emergency {guide.emergencyPhone||"112"} <span>↗</span></a></div></section>
    <footer className="manual-footer"><a className="brand" href="#top"><span className="brand-mark">K</span><span>{guide.propertyName}</span></a><p>Enjoy your stay in Skopje.</p><a href="#top">Back to top ↑</a></footer>
  </main>;
}
