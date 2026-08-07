"use client";

/* eslint-disable @next/next/no-html-link-for-pages, react-hooks/refs */

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuideEditor from "./GuideEditor";
import TemplateManager from "./TemplateManager";
import FaqManager from "./FaqManager";
import GalleryManager from "./GalleryManager";

type Booking = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: string;
  notes: string;
  revoked: boolean;
  createdAt: number;
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
};
type Generated = Booking & { guest: string };
const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthDays(month: Date) {
  const y = month.getFullYear(),
    m = month.getMonth(),
    days = new Date(y, m + 1, 0).getDate(),
    leading = (new Date(y, m, 1).getDay() + 6) % 7;
  return [
    ...Array(leading).fill(null),
    ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1)),
  ];
}
function formatShort(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Select date";
}

function getDaysUntilLabel(checkInDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${checkInDateStr}T00:00:00`);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays <= 0) return "Arriving today";
  if (diffDays === 1) return "in 1 day";
  return `in ${diffDays} days`;
}

export default function HostPage() {
  const [unlocked, setUnlocked] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const [view, setView] = useState<
    "overview" | "bookings" | "new" | "guide" | "templates" | "faqs" | "gallery"
  >("overview"),
    [bookings, setBookings] = useState<Booking[]>([]),
    [search, setSearch] = useState("");
  const [times, setTimes] = useState({
    checkInTime: "10:00",
    checkOutTime: "10:00",
  });
  const [monthOffset, setMonthOffset] = useState(0),
    [start, setStart] = useState<string>(),
    [end, setEnd] = useState<string>(),
    [hoverDate, setHoverDate] = useState<string>(),
    [result, setResult] = useState<Generated | null>(null);
  const dragStartRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const months = useMemo(() => {
    const now = new Date();
    return [0, 1].map(
      (d) => new Date(now.getFullYear(), now.getMonth() + monthOffset + d, 1),
    );
  }, [monthOffset]);

  const conflictBooking = useMemo(() => {
    if (!start || !end) return null;
    return bookings.find(
      (b) => !b.revoked && start < b.checkOut && end > b.checkIn
    );
  }, [start, end, bookings]);

  const overviewList = useMemo(() => {
    const activeStays = bookings
      .filter((b) => b.accessStatus === "active")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const upcomingStays = bookings
      .filter((b) => b.accessStatus === "upcoming")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    return [...activeStays, ...upcomingStays];
  }, [bookings]);

  const nextArrivalId = useMemo(() => {
    const firstUpcoming = bookings
      .filter((b) => b.accessStatus === "upcoming")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
    return firstUpcoming?.id;
  }, [bookings]);

  async function loadBookings() {
    const response = await fetch("/api/host/code", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setBookings(data.bookings);
      if (data.times) setTimes(data.times);
    }
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/host/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    setUnlocked(true);
    setPassword("");
    await loadBookings();
  }

  function handleDateClick(value: string) {
    if (!start || (start && end)) {
      setStart(value);
      setEnd(undefined);
    } else {
      if (value <= start) {
        setStart(value);
        setEnd(undefined);
      } else {
        setEnd(value);
      }
    }
  }

  function handlePointerDown(value: string, event: React.PointerEvent<HTMLButtonElement>) {
    dragStartRef.current = value;
    isDraggingRef.current = false;
    pointerDownPosRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerMove(value: string, event: React.PointerEvent<HTMLButtonElement>) {
    setHoverDate(value);
    if (event.buttons === 1 && dragStartRef.current && pointerDownPosRef.current) {
      const dx = Math.abs(event.clientX - pointerDownPosRef.current.x);
      const dy = Math.abs(event.clientY - pointerDownPosRef.current.y);
      if (dx > 6 || dy > 6) {
        isDraggingRef.current = true;
        const [s, eVal] = [dragStartRef.current, value].sort();
        setStart(s);
        setEnd(eVal);
      }
    }
  }

  function handlePointerUp(value: string) {
    if (!isDraggingRef.current) {
      handleDateClick(value);
    }
    dragStartRef.current = null;
    pointerDownPosRef.current = null;
    isDraggingRef.current = false;
  }
  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start || !end)
      return setError("Select the complete stay period on the calendar.");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/host/code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...Object.fromEntries(form),
        checkIn: start,
        checkOut: end,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) setUnlocked(false);
      return setError(data.error ?? "Unable to save this booking.");
    }
    setResult(data);
    setCopied(false);
    await loadBookings();
  }
  async function copyCode() {
    if (result) {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
    }
  }
  async function changeBooking(booking: Booking, action: "toggle" | "delete") {
    if (
      action === "delete" &&
      !window.confirm(
        `Delete ${booking.firstName} ${booking.lastName}'s booking?`,
      )
    )
      return;
    await fetch(
      `/api/host/bookings/${booking.id}`,
      action === "delete"
        ? { method: "DELETE" }
        : {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revoked: !booking.revoked }),
          },
    );
    await loadBookings();
  }

  if (!unlocked)
    return (
      <main className="host-lock">
        <Link className="brand" href="/">
          <span className="brand-mark">K</span>
          <span>KONIOS HOUSE</span>
        </Link>
        <form onSubmit={login}>
          <p className="eyebrow">Private host desk</p>
          <h1>Host access.</h1>
          <p>
            Enter the host password to manage reservations and guest access.
          </p>
          <label>
            Password
            <input
              autoFocus
              required
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="submit-button">
            Continue<span>→</span>
          </button>
        </form>
      </main>
    );

  const visible = bookings.filter((b) =>
    `${b.firstName} ${b.lastName} ${b.code}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const active = bookings.filter((b) => b.accessStatus === "active").length,
    upcoming = bookings.filter((b) => b.accessStatus === "upcoming").length;
  const arrivals = bookings
    .filter((b) => b.accessStatus === "upcoming")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 4);
  const rows = (items: Booking[]) => (
    <div className="booking-table">
      <div className="booking-table-head">
        <span>Guest</span>
        <span>Stay</span>
        <span>Source</span>
        <span>Access</span>
        <span>Code</span>
        <span />
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No bookings here yet.</strong>
          <span>Create a reservation and it will appear automatically.</span>
        </div>
      ) : (
        items.map((b) => (
          <article key={b.id}>
            <div className="guest-cell">
              <span className="guest-avatar">
                {b.firstName[0]}
                {b.lastName[0]}
              </span>
              <div>
                <strong>
                  {b.firstName} {b.lastName}
                </strong>
                <small>
                  {b.guests} {b.guests === 1 ? "guest" : "guests"}
                </small>
              </div>
            </div>
            <div>
              <strong>{formatShort(b.checkIn)}</strong>
              <small>to {formatShort(b.checkOut)}</small>
            </div>
            <div>
              <span
                className={`source-dot ${b.source.toLowerCase().replace(".com", "").replace(" ", "-")}`}
              />
              {b.source}
            </div>
            <div>
              <span className={`status-pill ${b.accessStatus}`}>
                {b.accessStatus}
              </span>
            </div>
            <button
              className="code-chip"
              onClick={() => navigator.clipboard.writeText(b.code)}
            >
              {b.code} <span>⧉</span>
            </button>
            <div className="row-actions">
              <button onClick={() => changeBooking(b, "toggle")}>
                {b.revoked ? "Restore" : "Revoke"}
              </button>
              <button
                className="danger"
                onClick={() => changeBooking(b, "delete")}
              >
                Delete
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );

  return (
    <main className="host-dashboard">
      <aside className="dashboard-sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">K</span>
          <span>KONIOS HOUSE</span>
        </a>
        <nav>
          <button
            className={view === "overview" ? "active" : ""}
            onClick={() => setView("overview")}
          >
            <span>⌂</span>Overview
          </button>
          <button
            className={view === "bookings" ? "active" : ""}
            onClick={() => setView("bookings")}
          >
            <span>▤</span>Bookings
          </button>
          <button
            className={view === "new" ? "active" : ""}
            onClick={() => {
              setView("new");
              setResult(null);
            }}
          >
            <span>＋</span>New booking
          </button>
          <button
            className={view === "guide" ? "active" : ""}
            onClick={() => setView("guide")}
          >
            <span>⌘</span>Guest guide
          </button>
          <button
            className={view === "templates" ? "active" : ""}
            onClick={() => setView("templates")}
          >
            <span>✉</span>Templates
          </button>
          <button
            className={view === "faqs" ? "active" : ""}
            onClick={() => setView("faqs")}
          >
            <span>❓</span>FAQs
          </button>
          <button
            className={view === "gallery" ? "active" : ""}
            onClick={() => setView("gallery")}
          >
            <span>🖼</span>Gallery
          </button>
        </nav>
        <div className="sidebar-foot">
          <span>Access window</span>
          <strong>{times.checkInTime} → {times.checkOutTime}</strong>
          <small>Europe/Skopje</small>
        </div>
      </aside>
      <section className="dashboard-main">
        <header>
          <div>
            <p className="eyebrow">Host dashboard</p>
            <h1>
              {view === "overview"
                ? "Good day, Dejan."
                : view === "bookings"
                  ? "All bookings"
                  : view === "guide"
                    ? "Guest guide"
                    : view === "templates"
                      ? "Message templates"
                      : view === "faqs"
                        ? "Frequent answers (FAQs)"
                        : view === "gallery"
                          ? "Photo gallery"
                          : "New booking"}
            </h1>
          </div>
          <button
            className="quick-add"
            onClick={() => {
              setView("new");
              setResult(null);
            }}
          >
            ＋ Add guest
          </button>
        </header>
        {view === "overview" && (
          <>
            <div className="metric-grid">
              <article>
                <span>Currently staying</span>
                <strong>{active}</strong>
                <small>
                  {active
                    ? "Guest access is live"
                    : "Apartment is between stays"}
                </small>
              </article>
              <article>
                <span>Upcoming stays</span>
                <strong>{upcoming}</strong>
                <small>Codes scheduled automatically</small>
              </article>
              <article>
                <span>Total reservations</span>
                <strong>{bookings.length}</strong>
                <small>Stored securely</small>
              </article>
              <article className="metric-accent">
                <span>Next arrival</span>
                <strong>
                  {arrivals[0]
                    ? new Date(`${arrivals[0].checkIn}T12:00:00`).getDate()
                    : "—"}
                </strong>
                <small>
                  {arrivals[0]
                    ? `${arrivals[0].firstName} · ${formatShort(arrivals[0].checkIn)}`
                    : "No arrival scheduled"}
                </small>
              </article>
            </div>
            <div className="dashboard-section-title">
              <div>
                <p className="eyebrow">Coming up</p>
                <h2>Next arrivals</h2>
              </div>
              <button onClick={() => setView("bookings")}>View all →</button>
            </div>
            <div className="booking-table arrivals-unified-table">
              <div className="booking-table-head">
                <span>Guest</span>
                <span>Stay</span>
                <span>Source</span>
                <span>Status / Timing</span>
                <span>Code</span>
                <span />
              </div>
              {overviewList.length === 0 ? (
                <div className="empty-state">
                  <strong>No active or upcoming arrivals.</strong>
                  <span>Create a reservation and it will appear automatically.</span>
                </div>
              ) : (
                overviewList.map((b) => {
                  const isActive = b.accessStatus === "active";
                  const isNextArrival = b.id === nextArrivalId;
                  const countdown = isActive
                    ? "Active now"
                    : getDaysUntilLabel(b.checkIn);

                  const rowClass = [
                    "booking-table-row",
                    isActive ? "is-active-row" : "",
                    isNextArrival ? "is-next-hero-row" : "is-subsequent-row",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <article key={b.id} className={rowClass}>
                      <div className="guest-cell">
                        <span className={`guest-avatar ${isNextArrival ? "hero-avatar-mid" : ""}`}>
                          {b.firstName[0]}
                          {b.lastName[0]}
                        </span>
                        <div className="guest-info-block">
                          {isActive && (
                            <span className="row-tag active-tag">● Currently staying</span>
                          )}
                          {isNextArrival && (
                            <span className="row-tag next-tag">✦ Closest upcoming arrival</span>
                          )}
                          <h4 className={isNextArrival ? "hero-name-txt" : "guest-fullname"}>
                            {b.firstName} {b.lastName}
                          </h4>
                          <small className="guest-count-sub">
                            {b.guests} {b.guests === 1 ? "guest" : "guests"}
                          </small>
                        </div>
                      </div>

                      <div className="stay-cell">
                        <strong className={isNextArrival ? "hero-date-txt" : "stay-date-txt"}>
                          {formatShort(b.checkIn)}
                        </strong>
                        <small className="stay-sub-txt">to {formatShort(b.checkOut)}</small>
                      </div>

                      <div className="source-cell">
                        <span
                          className={`source-dot ${b.source.toLowerCase().replace(".com", "").replace(" ", "-")}`}
                        />
                        <span>{b.source}</span>
                      </div>

                      <div className="timing-cell">
                        <span
                          className={`countdown-pill ${
                            isActive
                              ? "chip-active"
                              : isNextArrival
                                ? "chip-next-hero"
                                : "chip-subsequent"
                          }`}
                        >
                          {countdown}
                        </span>
                      </div>

                      <div className="code-cell">
                        <button
                          className={`code-chip ${isNextArrival ? "hero-code-chip-inline" : ""}`}
                          onClick={() => navigator.clipboard.writeText(b.code)}
                          title="Click to copy door code"
                        >
                          <strong>{b.code}</strong> <span>⧉</span>
                        </button>
                      </div>

                      <div className="row-actions">
                        <button onClick={() => changeBooking(b, "toggle")}>
                          {b.revoked ? "Restore" : "Revoke"}
                        </button>
                        <button className="danger" onClick={() => changeBooking(b, "delete")}>
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
            <div className="pro-tip">
              <span>✦</span>
              <div>
                <strong>Timing handled automatically</strong>
                <p>
                  Every code opens at {times.checkInTime} on arrival day and
                  closes at {times.checkOutTime} on checkout day in Skopje
                  time, including daylight-saving changes.
                </p>
              </div>
            </div>
          </>
        )}
        {view === "bookings" && (
          <>
            <div className="booking-tools">
              <label>
                Search guests or codes
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                />
              </label>
              <div className="legend">
                <span>
                  <i className="status-dot active" />
                  Active
                </span>
                <span>
                  <i className="status-dot upcoming" />
                  Upcoming
                </span>
                <span>
                  <i className="status-dot expired" />
                  Past
                </span>
              </div>
            </div>
            {rows(visible)}
          </>
        )}
        {view === "new" && (
          <div className="new-booking-layout">
            <div className="host-intro">
              <p className="eyebrow">Manual reservation</p>
              <h2>Prepare their stay.</h2>
              <p>
                Create one secure code for the full stay. It will be stored here
                and controlled by the exact arrival window.
              </p>
              <ul>
                <li>Five-digit guest code</li>
                <li>Automatic activation and expiry</li>
                <li>One-click copy, revoke or delete</li>
              </ul>
            </div>
            <div className="host-card host-card-wide">
              {!result ? (
                <form onSubmit={generate}>
                  <div className="host-name-row">
                    <label>
                      First name
                      <input name="firstName" required />
                    </label>
                    <label>
                      Surname
                      <input name="lastName" required />
                    </label>
                  </div>
                  <div className="host-name-row compact-fields">
                    <label>
                      Guests
                      <input
                        name="guests"
                        required
                        type="number"
                        min="1"
                        max="12"
                        defaultValue="2"
                      />
                    </label>
                    <label>
                      Booking source
                      <select name="source" defaultValue="Airbnb">
                        <option>Airbnb</option>
                        <option>Booking.com</option>
                        <option>Direct</option>
                        <option>Other</option>
                      </select>
                    </label>
                  </div>
                  <div className="range-summary">
                    <div>
                      <span>Check in · {times.checkInTime}</span>
                      <strong>{formatShort(start)}</strong>
                    </div>
                    <div>
                      <span>Check out · {times.checkOutTime}</span>
                      <strong>{formatShort(end)}</strong>
                    </div>
                    {(start || end) && (
                      <button
                        type="button"
                        className="reset-range-btn"
                        onClick={() => {
                          setStart(undefined);
                          setEnd(undefined);
                        }}
                      >
                        Clear ✕
                      </button>
                    )}
                  </div>
                  {conflictBooking && (
                    <div className="overlap-warning-banner">
                      ⚠️ <strong>Date Overlap Warning:</strong> Apartment is already reserved by{" "}
                      <strong>
                        {conflictBooking.firstName} {conflictBooking.lastName}
                      </strong>{" "}
                      ({formatShort(conflictBooking.checkIn)} to {formatShort(conflictBooking.checkOut)} via {conflictBooking.source}).
                    </div>
                  )}
                  <div
                    className="calendar-shell"
                    onPointerLeave={() => setHoverDate(undefined)}
                  >
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
                          {monthDays(month).map((date, index) =>
                            date ? (
                              (() => {
                                const value = dateKey(date),
                                  isStart = start === value,
                                  isEnd = end === value,
                                  isSelected = isStart || isEnd,
                                  inRange =
                                    !!start &&
                                    !!end &&
                                    value > start &&
                                    value < end,
                                  inHoverRange =
                                    !end &&
                                    !!start &&
                                    !!hoverDate &&
                                    ((hoverDate > start &&
                                      value > start &&
                                      value <= hoverDate) ||
                                      (hoverDate < start &&
                                        value < start &&
                                        value >= hoverDate));
                                const existingBooking = bookings.find(
                                  (b) =>
                                    !b.revoked &&
                                    value >= b.checkIn &&
                                    value < b.checkOut
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
                              })()
                            ) : (
                              <span key={`blank-${index}`} />
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="calendar-help">
                    Drag from arrival to departure · Tap twice on mobile
                  </p>
                  <label>
                    Private notes
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Arrival details, preferences, reminders…"
                    />
                  </label>
                  {error && <p className="form-error">{error}</p>}
                  <button className="submit-button">
                    Save booking & generate code<span>↗</span>
                  </button>
                </form>
              ) : (
                <div className="generated-code">
                  <span className="success-tick">✓</span>
                  <p className="eyebrow">Reservation saved</p>
                  <h2>{result.guest}</h2>
                  <p>
                    {formatShort(result.checkIn)} —{" "}
                    {formatShort(result.checkOut)}
                  </p>
                  <div className="big-code">{result.code}</div>
                  <p className="code-window">
                    Valid from {times.checkInTime} on arrival until {times.checkOutTime} on checkout
                  </p>
                  <button className="submit-button" onClick={copyCode}>
                    {copied ? "Copied" : "Copy guest code"}
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
                    Create another booking
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {view === "guide" && <GuideEditor />}
        {view === "templates" && <TemplateManager />}
        {view === "faqs" && <FaqManager />}
        {view === "gallery" && <GalleryManager />}
      </section>
    </main>
  );
}
