"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/bookings";
import { defaultMessageTemplates, GuestGuide, MessageTemplate } from "@/lib/guest-guide";

export function populateTemplate(
  content: string,
  booking: Booking,
  guide?: GuestGuide | null,
  propertySlug?: string
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://konios.vercel.app";
  const guestName = `${booking.firstName} ${booking.lastName}`.trim();
  const guideUrl = `${origin}/${propertySlug || "access"}?token=${booking.accessToken}`;
  const currency = booking.currency || "EUR";
  const amountDue = Math.max(0, (Number(booking.grossAmount) || 0) - (Number(booking.paymentCollected) || 0));

  return content
    .replaceAll("{guestName}", guestName)
    .replaceAll("{firstName}", booking.firstName)
    .replaceAll("{lastName}", booking.lastName)
    .replaceAll("{code}", booking.code)
    .replaceAll("{accessCode}", booking.code)
    .replaceAll("{guideUrl}", guideUrl)
    .replaceAll("{accessLink}", guideUrl)
    .replaceAll("{checkIn}", booking.checkIn)
    .replaceAll("{checkInTime}", guide?.checkInTime || "15:00")
    .replaceAll("{checkOut}", booking.checkOut)
    .replaceAll("{guests}", String(booking.guests || 1))
    .replaceAll("{wifiName}", guide?.wifiName || "Konios House")
    .replaceAll("{wifiPassword}", guide?.wifiPassword || "")
    .replaceAll("{lockboxCode}", guide?.lockboxCode || "3007")
    .replaceAll("{buildingCode}", guide?.buildingCode || "2812")
    .replaceAll("{apartmentNumber}", guide?.apartmentNumber || "32")
    .replaceAll("{phone}", booking.phone || "")
    .replaceAll("{amountDue}", amountDue.toFixed(2))
    .replaceAll("{currency}", currency)
    .replaceAll("{source}", booking.source || "Direct");
}

type Props = {
  booking: Booking;
  guide?: GuestGuide | null;
  propertySlug?: string;
  onClose: () => void;
};

export default function GuestMessageModal({ booking, guide, propertySlug, onClose }: Props) {
  const [liveGuide, setLiveGuide] = useState<GuestGuide | null>(guide || null);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/host/guide?propertyId=${encodeURIComponent(booking.propertyId || "konios-house")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.guide) {
          setLiveGuide(d.guide);
        }
      })
      .catch(() => {});
  }, [booking.propertyId]);

  const templates: MessageTemplate[] = liveGuide?.messageTemplates?.length
    ? liveGuide.messageTemplates
    : defaultMessageTemplates;

  // Categories list
  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category || "General")))];

  const filteredTemplates = templates.filter(
    (t) => selectedCategory === "All" || (t.category || "General") === selectedCategory
  );

  const selectedTpl =
    templates.find((t) => t.id === selectedTplId) || filteredTemplates[0] || templates[0];

  const defaultPopulated = selectedTpl
    ? populateTemplate(selectedTpl.content, booking, liveGuide, propertySlug)
    : "";
  const currentText = customText !== null ? customText : defaultPopulated;

  function handleSelectTemplate(tpl: MessageTemplate) {
    setSelectedTplId(tpl.id);
    setCustomText(populateTemplate(tpl.content, booking, liveGuide, propertySlug));
    setCopied(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(currentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const cleanPhone = (booking.phone || "").replace(/[^0-9+]/g, "");
  const waPhone = cleanPhone.startsWith("+")
    ? cleanPhone.replace("+", "")
    : cleanPhone.startsWith("00")
    ? cleanPhone.slice(2)
    : cleanPhone;

  const waUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(currentText)}`
    : `https://wa.me/?text=${encodeURIComponent(currentText)}`;
  const viberUrl = cleanPhone ? `viber://chat?number=${encodeURIComponent(cleanPhone)}` : "viber://forward?text=" + encodeURIComponent(currentText);

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="guest-msg-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="msg-modal-header">
          <div>
            <span className="eyebrow">Guest Communication</span>
            <h3>Quick Messages for {booking.firstName} {booking.lastName}</h3>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="msg-modal-body">
          {/* Left Panel: Template List & Category Filter */}
          <div className="msg-tpl-sidebar">
            <div className="msg-sidebar-head">
              <span className="msg-sidebar-title">TEMPLATES ({templates.length})</span>
              <div className="msg-cat-pills">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`msg-cat-pill ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="msg-tpl-list">
              {filteredTemplates.map((tpl) => {
                const isSelected = (selectedTpl?.id === tpl.id);
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    className={`msg-tpl-item ${isSelected ? "active" : ""}`}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <span className="msg-tpl-cat">{tpl.category || "General"}</span>
                    <strong className="msg-tpl-title">{tpl.title}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Populated Message Editor & Action Buttons */}
          <div className="msg-preview-panel">
            <div className="msg-preview-head">
              <div className="msg-preview-meta">
                <span className="msg-preview-label">POPULATED MESSAGE PREVIEW</span>
                <span className="msg-preview-sub">Placeholders replaced with guest details</span>
              </div>
              {selectedTpl && (
                <span className="msg-selected-badge">{selectedTpl.category || "General"}</span>
              )}
            </div>

            <textarea
              className="msg-preview-textarea"
              rows={9}
              value={currentText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Select a template on the left..."
            />

            <div className="msg-action-bar">
              <button
                type="button"
                className={`msg-copy-btn ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied to Clipboard!" : "⧉ Copy Message"}
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="msg-wa-btn"
              >
                💬 Open in WhatsApp
              </a>
              <a href={viberUrl} className="msg-viber-btn" onClick={() => navigator.clipboard.writeText(currentText)}>
                📞 Copy & open Viber
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
