"use client";

import { FormEvent, useMemo } from "react";
import type { Booking } from "@/lib/bookings";

type BaseBooking = Booking & {
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
  stayStage?: "before-arrival" | "arrival-ready" | "during-stay" | "checkout-day" | "after-departure";
};

type Generated = BaseBooking & { guest: string };

type Times = {
  checkInTime: string;
  checkOutTime: string;
  portalLeadHours: number;
  sensitiveRevealMinutes: number;
  accessExpiryMinutes: number;
};

type Props = {
  bookings: BaseBooking[];
  times: Times;
  start?: string;
  end?: string;
  setStart: (val?: string) => void;
  setEnd: (val?: string) => void;
  monthOffset: number;
  setMonthOffset: (offset: number) => void;
  months: Date[];
  hoverDate?: string;
  setHoverDate: (val?: string) => void;
  result: Generated | null;
  setResult: (res: Generated | null) => void;
  conflictBooking?: BaseBooking | null;
  error: string;
  copied: boolean;
  generate: (event: FormEvent<HTMLFormElement>) => void;
  copyCode: () => void;
  handlePointerDown: (value: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  handlePointerMove: (value: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  handlePointerUp: (value: string) => void;
};

const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function monthDays(monthDate: Date) {
  const leading = (monthDate.getDay() + 6) % 7;
  const days = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const total = Math.ceil((leading + days) / 7) * 7;

  return Array.from({ length: total }, (_, index) => {
    const dayIndex = index - leading + 1;
    if (dayIndex < 1 || dayIndex > days) return null;
    return new Date(monthDate.getFullYear(), monthDate.getMonth(), dayIndex);
  });
}

function formatShort(isoDate?: string) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NewBookingView({
  bookings,
  times,
  start,
  end,
  setStart,
  setEnd,
  monthOffset,
  setMonthOffset,
  months,
  hoverDate,
  setHoverDate,
  result,
  setResult,
  conflictBooking,
  error,
  copied,
  generate,
  copyCode,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
}: Props) {
  return (
    <div className="nb-modern-wrapper">
      {/* Top Banner Header */}
      <div className="nb-hero-banner">
        <div className="nb-hero-text">
          <span className="nb-pill">✨ MANUAL RESERVATION ENGINE</span>
          <h2>Create New Reservation</h2>
          <p>
            Generate a secure 5-digit digital PIN for your guest. Sensitive property access codes are safely locked until arrival release time.
          </p>
        </div>
        <div className="nb-hero-kpis">
          <div className="nb-kpi-chip">
            <span>Official Check-in</span>
            <strong>{times.checkInTime}</strong>
          </div>
          <div className="nb-kpi-chip">
            <span>Official Check-out</span>
            <strong>{times.checkOutTime}</strong>
          </div>
        </div>
      </div>

      <div className="nb-workspace-grid">
        {/* Left Panel: Real-time Reservation Preview Card */}
        <aside className="nb-left-summary-panel">
          <div className="nb-preview-card">
            <div className="nb-preview-head">
              <span className="nb-preview-badge">LIVE PREVIEW</span>
              <h3>Guest Access Summary</h3>
            </div>

            <div className="nb-preview-pin-box">
              <span>5-Digit Keypad PIN</span>
              <strong>{result ? result.code : "•••••"}</strong>
              <small>{result ? "Active Code" : "Auto-generated on save"}</small>
            </div>

            <div className="nb-preview-dates-container">
              <div className="nb-preview-date-item">
                <span className="label">Check-in</span>
                <strong className="val">{formatShort(start) || "Select Date"}</strong>
                <small className="time">Time: {times.checkInTime}</small>
              </div>
              <div className="nb-preview-arrow">➔</div>
              <div className="nb-preview-date-item">
                <span className="label">Check-out</span>
                <strong className="val">{formatShort(end) || "Select Date"}</strong>
                <small className="time">Time: {times.checkOutTime}</small>
              </div>
            </div>

            {(start || end) && (
              <button
                type="button"
                className="nb-reset-dates-btn"
                onClick={() => {
                  setStart(undefined);
                  setEnd(undefined);
                }}
              >
                Clear Date Selection ✕
              </button>
            )}

            <div className="nb-preview-rules">
              <div className="rule-row"><span>Portal Lock</span><b>-{times.portalLeadHours}h before check-in</b></div>
              <div className="rule-row"><span>PIN Release</span><b>-{times.sensitiveRevealMinutes}m before check-in</b></div>
              <div className="rule-row"><span>Auto-Expiry</span><b>+{times.accessExpiryMinutes}m after checkout</b></div>
            </div>
          </div>
        </aside>

        {/* Right Panel: Stepped Modern Form */}
        <main className="nb-right-form-panel">
          {!result ? (
            <form onSubmit={generate} className="nb-main-form">
              {/* Step 1: Guest Profile */}
              <section className="nb-form-step">
                <div className="nb-step-header">
                  <span className="step-badge">STEP 1</span>
                  <div>
                    <h3>Guest Information</h3>
                    <p>Primary contact details for the reservation holder</p>
                  </div>
                </div>

                <div className="nb-form-row two-col">
                  <label className="nb-field">
                    <span>First Name *</span>
                    <input name="firstName" required placeholder="e.g. Dejan" />
                  </label>
                  <label className="nb-field">
                    <span>Surname *</span>
                    <input name="lastName" required placeholder="e.g. Konevski" />
                  </label>
                </div>

                <div className="nb-form-row three-col">
                  <label className="nb-field">
                    <span>Guest Count *</span>
                    <input name="guests" required type="number" min="1" max="12" defaultValue="2" />
                  </label>
                  <label className="nb-field">
                    <span>Booking Platform *</span>
                    <select name="source" defaultValue="Airbnb">
                      <option>Airbnb</option>
                      <option>Booking.com</option>
                      <option>Direct</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label className="nb-field">
                    <span>Phone Number (Optional)</span>
                    <input name="phone" placeholder="e.g. +389 70 123 456" type="tel" />
                  </label>
                </div>
              </section>

              {/* Step 2: Date Selection Calendar */}
              <section className="nb-form-step">
                <div className="nb-step-header">
                  <span className="step-badge">STEP 2</span>
                  <div>
                    <h3>Stay Dates Picker</h3>
                    <p>Select check-in and check-out dates on the interactive calendar</p>
                  </div>
                </div>

                {conflictBooking && (
                  <div className="nb-conflict-banner">
                    ⚠️ <strong>Date Conflict Warning:</strong> Property is already booked by{" "}
                    <strong>
                      {conflictBooking.firstName} {conflictBooking.lastName}
                    </strong>{" "}
                    ({formatShort(conflictBooking.checkIn)} → {formatShort(conflictBooking.checkOut)} via {conflictBooking.source}).
                  </div>
                )}

                <div className="calendar-shell" onPointerLeave={() => setHoverDate(undefined)}>
                  <button
                    type="button"
                    className="month-arrow prev-month"
                    onClick={() => setMonthOffset(monthOffset - 1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="month-arrow next-month"
                    onClick={() => setMonthOffset(monthOffset + 1)}
                  >
                    →
                  </button>
                  {months.map((month) => (
                    <div className="calendar-month" key={dateKey(month)}>
                      <h3>
                        {monthNames[month.getMonth()]} {month.getFullYear()}
                      </h3>
                      <div className="weekdays">
                        {weekDays.map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="calendar-grid">
                        {monthDays(month).map((date, index) => {
                          if (!date) return <span key={`blank-${index}`} />;
                          const value = dateKey(date);
                          const isStart = start === value;
                          const isEnd = end === value;
                          const isSelected = isStart || isEnd;
                          const inRange = !!start && !!end && value > start && value < end;
                          const inHoverRange =
                            !end &&
                            !!start &&
                            !!hoverDate &&
                            ((hoverDate > start && value > start && value <= hoverDate) ||
                              (hoverDate < start && value < start && value >= hoverDate));
                          const existingBooking = bookings.find(
                            (b) => !b.revoked && value >= b.checkIn && value < b.checkOut
                          );
                          const cls = [
                            "day-btn",
                            isStart ? "is-start" : "",
                            isEnd ? "is-end" : "",
                            isSelected ? "selected" : "",
                            inRange ? "in-range" : "",
                            inHoverRange ? "in-hover-range" : "",
                            existingBooking ? "is-booked-date" : "",
                          ]
                            .filter(Boolean)
                            .join(" ");

                          return (
                            <button
                              type="button"
                              data-date={value}
                              key={value}
                              className={cls}
                              title={
                                existingBooking
                                  ? `Booked: ${existingBooking.firstName} ${existingBooking.lastName} (${existingBooking.checkIn} to ${existingBooking.checkOut})`
                                  : undefined
                              }
                              onPointerDown={(e) => handlePointerDown(value, e)}
                              onPointerEnter={(e) => handlePointerMove(value, e)}
                              onPointerUp={() => handlePointerUp(value)}
                            >
                              {date.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Step 3: Rates, Accounting & Cleaning */}
              <section className="nb-form-step">
                <div className="nb-step-header">
                  <span className="step-badge">STEP 3</span>
                  <div>
                    <h3>Rates &amp; Financial Bookkeeping</h3>
                    <p>Track guest payments, gross rates, and cleaning schedule</p>
                  </div>
                </div>

                <div className="nb-form-row two-col">
                  <label className="nb-field">
                    <span>Gross Amount (€)</span>
                    <input type="number" step="0.01" min="0" name="grossAmount" placeholder="e.g. 200.00" />
                  </label>
                  <label className="nb-field">
                    <span>Net Payout (€)</span>
                    <input type="number" step="0.01" min="0" name="netAmount" placeholder="e.g. 175.00" />
                  </label>
                </div>

                <div className="nb-form-row two-col">
                  <label className="nb-field">
                    <span>Payment Collected (€)</span>
                    <input type="number" step="0.01" min="0" name="paymentCollected" placeholder="0.00" />
                  </label>
                  <label className="nb-field">
                    <span>Currency</span>
                    <select name="currency" defaultValue="EUR">
                      <option>EUR</option>
                      <option>MKD</option>
                      <option>USD</option>
                    </select>
                  </label>
                </div>

                <label className="nb-field">
                  <span>Private Host Notes</span>
                  <textarea name="notes" rows={2} placeholder="Special requests, arrival flight number, key box preferences..." />
                </label>

                {/* Cleaning Toggle Card */}
                <div className="cleaning-card-toggle" style={{ marginTop: "10px" }}>
                  <div className="cleaning-card-header">
                    <div className="cleaning-card-info">
                      <span className="cleaning-card-icon">🧹</span>
                      <div>
                        <strong>Assign Cleaning Agency</strong>
                        <p>Schedule cleaning service on check-out date</p>
                      </div>
                    </div>
                    <label className="switch-toggle" htmlFor="new-cleaning-toggle-v2">
                      <input
                        id="new-cleaning-toggle-v2"
                        type="checkbox"
                        name="hasCleaningAgency"
                        defaultChecked={false}
                        onChange={(e) => {
                          const wrap = document.getElementById("new-cleaning-fee-input-wrap-v2");
                          if (wrap) wrap.style.display = e.target.checked ? "grid" : "none";
                        }}
                      />
                      <span className="switch-slider" />
                    </label>
                  </div>
                  <div id="new-cleaning-fee-input-wrap-v2" className="cleaning-card-body" style={{ display: "none" }}>
                    <div className="form-group">
                      <label htmlFor="new-cleaning-fee-v2">Agency Cleaning Fee (MKD)</label>
                      <input
                        id="new-cleaning-fee-v2"
                        type="number"
                        step="50"
                        min="0"
                        name="cleaningFeeMkd"
                        defaultValue={750}
                        placeholder="750"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {error && <p className="form-error">{error}</p>}

              <div className="nb-submit-bar">
                <button type="submit" className="nb-main-submit-btn">
                  ✨ Save Reservation &amp; Generate PIN Code ➔
                </button>
              </div>
            </form>
          ) : (
            <div className="generated-code">
              <span className="success-tick">✓</span>
              <p className="eyebrow">Reservation Successfully Created</p>
              <h2>{result.guest}</h2>
              <p>
                {formatShort(result.checkIn)} — {formatShort(result.checkOut)}
              </p>
              <div className="big-code">{result.code}</div>
              <p className="code-window">
                Portal opens {times.portalLeadHours}h before arrival · sensitive details reveal {times.sensitiveRevealMinutes}m before check-in · expires {times.accessExpiryMinutes}m after checkout
              </p>
              <button className="submit-button" onClick={copyCode}>
                {copied ? "Property Guide Link + PIN Copied!" : "Copy Property Guide Link + PIN"}
                <span>{copied ? "✓" : "⧉"}</span>
              </button>
              <button
                className="text-reset"
                onClick={() => {
                  setResult(null);
                  setStart(undefined);
                  setEnd(undefined);
                }}
              >
                + Create Another Reservation
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
