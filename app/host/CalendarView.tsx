"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Booking } from "@/lib/bookings";
import type { CalendarBlock } from "@/lib/calendar-blocks";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthTitle = (date: Date) => new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (value: string, count: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + count); return dateKey(date); };
const nightsBetween = (start: string, end: string) => Math.max(0, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000));

type Props = {
  bookings: CalendarBooking[];
  propertyId: string;
  checkInTime: string;
  checkOutTime: string;
  onOpenBooking: (booking: CalendarBooking) => void;
};

type CalendarBooking = Booking & {
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
  stayStage?: "before-arrival" | "arrival-ready" | "during-stay" | "checkout-day" | "after-departure";
};

export default function CalendarView({ bookings, propertyId, checkInTime, checkOutTime, onOpenBooking }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [status, setStatus] = useState("");

  // Interactive Selection State (click or drag)
  const [selectStart, setSelectStart] = useState<string | null>(null);
  const [selectEnd, setSelectEnd] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [blockNote, setBlockNote] = useState("Owner use / Closed");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  const todayStr = useMemo(() => dateKey(new Date()), []);

  async function loadBlocks() {
    const response = await fetch(`/api/host/blocked-dates?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
    if (response.ok) setBlocks((await response.json()).blocks || []);
  }

  useEffect(() => {
    let live = true;
    fetch(`/api/host/blocked-dates?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (live && data?.blocks) setBlocks(data.blocks); })
      .catch(() => {});
    return () => { live = false; };
  }, [propertyId]);

  // Global mouseup listener to finish drag selection
  useEffect(() => {
    function handleMouseUp() {
      if (isSelecting) {
        setIsSelecting(false);
        if (selectStart) {
          setActionModalOpen(true);
        }
      }
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isSelecting, selectStart]);

  const month = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const cells = useMemo(() => {
    const leading = (month.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const total = Math.ceil((leading + days) / 7) * 7;
    return Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - leading + 1));
  }, [month]);

  const validBookings = useMemo(() => bookings.filter((booking) => !booking.revoked).sort((a, b) => a.checkIn.localeCompare(b.checkIn)), [bookings]);
  const gapNights = useMemo(() => {
    const periods = [
      ...validBookings.map((booking) => ({ start: booking.checkIn, end: booking.checkOut })),
      ...blocks.map((block) => ({ start: block.start, end: block.end })),
    ].sort((a, b) => a.start.localeCompare(b.start));
    const merged: { start: string; end: string }[] = [];
    periods.forEach((period) => {
      const last = merged.at(-1);
      if (!last || period.start > last.end) merged.push({ ...period });
      else if (period.end > last.end) last.end = period.end;
    });
    const gaps = new Map<string, number>();
    for (let index = 0; index < merged.length - 1; index += 1) {
      const start = merged[index].end;
      const end = merged[index + 1].start;
      const nights = nightsBetween(start, end);
      for (let day = 0; day < nights; day += 1) gaps.set(addDays(start, day), nights);
    }
    return gaps;
  }, [validBookings, blocks]);

  const monthStart = dateKey(month);
  const monthEnd = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  const monthRevenue = validBookings.reduce((sum, booking) => {
    const overlapStart = booking.checkIn > monthStart ? booking.checkIn : monthStart;
    const overlapEnd = booking.checkOut < monthEnd ? booking.checkOut : monthEnd;
    const occupied = nightsBetween(overlapStart, overlapEnd);
    const total = nightsBetween(booking.checkIn, booking.checkOut) || 1;
    return sum + occupied * ((Number(booking.grossAmount) || 0) / total);
  }, 0);
  const monthOccupied = cells.filter((date) => {
    const key = dateKey(date);
    return date.getMonth() === month.getMonth() && validBookings.some((booking) => key >= booking.checkIn && key < booking.checkOut);
  }).length;
  const oneNightGaps = [...gapNights.values()].filter((nights) => nights === 1).length;

  // Range normalization for selection
  const selectedRange = useMemo(() => {
    if (!selectStart) return null;
    const end = selectEnd || selectStart;
    return selectStart <= end ? { start: selectStart, end } : { start: end, end: selectStart };
  }, [selectStart, selectEnd]);

  // Check if selected range overlaps an existing block or booking
  const selectedRangeBlocks = useMemo(() => {
    if (!selectedRange) return [];
    const rangeEndExclusive = addDays(selectedRange.end, 1);
    return blocks.filter((block) => block.start < rangeEndExclusive && block.end > selectedRange.start);
  }, [selectedRange, blocks]);

  const isRangeOverlappingBooking = useMemo(() => {
    if (!selectedRange) return false;
    const rangeEndExclusive = addDays(selectedRange.end, 1);
    return validBookings.some((b) => b.checkIn < rangeEndExclusive && b.checkOut > selectedRange.start);
  }, [selectedRange, validBookings]);

  function handleCellMouseDown(key: string, e: React.MouseEvent) {
    // Ignore if clicking on an interactive button inside the cell (like booking or checkout button)
    if ((e.target as HTMLElement).closest("button")) return;
    setSelectStart(key);
    setSelectEnd(key);
    setIsSelecting(true);
    setActionModalOpen(false);
  }

  function handleCellMouseEnter(key: string) {
    if (isSelecting) {
      setSelectEnd(key);
    }
  }

  async function handleCloseSelectedDates() {
    if (!selectedRange) return;
    setIsSubmittingBlock(true);
    setStatus("");
    const startStr = selectedRange.start;
    // Block until the day AFTER selected end day (standard checkout behavior)
    const endStr = addDays(selectedRange.end, 1);

    try {
      const response = await fetch("/api/host/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, start: startStr, end: endStr, note: blockNote.trim() || "Closed" }),
      });
      const data = await response.json();
      if (response.ok) {
        setStatus(`✅ Closed dates ${startStr} to ${selectedRange.end}.`);
        await loadBlocks();
        setActionModalOpen(false);
        setSelectStart(null);
        setSelectEnd(null);
      } else {
        setStatus(data.error || "Could not close dates.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsSubmittingBlock(false);
    }
  }

  async function handleUnblockSelectedBlocks() {
    if (selectedRangeBlocks.length === 0) return;
    setIsSubmittingBlock(true);
    setStatus("Removing blocks...");
    try {
      for (const block of selectedRangeBlocks) {
        await fetch(`/api/host/blocked-dates?propertyId=${encodeURIComponent(propertyId)}&id=${encodeURIComponent(block.id)}`, { method: "DELETE" });
      }
      setStatus("✅ Selected personal blocks removed.");
      await loadBlocks();
      setActionModalOpen(false);
      setSelectStart(null);
      setSelectEnd(null);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsSubmittingBlock(false);
    }
  }

  async function addBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/blocked-dates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form), propertyId }) });
    const data = await response.json();
    setStatus(response.ok ? "Personal dates blocked." : data.error || "Could not block dates.");
    if (response.ok) { event.currentTarget.reset(); await loadBlocks(); }
  }

  async function removeBlock(id: string) {
    const response = await fetch(`/api/host/blocked-dates?propertyId=${encodeURIComponent(propertyId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) { setStatus("Personal block removed."); await loadBlocks(); }
  }

  return <div className="operations-calendar-page">
    <div className="calendar-summary-row">
      <article><span>Occupied nights</span><strong>{monthOccupied}</strong><small>{monthTitle(month)}</small></article>
      <article><span>Booked revenue</span><strong>{new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(monthRevenue)}</strong><small>Allocated by occupied night</small></article>
      <article className={oneNightGaps ? "calendar-warning-stat" : ""}><span>One-night gaps</span><strong>{oneNightGaps}</strong><small>{oneNightGaps ? "Difficult to sell — review pricing" : "No difficult gaps this month"}</small></article>
      <article><span>Personal blocks</span><strong>{blocks.filter((block) => block.start < monthEnd && block.end > monthStart).length}</strong><small>Owner-use / Closed periods</small></article>
    </div>

    <section className="calendar-panel">
      <div className="calendar-toolbar">
        <div>
          <p className="eyebrow">Monthly operations</p>
          <h2>{monthTitle(month)}</h2>
        </div>
        <div>
          <button onClick={() => setMonthOffset((offset) => offset - 1)} aria-label="Previous month">←</button>
          <button onClick={() => setMonthOffset(0)}>Today</button>
          <button onClick={() => setMonthOffset((offset) => offset + 1)} aria-label="Next month">→</button>
        </div>
      </div>
      <div className="calendar-legend">
        <span className="legend-today">Today</span>
        <span className="legend-occupied">Occupied</span>
        <span className="legend-arrival">Check-in</span>
        <span className="legend-cleaning">Cleaning</span>
        <span className="legend-blocked">Personal block / Closed</span>
        <span className="legend-gap">Gap night</span>
        <span className="legend-one-gap">One-night gap</span>
      </div>

      {status ? <div className="calendar-status-bar">{status}</div> : null}

      <div className="operations-calendar-scroll">
        <div className="operations-calendar-grid">
          {weekDays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {cells.map((date) => {
            const key = dateKey(date);
            const isToday = key === todayStr;
            const outside = date.getMonth() !== month.getMonth();
            const staying = validBookings.find((booking) => key >= booking.checkIn && key < booking.checkOut);
            const arrival = validBookings.find((booking) => booking.checkIn === key);
            const departure = validBookings.find((booking) => booking.checkOut === key);
            const personalBlock = blocks.find((block) => key >= block.start && key < block.end);
            const gapLength = gapNights.get(key);
            const nextArrival = departure ? validBookings.find((booking) => booking.checkIn === key) : undefined;
            const isSelected = selectedRange && key >= selectedRange.start && key <= selectedRange.end;
            
            const classes = [
              "operations-calendar-day",
              isToday ? "is-today" : "",
              outside ? "outside" : "",
              staying ? "occupied" : "",
              personalBlock ? "blocked" : "",
              gapLength === 1 ? "one-night-gap" : gapLength ? "gap-night" : "",
              isSelected ? "is-selected-range" : ""
            ].filter(Boolean).join(" ");

            return <div
              className={classes}
              key={key}
              onMouseDown={(e) => handleCellMouseDown(key, e)}
              onMouseEnter={() => handleCellMouseEnter(key)}
            >
              <div className="calendar-day-number">
                <span className={isToday ? "today-badge" : ""}>{date.getDate()}</span>
                {isToday ? <span className="today-pill">TODAY</span> : null}
                {!outside && !staying && !personalBlock && !gapLength && !isToday ? <small>Empty</small> : null}
              </div>
              {personalBlock ? <div className="calendar-block-event"><b>Closed / Blocked</b><span>{personalBlock.note}</span></div> : null}
              {gapLength ? <div className={gapLength === 1 ? "calendar-gap-event critical" : "calendar-gap-event"}><b>{gapLength === 1 ? "⚠ 1-night gap" : `${gapLength}-night gap`}</b><span>{gapLength === 1 ? "Hard to sell" : "Available"}</span></div> : null}
              {staying ? <button className={`calendar-booking-event source-${staying.source.toLowerCase().replace(/[^a-z]/g, "")}`} onClick={() => onOpenBooking(staying)}><span>{arrival ? `Check-in · ${checkInTime}` : "Occupied night"}</span><b>{staying.firstName} {staying.lastName}</b><small>{staying.source}{arrival ? ` · stay total ${new Intl.NumberFormat("en", { style: "currency", currency: staying.currency || "EUR", maximumFractionDigits: 0 }).format(Number(staying.grossAmount) || 0)}` : ""}</small></button> : null}
              {departure ? <button className="calendar-departure-event" onClick={() => onOpenBooking(departure)}><b>Checkout · {checkOutTime}</b><span>{departure.firstName}</span></button> : null}
              {departure ? <div className={nextArrival ? "calendar-cleaning-event turnaround" : "calendar-cleaning-event"}><b>{nextArrival ? "Fast turnaround" : "Cleaning window"}</b><span>{checkOutTime} → {nextArrival ? checkInTime : "ready"}</span></div> : null}
            </div>;
          })}
        </div>
      </div>
    </section>

    {/* Selection Action Modal / Popover */}
    {actionModalOpen && selectedRange && (
      <div className="calendar-selection-modal-overlay" onClick={() => { setActionModalOpen(false); setSelectStart(null); setSelectEnd(null); }}>
        <div className="calendar-selection-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>📅 Manage Selected Dates</h3>
            <button className="modal-close" onClick={() => { setActionModalOpen(false); setSelectStart(null); setSelectEnd(null); }}>✕</button>
          </div>
          <div className="modal-body">
            <p className="selected-dates-range">
              <strong>{selectedRange.start}</strong> {selectedRange.start !== selectedRange.end ? `➔ ${selectedRange.end}` : ""}
              <small>({nightsBetween(selectedRange.start, addDays(selectedRange.end, 1))} day/night{selectedRange.start !== selectedRange.end ? "s" : ""})</small>
            </p>

            {isRangeOverlappingBooking && (
              <div className="modal-warning">
                ⚠️ Part of this range contains an active booking reservation.
              </div>
            )}

            {selectedRangeBlocks.length > 0 ? (
              <div className="modal-action-block">
                <p>This range contains existing personal blocks.</p>
                <button
                  type="button"
                  className="btn-unblock-range"
                  onClick={handleUnblockSelectedBlocks}
                  disabled={isSubmittingBlock}
                >
                  {isSubmittingBlock ? "Processing..." : "🔓 Re-open & Unblock Dates"}
                </button>
              </div>
            ) : (
              <div className="modal-action-block">
                <label className="block-note-label">
                  Block Reason / Note
                  <input
                    type="text"
                    value={blockNote}
                    onChange={(e) => setBlockNote(e.target.value)}
                    placeholder="e.g. Owner use, Maintenance, Closed"
                  />
                </label>
                <button
                  type="button"
                  className="btn-close-range"
                  onClick={handleCloseSelectedDates}
                  disabled={isSubmittingBlock || isRangeOverlappingBooking}
                >
                  {isSubmittingBlock ? "Closing..." : "🔒 CLOSE / BLOCK SELECTED DATES"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    <section className="calendar-block-manager"><div><p className="eyebrow">Owner use</p><h3>Block personal dates</h3><p>Blocked nights cannot be booked and appear directly in the calendar.</p></div><form onSubmit={addBlock}><label>From<input name="start" type="date" required /></label><label>Until (not included)<input name="end" type="date" required /></label><label>Reason<input name="note" placeholder="Personal stay / maintenance" /></label><button>Block dates</button></form>{status ? <p role="status">{status}</p> : null}<div className="calendar-block-list">{blocks.map((block) => <article key={block.id}><div><strong>{block.note}</strong><span>{block.start} → {block.end}</span></div><button onClick={() => removeBlock(block.id)}>Remove</button></article>)}</div></section>
  </div>;
}
