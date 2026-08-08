"use client";

import { useState } from "react";
import type { Booking } from "@/lib/bookings";
import type { GuestGuide, MessageTemplate } from "@/lib/guest-guide";

export function populateTemplate(
  content: string,
  booking: Booking,
  guide?: GuestGuide
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://konios.vercel.app";
  const guestName = `${booking.firstName} ${booking.lastName}`.trim();
  const guideUrl = `${origin}/access?code=${booking.code}`;

  return content
    .replaceAll("{guestName}", guestName)
    .replaceAll("{firstName}", booking.firstName)
    .replaceAll("{lastName}", booking.lastName)
    .replaceAll("{code}", booking.code)
    .replaceAll("{accessCode}", booking.code)
    .replaceAll("{guideUrl}", guideUrl)
    .replaceAll("{accessLink}", guideUrl)
    .replaceAll("{checkIn}", booking.checkIn)
    .replaceAll("{checkOut}", booking.checkOut)
    .replaceAll("{guests}", String(booking.guests || 1))
    .replaceAll("{wifiName}", guide?.wifiName || "Konios House")
    .replaceAll("{wifiPassword}", guide?.wifiPassword || "")
    .replaceAll("{lockboxCode}", guide?.lockboxCode || "3007")
    .replaceAll("{buildingCode}", guide?.buildingCode || "2812")
    .replaceAll("{apartmentNumber}", guide?.apartmentNumber || "32");
}

type Props = {
  booking: Booking;
  guide?: GuestGuide;
  onClose: () => void;
};

export default function GuestMessageModal({ booking, guide, onClose }: Props) {
  const templates: MessageTemplate[] = guide?.messageTemplates?.length
    ? guide.messageTemplates
    : [
        {
          id: "tpl-3",
          title: "Check-in Instructions & Access Code",
          category: "Arrival",
          content:
            "Hi {guestName}! Your stay at Konios House is coming up soon. Your private entry code is {code}, valid from 10:00 AM on check-in day. You can view your full digital guide and directions here: {guideUrl}",
        },
        {
          id: "tpl-1",
          title: "Payment / Tourist Tax in Keybox",
          category: "Payment & Tax",
          content:
            "Hi {guestName}! Hope you are settling in nicely. Please leave the remaining cash/tourist tax inside the key lockbox (code 3007) when convenient and send us a quick message so someone from our team can come by to pick it up. Thank you so much!",
        },
        {
          id: "tpl-2",
          title: "Airport Taxi Transfer Offer",
          category: "Arrival",
          content:
            "Hello {guestName}! Do you need a taxi transfer arranged from Skopje International Airport directly to Konios House? If so, please share your flight number and expected landing time, and we'll gladly arrange a driver to meet you!",
        },
        {
          id: "tpl-4",
          title: "Mid-Stay Courtesy Check-in",
          category: "Stay",
          content:
            "Hi {guestName}, checking in to see if everything is comfortable with your stay! If you need extra towels, toilet paper, or local recommendations for Skopje, please let us know anytime.",
        },
        {
          id: "tpl-5",
          title: "Checkout Instructions & Reminder",
          category: "Departure",
          content:
            "Dear {guestName}, as a reminder, checkout is tomorrow at 10:00 AM. Please turn off AC/heating, close windows, lock the door, and return the key to lockbox 3007. Wishing you safe travels ahead!",
        },
      ];

  const [selectedTplId, setSelectedTplId] = useState<string>(templates[0]?.id || "");
  const [copied, setCopied] = useState(false);
  const [customText, setCustomText] = useState<string | null>(null);

  const selectedTpl = templates.find((t) => t.id === selectedTplId) || templates[0];
  const defaultPopulated = selectedTpl
    ? populateTemplate(selectedTpl.content, booking, guide)
    : "";
  const currentText = customText !== null ? customText : defaultPopulated;

  function handleSelectTemplate(tpl: MessageTemplate) {
    setSelectedTplId(tpl.id);
    setCustomText(populateTemplate(tpl.content, booking, guide));
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

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="guest-msg-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-head">
          <div>
            <span className="eyebrow">Guest Communication</span>
            <h3>Messages for {booking.firstName} {booking.lastName}</h3>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="msg-modal-body">
          {/* Left Panel: Template List */}
          <div className="msg-tpl-sidebar">
            <span className="msg-sidebar-title">SELECT TEMPLATE</span>
            <div className="msg-tpl-list">
              {templates.map((tpl) => {
                const isSelected = tpl.id === selectedTplId;
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
              <span className="msg-preview-label">PREVIEW & EDIT (POPULATED)</span>
              <span className="msg-preview-hint">Placeholders automatically populated with guest details</span>
            </div>

            <textarea
              className="msg-preview-textarea"
              rows={7}
              value={currentText}
              onChange={(e) => setCustomText(e.target.value)}
            />

            <div className="msg-action-bar">
              <button
                type="button"
                className={`msg-copy-btn ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied to Clipboard" : "⧉ Copy Message"}
              </button>

              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="msg-wa-btn"
              >
                💬 Open in WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
