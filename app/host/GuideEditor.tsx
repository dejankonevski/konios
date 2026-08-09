"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import type { GuestGuide } from "@/lib/guest-guide";

type GuideFieldKey = keyof GuestGuide;

const groups: { title: string; note: string; fields: [GuideFieldKey, string, "input" | "textarea"][] }[] = [
  { title:"Guest access timing", note:"Control the official stay times separately from early portal access and sensitive entry details.", fields:[["checkInTime","Official check-in time","input"],["checkOutTime","Official checkout time","input"],["portalLeadHours","Guest portal opens (hours before check-in)","input"],["sensitiveRevealMinutes","Building & lockbox details reveal (minutes before check-in)","input"],["accessExpiryMinutes","Guest access expires (minutes after checkout)","input"]] },
  { title:"Cleaning", note:"Set the standard cleaning agency fee for new reservations.", fields:[["defaultCleaningFeeMkd","Standard Cleaning Agency Fee (MKD)","input"]] },
  { title:"Arrival & access", note:"Everything guests need between the street and the apartment door.", fields:[["propertyName","Property name","input"],["address","Full address","input"],["mapsUrl","Google or Apple Maps link","input"],["directions","How to recognise the building / main entrance","textarea"],["parkingSpace","Parking space number","input"],["parking","Parking instructions","textarea"],["buildingCode","Building entrance code","input"],["buildingEntryInstructions","Building entry steps","textarea"],["floor","Floor","input"],["apartmentNumber","Apartment number / door","input"],["apartmentDirections","Directions from entrance to apartment","textarea"],["lockboxCode","Key lockbox code","input"],["lockboxInstructions","Where the lockbox is and how to use it","textarea"]] },
  { title:"Stay essentials", note:"The details guests usually ask for first.", fields:[["wifiName","Wi-Fi network","input"],["wifiPassword","Wi-Fi password","input"],["hostName","Host name(s)","input"],["hostPhone","Host phone with country code","input"],["hostPhotoUrl","Host profile image URL / path","input"],["welcomeMessage","Welcome message for guest","textarea"]] },
  { title:"Using the apartment", note:"Short, clear instructions prevent most support messages.", fields:[["airConditioning","Air conditioning","textarea"],["heating","Heating","textarea"],["hotWater","Hot water","textarea"],["rubbish","Rubbish and recycling","textarea"]] },
  { title:"Rules, safety & checkout", note:"Set expectations and make departure effortless.", fields:[["quietHours","Quiet hours","input"],["houseRules","House rules","textarea"],["checkoutInstructions","Checkout checklist","textarea"],["emergencyPhone","Emergency number","input"]] },
];

const stepConfig: { key: keyof GuestGuide; label: string; defaultUrl: string }[] = [
  { key: "step1PhotoUrl", label: "Step 01: Find the building", defaultUrl: "/arrival-building.jpg" },
  { key: "step2PhotoUrl", label: "Step 02: Park", defaultUrl: "/arrival-parking.jpg" },
  { key: "step3PhotoUrl", label: "Step 03: Entrance & intercom", defaultUrl: "/arrival-intercom-optimized.jpg" },
  { key: "step4PhotoUrl", label: "Step 04: Hallway to elevator", defaultUrl: "/arrival-elevator-optimized.jpg" },
  { key: "step5PhotoUrl", label: "Step 05: Collect the key", defaultUrl: "/self-checkin-guide.png" },
  { key: "step6PhotoUrl", label: "Step 06: Get connected / Wi-Fi", defaultUrl: "/apartment-main.png" },
];

async function compressImageFile(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = document.createElement("img");
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            quality
          );
        } else {
          resolve(file);
        }
      };
    };
    reader.readAsDataURL(file);
  });
}

export default function GuideEditor({ propertyId = "konios-house" }: { propertyId?: string }){
  const [guide,setGuide]=useState<GuestGuide|null>(null);
  const [state,setState]=useState("Loading guide…");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  useEffect(()=>{
    let live=true;
    fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`,{cache:"no-store"})
      .then(async r=>{if(!r.ok)throw new Error();return r.json();})
      .then(data=>{if(live){setGuide(data.guide);setState("");}})
      .catch(()=>live&&setState("Could not load the guide."));
    return()=>{live=false};
  },[propertyId]);

  async function handleStepUpload(key: keyof GuestGuide, e: ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !guide) return;
    setUploadingKey(key);
    try {
      const file = await compressImageFile(rawFile);
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
    try {
      const response=await fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(guide)});
      const data = await response.json();
      if (response.ok) {
        setState("Saved. Guest guide is live.");
      } else {
        setState(data.error || "Could not save. Please try again.");
      }
    } catch {
      setState("Could not save. Please check network connection.");
    }
  }

  if(!guide)return <div className="guide-loading">{state}</div>;

  return (
    <form className="guide-editor" onSubmit={save}>
      <div className="guide-editor-intro">
        <p>Your changes appear immediately for guests with an active stay code. Leave a field blank if it does not apply.</p>
        <a href={`/host/preview?propertyId=${encodeURIComponent(propertyId)}`} target="_blank" rel="noreferrer">Secure host preview ↗</a>
      </div>
      <div className="security-warning"><strong>Physical access security</strong><p>Rotate the physical lockbox code regularly and after any concern. Website revocation cannot make a remembered physical code invalid. For multiple properties, use programmable locks with reservation-specific codes.</p></div>

      <section>
        <div><h2>Host contact card</h2><p>The selected host name, phone, welcome message and photo appear at the top of every guest guide.</p></div>
        <div className="step-photo-card host-photo-admin-card">
          <div className="step-photo-preview"><Image src={guide.hostPhotoUrl || "/host-profile-new-optimized.jpg"} alt="Current host" fill unoptimized style={{objectFit:"cover",borderRadius:"10px"}} /></div>
          <label className="step-upload-btn">{uploadingKey === "hostPhotoUrl" ? "Uploading photo…" : "📷 Change host photo"}<input type="file" accept="image/*" disabled={uploadingKey === "hostPhotoUrl"} onChange={(e)=>handleStepUpload("hostPhotoUrl",e)} /></label>
        </div>
      </section>

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
              const val = (guide as unknown as Record<string, string | number>)[key] ?? "";
              const numericField = key === "portalLeadHours" || key === "sensitiveRevealMinutes" || key === "accessExpiryMinutes" || key === "defaultCleaningFeeMkd";
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
                      type={key==="checkInTime"||key==="checkOutTime"?"time":numericField?"number":"text"}
                      min={key === "portalLeadHours" ? 1 : 0}
                      max={key === "portalLeadHours" ? 168 : key === "sensitiveRevealMinutes" ? 180 : key === "accessExpiryMinutes" ? 1440 : undefined}
                      value={val}
                      onChange={(e) => setGuide({ ...guide, [key]: numericField ? Number(e.target.value) : e.target.value })}
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
