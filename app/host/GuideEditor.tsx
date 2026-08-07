"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import type { GuestGuide } from "@/lib/guest-guide";

type GuideFieldKey = keyof GuestGuide;

const groups: { title: string; note: string; fields: [GuideFieldKey, string, "input" | "textarea"][] }[] = [
  { title:"Stay timing", note:"These times control both what guests see and exactly when their access code starts and expires.", fields:[["checkInTime","Default check-in time","input"],["checkOutTime","Default checkout time","input"]] },
  { title:"Arrival & access", note:"Everything guests need between the street and the apartment door.", fields:[["propertyName","Property name","input"],["address","Full address","input"],["mapsUrl","Google or Apple Maps link","input"],["directions","How to recognise the building / main entrance","textarea"],["parkingSpace","Parking space number","input"],["parking","Parking instructions","textarea"],["buildingCode","Building entrance code","input"],["buildingEntryInstructions","Building entry steps","textarea"],["floor","Floor","input"],["apartmentNumber","Apartment number / door","input"],["apartmentDirections","Directions from entrance to apartment","textarea"],["lockboxCode","Key lockbox code","input"],["lockboxInstructions","Where the lockbox is and how to use it","textarea"]] },
  { title:"Stay essentials", note:"The details guests usually ask for first.", fields:[["wifiName","Wi-Fi network","input"],["wifiPassword","Wi-Fi password","input"],["hostName","Host name(s)","input"],["hostPhone","Host phone with country code","input"],["hostPhotoUrl","Host profile image URL / path","input"],["welcomeMessage","Welcome message for guest","textarea"]] },
  { title:"Using the apartment", note:"Short, clear instructions prevent most support messages.", fields:[["airConditioning","Air conditioning","textarea"],["heating","Heating","textarea"],["hotWater","Hot water","textarea"],["rubbish","Rubbish and recycling","textarea"]] },
  { title:"Rules, safety & checkout", note:"Set expectations and make departure effortless.", fields:[["quietHours","Quiet hours","input"],["houseRules","House rules","textarea"],["checkoutInstructions","Checkout checklist","textarea"],["emergencyPhone","Emergency number","input"]] },
];

const stepConfig: { key: keyof GuestGuide; label: string; defaultUrl: string }[] = [
  { key: "step1PhotoUrl", label: "Step 01: Find the building", defaultUrl: "/self-checkin-guide.png" },
  { key: "step2PhotoUrl", label: "Step 02: Park", defaultUrl: "/self-checkin-guide.png" },
  { key: "step3PhotoUrl", label: "Step 03: Enter the building", defaultUrl: "/self-checkin-guide.png" },
  { key: "step4PhotoUrl", label: "Step 04: Find your door", defaultUrl: "/self-checkin-guide.png" },
  { key: "step5PhotoUrl", label: "Step 05: Collect the key", defaultUrl: "/self-checkin-guide.png" },
  { key: "step6PhotoUrl", label: "Step 06: Get connected / Wi-Fi", defaultUrl: "/apartment-main.png" },
];

export default function GuideEditor(){
  const [guide,setGuide]=useState<GuestGuide|null>(null);
  const [state,setState]=useState("Loading guide…");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(()=>{
    let live=true;
    fetch("/api/host/guide",{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then(data=>{if(live){setGuide(data.guide);setState("");}})
      .catch(()=>live&&setState("Could not load the guide."));
    return()=>{live=false};
  },[]);

  async function handleStepUpload(key: keyof GuestGuide, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !guide) return;
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/host/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        setGuide({ ...guide, [key]: data.url });
      } else {
        alert(data.error || "Upload failed");
      }
    } catch {
      alert("Upload failed");
    } finally {
      setUploadingKey(null);
    }
  }

  async function save(event:FormEvent){
    event.preventDefault();
    if(!guide)return;
    setState("Saving…");
    const response=await fetch("/api/host/guide",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(guide)});
    setState(response.ok?"Saved. Guest guide is live.":"Could not save. Please try again.");
  }

  if(!guide)return <div className="guide-loading">{state}</div>;

  return (
    <form className="guide-editor" onSubmit={save}>
      <div className="guide-editor-intro">
        <p>Your changes appear immediately for guests with an active stay code. Leave a field blank if it does not apply.</p>
        <a href="/" target="_blank" rel="noreferrer">Preview guest guide ↗</a>
      </div>

      <section>
        <div>
          <h2>Arrival Journey Photos (Steps 01 – 06)</h2>
          <p>Upload or replace photos shown on each arrival step card in the digital guest guide.</p>
        </div>
        <div className="step-photos-grid">
          {stepConfig.map(({ key, label, defaultUrl }) => {
            const currentUrl = (guide[key] as string) || defaultUrl;
            const isUploading = uploadingKey === key;
            return (
              <div key={key} className="step-photo-card">
                <div className="step-photo-head">
                  <strong>{label}</strong>
                </div>
                <div className="step-photo-preview">
                  <Image
                    src={currentUrl}
                    alt={label}
                    fill
                    unoptimized
                    style={{ objectFit: "cover", borderRadius: "10px" }}
                  />
                </div>
                <label className="step-upload-btn">
                  {isUploading ? "Uploading photo…" : "📷 Upload New Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => handleStepUpload(key, e)}
                  />
                </label>
                <div className="step-url-input">
                  <small>Image URL / Path</small>
                  <input
                    type="text"
                    value={(guide[key] as string) || ""}
                    placeholder={defaultUrl}
                    onChange={(e) => setGuide({ ...guide, [key]: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {groups.map(group=>(
        <section key={group.title}>
          <div><h2>{group.title}</h2><p>{group.note}</p></div>
          <div className="guide-fields">
            {group.fields.map(([key,label,type])=>{
              const val = (guide as unknown as Record<string, string>)[key] || "";
              return (
                <label key={key}>
                  {label}
                  {type==="textarea" ? (
                    <textarea
                      rows={3}
                      value={val}
                      onChange={(e) => setGuide({ ...guide, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={key==="checkInTime"||key==="checkOutTime"?"time":"text"}
                      value={val}
                      onChange={(e) => setGuide({ ...guide, [key]: e.target.value })}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}
      <div className="guide-save">
        <span role="status">{state}</span>
        <button type="submit">Save guest guide</button>
      </div>
    </form>
  );
}
