"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuideEditor from "./GuideEditor";
import TemplateManager from "./TemplateManager";
import FaqManager from "./FaqManager";
import GalleryManager from "./GalleryManager";
import MetricsView from "./MetricsView";

type Booking = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: string;
  phone?: string;
  notes: string;
  revoked: boolean;
  createdAt: number;
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
  grossAmount?: number;
  netAmount?: number;
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
    "overview" | "bookings" | "new" | "guide" | "templates" | "faqs" | "gallery" | "metrics"
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
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const dragStartRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingBooking) return;
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/host/bookings/${editingBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editingBooking.firstName,
          lastName: editingBooking.lastName,
          guests: Number(editingBooking.guests),
          phone: editingBooking.phone || "",
          checkIn: editingBooking.checkIn,
          checkOut: editingBooking.checkOut,
          source: editingBooking.source,
          notes: editingBooking.notes,
          grossAmount: Number(editingBooking.grossAmount) || 0,
          netAmount: Number(editingBooking.netAmount) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "Failed to update reservation");
        setEditSaving(false);
        return;
      }
      setEditingBooking(null);
      await loadBookings();
    } catch {
      setEditError("Failed to update reservation");
    } finally {
      setEditSaving(false);
    }
  }
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

  const sortedBookings = useMemo(() => {
    const activeStays = bookings
      .filter((b) => b.accessStatus === "active")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const upcomingStays = bookings
      .filter((b) => b.accessStatus === "upcoming")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const otherStays = bookings
      .filter((b) => b.accessStatus !== "active" && b.accessStatus !== "upcoming")
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    return [...activeStays, ...upcomingStays, ...otherStays];
  }, [bookings]);

  const visible = useMemo(() => {
    return sortedBookings.filter((b) =>
      `${b.firstName} ${b.lastName} ${b.code} ${b.phone || ""} ${b.source}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [sortedBookings, search]);

  const overviewFinancials = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const currentMonthKey = `${yyyy}-${mm}`;

    const currentActiveBooking = bookings.find(
      (b) => !b.revoked && b.accessStatus === "active"
    );
    const nextArrivalBooking = bookings
      .filter((b) => !b.revoked && b.accessStatus === "upcoming")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];

    let currentMonthGross = 0;
    let currentMonthNet = 0;
    let currentMonthNights = 0;

    bookings
      .filter((b) => !b.revoked)
      .forEach((b) => {
        const checkInDate = new Date(`${b.checkIn}T00:00:00`);
        const checkOutDate = new Date(`${b.checkOut}T00:00:00`);
        const diffTime = checkOutDate.getTime() - checkInDate.getTime();
        const totalNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
        const bGross = Number(b.grossAmount) || 0;
        let bNet = Number(b.netAmount) || 0;
        if (bGross > 0 && bNet > 0 && bNet < bGross * 0.5 && (bGross - bNet) > bNet) {
          bNet = Math.max(0, bGross - bNet);
        }
        const nightlyGross = bGross / totalNights;
        const nightlyNet = bNet / totalNights;

        const curr = new Date(checkInDate);
        while (curr < checkOutDate) {
          const cYyyy = curr.getFullYear();
          const cMm = String(curr.getMonth() + 1).padStart(2, "0");
          if (`${cYyyy}-${cMm}` === currentMonthKey) {
            currentMonthGross += nightlyGross;
            currentMonthNet += nightlyNet;
            currentMonthNights += 1;
          }
          curr.setDate(curr.getDate() + 1);
        }
      });

    const monthName = monthNames[now.getMonth()];
    return {
      monthName,
      currentMonthGross,
      currentMonthNet,
      currentMonthNights,
      currentActiveBooking,
      nextArrivalBooking,
    };
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

  const active = bookings.filter((b) => b.accessStatus === "active").length,
    upcoming = bookings.filter((b) => b.accessStatus === "upcoming").length;
  const arrivals = bookings
    .filter((b) => b.accessStatus === "upcoming")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 4);
  const rows = (items: Booking[]) => (
    <div className="booking-table arrivals-unified-table">
      <div className="booking-table-head">
        <span>Guest</span>
        <span>Stay</span>
        <span>Source</span>
        <span>Status / Timing</span>
        <span>Code</span>
        <span />
      </div>
      {items.length === 0 ? (
        <div className="empty-state">
          <strong>No bookings here yet.</strong>
          <span>Create a reservation and it will appear automatically.</span>
        </div>
      ) : (
        items.map((b) => {
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
            <article
              key={b.id}
              className={`${rowClass} interactive-row`}
              onClick={() => setEditingBooking(b)}
              title="Click to view and edit reservation details"
            >
              <div className="guest-cell">
                <span className={`guest-avatar ${isNextArrival ? "hero-avatar-mid" : ""}`}>
                  {b.firstName[0]}
                  {b.lastName[0]}
                </span>
                <div className="guest-info-block">
                  <h4 className={isNextArrival ? "hero-name-txt" : "guest-fullname"}>
                    {b.firstName} {b.lastName}
                  </h4>
                  {isActive && (
                    <span className="row-tag active-tag">● Currently staying</span>
                  )}
                  {isNextArrival && (
                    <span className="row-tag next-tag">✦ Closest upcoming arrival</span>
                  )}
                  <div className="guest-sub-meta">
                    <small className="guest-count-sub">
                      {b.guests} {b.guests === 1 ? "guest" : "guests"}
                    </small>
                    {b.phone ? (
                      <span className="guest-phone-badge" onClick={(e) => e.stopPropagation()}>
                        📞 {b.phone}
                        <a
                          className="contact-chip whatsapp"
                          href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(b.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Message guest on WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          WhatsApp
                        </a>
                        <a
                          className="contact-chip call"
                          href={`tel:${b.phone}`}
                          title="Call guest"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Call
                        </a>
                      </span>
                    ) : null}
                  </div>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(b.code);
                  }}
                  title="Click to copy door code"
                >
                  <strong>{b.code}</strong> <span>⧉</span>
                </button>
              </div>

              <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingBooking(b);
                  }}
                  title="Edit guest details & stay"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    changeBooking(b, "toggle");
                  }}
                >
                  {b.revoked ? "Restore" : "Revoke"}
                </button>
                <button
                  className="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeBooking(b, "delete");
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })
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
            className={view === "metrics" ? "active" : ""}
            onClick={() => setView("metrics")}
          >
            <span>📊</span>Revenue Metrics
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
                  : view === "metrics"
                    ? "Revenue & Performance Insights"
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

            {/* Financial Overview Cards Panel */}
            <div className="overview-financial-grid">
              <div className="overview-fin-card">
                <div className="fin-head">
                  <span className="fin-title">{overviewFinancials.monthName} Revenue</span>
                  <span className="fin-chip month-chip">Current Month</span>
                </div>
                <strong className="fin-amount">
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(overviewFinancials.currentMonthGross)}
                </strong>
                <div className="fin-sub">
                  <span>Net Profit: <b>{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(overviewFinancials.currentMonthNet)}</b></span>
                  <span><b>{overviewFinancials.currentMonthNights}</b> nights booked</span>
                </div>
              </div>

              <div className="overview-fin-card">
                <div className="fin-head">
                  <span className="fin-title">Current Staying Guest</span>
                  <span className={`fin-chip ${overviewFinancials.currentActiveBooking ? "active-chip" : "empty-chip"}`}>
                    {overviewFinancials.currentActiveBooking ? "In Apartment" : "Empty"}
                  </span>
                </div>
                {overviewFinancials.currentActiveBooking ? (
                  <>
                    <strong className="fin-amount">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(overviewFinancials.currentActiveBooking.grossAmount || 0)}
                    </strong>
                    <div className="fin-sub">
                      {(() => {
                        const g = Number(overviewFinancials.currentActiveBooking.grossAmount) || 0;
                        let n = Number(overviewFinancials.currentActiveBooking.netAmount) || 0;
                        if (g > 0 && n > 0 && n < g * 0.5 && (g - n) > n) n = Math.max(0, g - n);
                        return (
                          <span>{overviewFinancials.currentActiveBooking.firstName} {overviewFinancials.currentActiveBooking.lastName} · Net <b>{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)}</b></span>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <strong className="fin-amount empty-amount">—</strong>
                    <div className="fin-sub"><span>Apartment is currently between stays</span></div>
                  </>
                )}
              </div>

              <div className="overview-fin-card">
                <div className="fin-head">
                  <span className="fin-title">Next Arrival Payout</span>
                  <span className="fin-chip upcoming-chip">
                    {overviewFinancials.nextArrivalBooking ? formatShort(overviewFinancials.nextArrivalBooking.checkIn) : "None"}
                  </span>
                </div>
                {overviewFinancials.nextArrivalBooking ? (
                  <>
                    <strong className="fin-amount">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(overviewFinancials.nextArrivalBooking.grossAmount || 0)}
                    </strong>
                    <div className="fin-sub">
                      {(() => {
                        const g = Number(overviewFinancials.nextArrivalBooking.grossAmount) || 0;
                        let n = Number(overviewFinancials.nextArrivalBooking.netAmount) || 0;
                        if (g > 0 && n > 0 && n < g * 0.5 && (g - n) > n) n = Math.max(0, g - n);
                        return (
                          <span>{overviewFinancials.nextArrivalBooking.firstName} {overviewFinancials.nextArrivalBooking.lastName} · Net <b>{new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n)}</b></span>
                        );
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <strong className="fin-amount empty-amount">—</strong>
                    <div className="fin-sub"><span>No upcoming arrival scheduled</span></div>
                  </>
                )}
              </div>
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
                          <h4 className={isNextArrival ? "hero-name-txt" : "guest-fullname"}>
                            {b.firstName} {b.lastName}
                          </h4>
                          {isActive && (
                            <span className="row-tag active-tag">● Currently staying</span>
                          )}
                          {isNextArrival && (
                            <span className="row-tag next-tag">✦ Closest upcoming arrival</span>
                          )}
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
                    <label>
                      Phone number (optional)
                      <input name="phone" placeholder="e.g. +389 70 123 456" type="tel" />
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
                  <div className="host-name-row">
                    <label>
                      Gross Amount (€)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="grossAmount"
                        placeholder="e.g. 500 (Guest Payout)"
                      />
                    </label>
                    <label>
                      Net Amount (€)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="netAmount"
                        placeholder="e.g. 400 (Net Profit)"
                      />
                    </label>
                  </div>
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
        {view === "metrics" && <MetricsView bookings={bookings} />}
        {view === "guide" && <GuideEditor />}
        {view === "templates" && <TemplateManager />}
        {view === "faqs" && <FaqManager />}
        {view === "gallery" && <GalleryManager />}
      </section>

      {editingBooking && (
        <div className="edit-modal-overlay" onClick={() => setEditingBooking(null)}>
          <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-head">
              <div>
                <p className="eyebrow">Guest Reservation</p>
                <h3>Edit Guest Details</h3>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setEditingBooking(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="edit-modal-form">
              {editError && (
                <div className="form-error alert" role="alert">
                  {editError}
                </div>
              )}

              <div className="modal-field-row">
                <div className="form-group">
                  <label htmlFor="edit-first-name">First name</label>
                  <input
                    id="edit-first-name"
                    required
                    value={editingBooking.firstName}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-last-name">Surname</label>
                  <input
                    id="edit-last-name"
                    required
                    value={editingBooking.lastName}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, lastName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-field-row">
                <div className="form-group">
                  <label htmlFor="edit-guests">Number of Guests</label>
                  <input
                    id="edit-guests"
                    required
                    type="number"
                    min="1"
                    max="12"
                    value={editingBooking.guests}
                    onChange={(e) =>
                      setEditingBooking({
                        ...editingBooking,
                        guests: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-source">Booking Source</label>
                  <select
                    id="edit-source"
                    value={editingBooking.source}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, source: e.target.value })
                    }
                  >
                    <option>Airbnb</option>
                    <option>Booking.com</option>
                    <option>Direct</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div className="modal-field-row">
                <div className="form-group full-width">
                  <label htmlFor="edit-phone">Phone Number (WhatsApp / Call)</label>
                  <div className="phone-input-wrap">
                    <input
                      id="edit-phone"
                      type="tel"
                      placeholder="e.g. +389 70 123 456"
                      value={editingBooking.phone || ""}
                      onChange={(e) =>
                        setEditingBooking({ ...editingBooking, phone: e.target.value })
                      }
                    />
                    {editingBooking.phone ? (
                      <div className="modal-phone-actions">
                        <a
                          className="quick-contact whatsapp"
                          href={`https://api.whatsapp.com/send?phone=${encodeURIComponent(editingBooking.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          💬 WhatsApp
                        </a>
                        <a
                          className="quick-contact call"
                          href={`tel:${editingBooking.phone}`}
                        >
                          📞 Call
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="modal-field-row">
                <div className="form-group">
                  <label htmlFor="edit-checkin">Check-in Date</label>
                  <input
                    id="edit-checkin"
                    required
                    type="date"
                    value={editingBooking.checkIn}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, checkIn: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-checkout">Check-out Date</label>
                  <input
                    id="edit-checkout"
                    required
                    type="date"
                    value={editingBooking.checkOut}
                    onChange={(e) =>
                      setEditingBooking({ ...editingBooking, checkOut: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-field-row">
                <div className="form-group">
                  <label htmlFor="edit-gross">Gross Amount (€)</label>
                  <input
                    id="edit-gross"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1149.28 (Total Paid)"
                    value={
                      editingBooking.grossAmount === undefined || editingBooking.grossAmount === 0
                        ? (editingBooking.grossAmount === 0 ? "0" : "")
                        : editingBooking.grossAmount
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === "" ? undefined : parseFloat(raw);
                      setEditingBooking({
                        ...editingBooking,
                        grossAmount: isNaN(val as number) ? undefined : val,
                      });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-net">Net Host Profit (€)</label>
                  <input
                    id="edit-net"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1011.24 (Bank Payout)"
                    value={
                      editingBooking.netAmount === undefined || editingBooking.netAmount === 0
                        ? (editingBooking.netAmount === 0 ? "0" : "")
                        : editingBooking.netAmount
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const val = raw === "" ? undefined : parseFloat(raw);
                      setEditingBooking({
                        ...editingBooking,
                        netAmount: isNaN(val as number) ? undefined : val,
                      });
                    }}
                  />
                </div>
              </div>

              {((editingBooking.grossAmount || 0) > 0 || (editingBooking.netAmount || 0) > 0) ? (
                (() => {
                  const g = Number(editingBooking.grossAmount) || 0;
                  let n = Number(editingBooking.netAmount) || 0;
                  if (g > 0 && n > 0 && n < g * 0.5 && (g - n) > n) {
                    n = Math.max(0, g - n);
                  }
                  const comm = Math.max(0, g - n);
                  const netPct = g > 0 ? Math.round((n / g) * 100) : 0;
                  const commPct = g > 0 ? Math.round((comm / g) * 100) : 0;

                  return (
                    <div className="price-calc-strip">
                      <span>Gross: €{g.toFixed(2)}</span>
                      <span className="calc-comm">Commission: €{comm.toFixed(2)} ({commPct}%)</span>
                      <span className="calc-net">Net Profit: €{n.toFixed(2)} ({netPct}%)</span>
                    </div>
                  );
                })()
              ) : null}

              <div className="form-group full-width">
                <label htmlFor="edit-notes">Notes / Special requests</label>
                <textarea
                  id="edit-notes"
                  rows={3}
                  value={editingBooking.notes || ""}
                  onChange={(e) =>
                    setEditingBooking({ ...editingBooking, notes: e.target.value })
                  }
                  placeholder="e.g. Late check-in after 20:00, extra towels requested"
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="primary-modal-btn" disabled={editSaving}>
                  {editSaving ? "Saving changes…" : "Save Changes ↗"}
                </button>
                <button
                  type="button"
                  className="cancel-modal-btn"
                  onClick={() => setEditingBooking(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
