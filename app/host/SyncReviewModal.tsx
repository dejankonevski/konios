"use client";

import { useState } from "react";
import { PendingSyncItem } from "@/lib/ical";

interface SyncReviewModalProps {
  propertyName: string;
  items: PendingSyncItem[];
  errors: string[];
  onCommit: (approvedItems: PendingSyncItem[]) => Promise<void>;
  onClose: () => void;
}

export function SyncReviewModal({
  propertyName,
  items: initialItems,
  errors,
  onCommit,
  onClose,
}: SyncReviewModalProps) {
  const [items, setItems] = useState<
    Array<PendingSyncItem & { selected: boolean; isEditing: boolean }>
  >(
    initialItems.map((item) => ({
      ...item,
      selected: item.status !== "already-synced" && item.status !== "conflict",
      isEditing: item.firstName === "Booking.com" || item.firstName === "Airbnb",
    }))
  );
  const [submitting, setSubmitting] = useState(false);

  function updateItem(
    tempId: string,
    updates: Partial<PendingSyncItem & { selected: boolean; isEditing: boolean }>
  ) {
    setItems((prev) =>
      prev.map((item) => (item.tempId === tempId ? { ...item, ...updates } : item))
    );
  }

  const selectedCount = items.filter((item) => item.selected).length;

  async function handleSubmit() {
    const approved = items.filter((item) => item.selected);
    if (!approved.length) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await onCommit(approved);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box sync-review-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "800px", width: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-header" style={{ padding: "20px 24px 12px", borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🛡️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Double Layer Protection — iCal Sync Review
              </h2>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.875rem" }}>
                Review, edit parameters, or approve/skip incoming channel bookings for <strong>{propertyName}</strong>
              </p>
            </div>
          </div>
        </div>

        {errors.length > 0 && (
          <div style={{ padding: "12px 24px", background: "#fef2f2", color: "#991b1b", fontSize: "0.85rem" }}>
            ⚠️ {errors.join(" · ")}
          </div>
        )}

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <span style={{ fontSize: "36px", display: "block", marginBottom: "8px" }}>✅</span>
              <strong>All Calendars Up To Date</strong>
              <p style={{ fontSize: "0.875rem", margin: "4px 0 0" }}>No new or updated channel reservations found in external iCal feeds.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {items.map((item, index) => {
                const isBookingDotCom = item.source === "Booking.com";
                const isAirbnb = item.source === "Airbnb";
                const nights = Math.max(1, Math.round((new Date(`${item.checkOut}T00:00:00Z`).getTime() - new Date(`${item.checkIn}T00:00:00Z`).getTime()) / 86400000));

                return (
                  <div
                    key={item.tempId}
                    style={{
                      border: `1.5px solid ${item.selected ? (item.status === "conflict" ? "#fca5a5" : "#3b82f6") : "#e2e8f0"}`,
                      borderRadius: "12px",
                      background: item.selected ? (item.status === "conflict" ? "#fff5f5" : "#f0f7ff") : "#f8fafc",
                      padding: "16px",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#1e293b", background: "#e2e8f0", padding: "2px 8px", borderRadius: "6px" }}>
                          Booking {index + 1}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: isBookingDotCom ? "#003580" : isAirbnb ? "#ff385c" : "#475569",
                            color: "#ffffff",
                          }}
                        >
                          {item.source}
                        </span>

                        {item.status === "new" && (
                          <span style={{ background: "#dcfce7", color: "#166534", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px" }}>
                            ✨ New Reservation
                          </span>
                        )}
                        {item.status === "date-update" && (
                          <span style={{ background: "#dbeafe", color: "#1e40af", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px" }}>
                            📅 Dates Updated
                          </span>
                        )}
                        {item.status === "conflict" && (
                          <span style={{ background: "#fee2e2", color: "#991b1b", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px" }}>
                            ⚠️ Overlap Conflict
                          </span>
                        )}
                        {item.status === "already-synced" && (
                          <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.75rem", fontWeight: 700, padding: "2px 8px", borderRadius: "6px" }}>
                            ✓ Already Synced
                          </span>
                        )}
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", color: item.selected ? "#1e40af" : "#64748b" }}>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => updateItem(item.tempId, { selected: e.target.checked })}
                          style={{ width: "16px", height: "16px" }}
                        />
                        {item.selected ? "Import Selected" : "Skip / Ignore"}
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", fontSize: "0.85rem", marginBottom: "12px" }}>
                      <div>
                        <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Stay Window</span>
                        <strong>{item.checkIn} ➔ {item.checkOut}</strong> ({nights} night{nights > 1 ? "s" : ""})
                      </div>
                      <div>
                        <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Channel Summary</span>
                        <span>{item.summary || "N/A"}</span>
                      </div>
                      {item.conflictReason && (
                        <div style={{ gridColumn: "1 / -1", color: "#b91c1c", background: "#fef2f2", padding: "6px 10px", borderRadius: "6px" }}>
                          ⚠️ {item.conflictReason}
                        </div>
                      )}
                    </div>

                    {item.selected && (
                      <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "12px", marginTop: "8px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>First Name</label>
                            <input
                              type="text"
                              value={item.firstName}
                              onChange={(e) => updateItem(item.tempId, { firstName: e.target.value })}
                              placeholder="First Name"
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Surname</label>
                            <input
                              type="text"
                              value={item.lastName}
                              onChange={(e) => updateItem(item.tempId, { lastName: e.target.value })}
                              placeholder="Surname"
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Phone</label>
                            <input
                              type="text"
                              value={item.phone || ""}
                              onChange={(e) => updateItem(item.tempId, { phone: e.target.value })}
                              placeholder="+389..."
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Gross Amount (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.grossAmount || 0}
                              onChange={(e) => updateItem(item.tempId, { grossAmount: Number(e.target.value) || 0 })}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Net Payout (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={item.netAmount || 0}
                              onChange={(e) => updateItem(item.tempId, { netAmount: Number(e.target.value) || 0 })}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: "8px" }}>
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Host Notes</label>
                          <input
                            type="text"
                            value={item.notes || ""}
                            onChange={(e) => updateItem(item.tempId, { notes: e.target.value })}
                            placeholder="Host notes..."
                            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.85rem" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color, #e2e8f0)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
          >
            Cancel / Close
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={handleSubmit}
            disabled={submitting || (items.length > 0 && selectedCount === 0)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting
              ? "Importing & Syncing..."
              : selectedCount === 0
              ? "Close Without Importing"
              : `✨ Import & Sync ${selectedCount} Selected Booking${selectedCount > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
