"use client";

import { FormEvent, useEffect, useState } from "react";
import type { GuestGuide } from "@/lib/guest-guide";

const groups: { title: string; note: string; fields: [keyof GuestGuide, string, "input" | "textarea"][] }[] = [
  { title:"Stay timing", note:"These times control both what guests see and exactly when their access code starts and expires.", fields:[["checkInTime","Default check-in time","input"],["checkOutTime","Default checkout time","input"]] },
  { title:"Arrival & access", note:"Everything guests need between the street and the apartment door.", fields:[["propertyName","Property name","input"],["address","Full address","input"],["mapsUrl","Google or Apple Maps link","input"],["directions","How to recognise the building / main entrance","textarea"],["parking","Parking instructions and space number","textarea"],["buildingCode","Building entrance code","input"],["buildingEntryInstructions","Building entry steps","textarea"],["floor","Floor","input"],["apartmentNumber","Apartment number / door","input"],["apartmentDirections","Directions from entrance to apartment","textarea"],["lockboxCode","Key lockbox code","input"],["lockboxInstructions","Where the lockbox is and how to use it","textarea"]] },
  { title:"Stay essentials", note:"The details guests usually ask for first.", fields:[["wifiName","Wi-Fi network","input"],["wifiPassword","Wi-Fi password","input"],["hostName","Host name","input"],["hostPhone","Host phone with country code","input"]] },
  { title:"Using the apartment", note:"Short, clear instructions prevent most support messages.", fields:[["airConditioning","Air conditioning","textarea"],["heating","Heating","textarea"],["hotWater","Hot water","textarea"],["rubbish","Rubbish and recycling","textarea"]] },
  { title:"Rules, safety & checkout", note:"Set expectations and make departure effortless.", fields:[["quietHours","Quiet hours","input"],["houseRules","House rules","textarea"],["checkoutInstructions","Checkout checklist","textarea"],["emergencyPhone","Emergency number","input"]] },
];

export default function GuideEditor(){
  const [guide,setGuide]=useState<GuestGuide|null>(null),[state,setState]=useState("Loading guide…");
  useEffect(()=>{let live=true;fetch("/api/host/guide",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{if(live){setGuide(data.guide);setState("");}}).catch(()=>live&&setState("Could not load the guide."));return()=>{live=false};},[]);
  async function save(event:FormEvent){event.preventDefault();if(!guide)return;setState("Saving…");const response=await fetch("/api/host/guide",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(guide)});setState(response.ok?"Saved. Guest guide is live.":"Could not save. Please try again.");}
  if(!guide)return <div className="guide-loading">{state}</div>;
  return <form className="guide-editor" onSubmit={save}><div className="guide-editor-intro"><p>Your changes appear immediately for guests with an active stay code. Leave a field blank if it does not apply.</p><a href="/" target="_blank" rel="noreferrer">Preview guest guide ↗</a></div>{groups.map(group=><section key={group.title}><div><h2>{group.title}</h2><p>{group.note}</p></div><div className="guide-fields">{group.fields.map(([key,label,type])=><label key={key}>{label}{type==="textarea"?<textarea rows={3} value={guide[key]} onChange={e=>setGuide({...guide,[key]:e.target.value})}/>:<input type={key==="checkInTime"||key==="checkOutTime"?"time":"text"} value={guide[key]} onChange={e=>setGuide({...guide,[key]:e.target.value})}/>}</label>)}</div></section>)}<div className="guide-save"><span role="status">{state}</span><button type="submit">Save guest guide</button></div></form>;
}
