"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, Fragment, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GuideEditor from "./GuideEditor";
import TemplateManager from "./TemplateManager";
import FaqManager from "./FaqManager";
import GalleryManager from "./GalleryManager";
import MetricsView from "./MetricsView";
import ExpensesView from "./ExpensesView";
import GuestMessageModal from "./GuestMessageModal";
import PropertyManager from "./PropertyManager";
import CalendarView from "./CalendarView";
import type { GuestGuide } from "@/lib/guest-guide";
import type { Property } from "@/lib/portfolio";

type Booking = {
  id: string;
  propertyId?: string;
  code: string;
  accessToken: string;
  firstName: string;
  lastName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  source: "Airbnb" | "Booking.com" | "Direct" | "Other";
  phone?: string;
  notes: string;
  revoked: boolean;
  createdAt: number;
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
  stayStage?: "before-arrival" | "arrival-ready" | "during-stay" | "checkout-day" | "after-departure";
  grossAmount?: number;
  netAmount?: number;
  currency?: string;
  paymentCollected?: number;
  idRegistrationComplete?: boolean;
  archivedAt?: number | null;
  hasCleaningAgency?: boolean;
  cleaningFeeMkd?: number;
  cleaningStatus?: "scheduled" | "completed";
  cleaningNotes?: string;
  isNoShow?: boolean;
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

function getCleaningWindowHours(checkOutTime: string, checkInTime: string): number {
  const [outH, outM] = checkOutTime.split(":").map(Number);
  const [inH, inM] = checkInTime.split(":").map(Number);
  const outMins = (outH || 10) * 60 + (outM || 0);
  const inMins = (inH || 10) * 60 + (inM || 0);
  let diffMins = inMins - outMins;
  if (diffMins < 0) diffMins += 24 * 60;
  return Math.max(0, Math.round((diffMins / 60) * 10) / 10);
}

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

function getDaysUntilLabel(checkInDateStr: string, checkInTime = "15:00"): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${checkInDateStr}T00:00:00`);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return `Arriving today at ${checkInTime}`;
  if (diffDays === 1) return `Tomorrow at ${checkInTime}`;
  return `in ${diffDays} days`;
}

export default function HostPage() {
  const [unlocked, setUnlocked] = useState(false),
    [username, setUsername] = useState("master"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false);
  const [view, setView] = useState<
    "overview" | "calendar" | "bookings" | "new" | "guide" | "templates" | "faqs" | "gallery" | "metrics" | "expenses" | "properties"
  >("overview"),
    [bookings, setBookings] = useState<Booking[]>([]),
    [search, setSearch] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("konios-house");
  const [hostRole, setHostRole] = useState<"master" | "property-admin">("master");
  const [times, setTimes] = useState({
    checkInTime: "15:00",
    checkOutTime: "10:00",
    portalLeadHours: 48,
    sensitiveRevealMinutes: 30,
    accessExpiryMinutes: 30,
  });
  const [monthOffset, setMonthOffset] = useState(0),
    [start, setStart] = useState<string>(),
    [end, setEnd] = useState<string>(),
    [hoverDate, setHoverDate] = useState<string>(),
    [result, setResult] = useState<Generated | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [lastArchived, setLastArchived] = useState<Booking | null>(null);
  const [messagingBooking, setMessagingBooking] = useState<Booking | null>(null);
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
          currency: editingBooking.currency || "EUR",
          paymentCollected: Number(editingBooking.paymentCollected) || 0,
          idRegistrationComplete: Boolean(editingBooking.idRegistrationComplete),
          hasCleaningAgency: Boolean(editingBooking.hasCleaningAgency),
          cleaningFeeMkd: Number(editingBooking.cleaningFeeMkd) || 750,
          cleaningStatus: editingBooking.cleaningStatus || "scheduled",
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
      (b) => !b.revoked && (b.stayStage === "during-stay" || b.stayStage === "checkout-day")
    );
    const nextArrivalBooking = bookings
      .filter((b) => !b.revoked && b.accessStatus === "upcoming")
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];

    let currentMonthGross = 0;
    let currentMonthNet = 0;
    let currentMonthNights = 0;

    bookings
      .filter((b) => !b.revoked && !b.isNoShow)
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

  const [guestGuide, setGuestGuide] = useState<GuestGuide | null>(null);

  async function loadGuide(propertyId = selectedPropertyId) {
    try {
      const res = await fetch(`/api/host/guide?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setGuestGuide(data.guide);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadBookings(propertyId = selectedPropertyId) {
    const response = await fetch(`/api/host/code?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setBookings(data.bookings);
      if (data.times) setTimes(data.times);
    }
    await loadGuide(propertyId);
  }
  async function loadPortfolio() {
    const response = await fetch("/api/host/properties", { cache: "no-store" });
    if (!response.ok) return selectedPropertyId;
    const data = await response.json();
    const nextProperties = (data.properties || []) as Property[];
    setProperties(nextProperties);
    setHostRole(data.session?.role || "property-admin");
    const nextPropertyId = nextProperties.some((property) => property.id === selectedPropertyId) ? selectedPropertyId : nextProperties[0]?.id || "konios-house";
    setSelectedPropertyId(nextPropertyId);
    return nextPropertyId;
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/host/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error);
    setUnlocked(true);
    setPassword("");
    setHostRole(data.session?.role || "property-admin");
    const propertyId = await loadPortfolio();
    await loadBookings(propertyId);
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
        propertyId: selectedPropertyId,
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
      const propertySlug = properties.find((property) => property.id === (result.propertyId || selectedPropertyId))?.slug;
      const link = `${window.location.origin}/${propertySlug || "access"}`;
      await navigator.clipboard.writeText(`Guest guide: ${link}\nFive-digit PIN: ${result.code}`);
      setCopied(true);
    }
  }
  async function handleCleaningAction(booking: Booking, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    let updates: Record<string, unknown> = {};

    if (!booking.hasCleaningAgency) {
      updates = {
        hasCleaningAgency: true,
        cleaningFeeMkd: booking.cleaningFeeMkd || 750,
        cleaningStatus: "scheduled",
      };
    } else if (booking.cleaningStatus === "scheduled") {
      updates = { cleaningStatus: "completed" };
    } else {
      const choice = window.confirm(
        `Cleaning is marked as completed for ${booking.firstName} ${booking.lastName}.\n\nClick OK to revert to Scheduled status, or Cancel to unassign agency.`
      );
      if (choice) {
        updates = { cleaningStatus: "scheduled" };
      } else {
        updates = { hasCleaningAgency: false };
      }
    }

    await fetch(`/api/host/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    await loadBookings();
  }

  async function toggleNoShow(booking: Booking) {
    const newNoShow = !booking.isNoShow;
    const promptMsg = newNoShow
      ? `Are you sure you want to flag ${booking.firstName} ${booking.lastName} as No-Show / Unpaid?\n\nThis will keep their reservation recorded but EXCLUDE the amount from revenue totals.`
      : `Are you sure you want to unmark No-Show status for ${booking.firstName} ${booking.lastName}?`;

    if (!window.confirm(promptMsg)) return;

    await fetch(`/api/host/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isNoShow: newNoShow }),
    });
    await loadBookings();
  }

  async function changeBooking(booking: Booking, action: "toggle" | "delete") {
    const promptMsg = action === "delete"
      ? `Archive ${booking.firstName} ${booking.lastName}'s reservation? You can undo this action.`
      : booking.revoked
      ? `Are you sure you want to restore access code for ${booking.firstName} ${booking.lastName}?`
      : `Are you sure you want to revoke access code for ${booking.firstName} ${booking.lastName}?`;

    if (!window.confirm(promptMsg)) return;

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
    if (action === "delete") setLastArchived(booking);
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
            Sign in as master or with the username assigned to a property manager.
          </p>
          <label>
            Username
            <input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              autoFocus
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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

  const active = bookings.filter((b) => b.stayStage === "during-stay" || b.stayStage === "checkout-day").length,
    upcoming = bookings.filter((b) => b.accessStatus === "upcoming").length;
  const arrivals = bookings
    .filter((b) => b.accessStatus === "upcoming")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 4);
  const todayKey = dateKey(new Date());
  const arrivingToday = bookings.filter((b) => !b.revoked && b.checkIn === todayKey);
  const departingToday = bookings.filter((b) => !b.revoked && b.checkOut === todayKey);
  const paymentDue = bookings.filter((b) => !b.revoked && (Number(b.grossAmount) || 0) > (Number(b.paymentCollected) || 0));
  const registrationMissing = bookings.filter((b) => !b.revoked && !b.idRegistrationComplete && b.accessStatus !== "expired");
  const nextUnoccupiedGap = (() => {
    const stays = bookings
      .filter((booking) => !booking.revoked && booking.checkOut > todayKey)
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    let cursor = todayKey;

    for (const stay of stays) {
      if (stay.checkOut <= cursor) continue;
      if (stay.checkIn > cursor) {
        const nights = Math.round(
          (new Date(`${stay.checkIn}T12:00:00`).getTime() - new Date(`${cursor}T12:00:00`).getTime()) /
            86_400_000
        );
        return { start: cursor, end: stay.checkIn, nights };
      }
      if (stay.checkOut > cursor) cursor = stay.checkOut;
    }

    return { start: cursor, end: undefined, nights: undefined };
  })();
  const rows = (items: Booking[]) => (
    <div className="booking-table arrivals-unified-table">
      <div className="booking-table-head">
        <span>Guest</span>
        <span>Stay</span>
        <span>Source</span>
        <span>Total Amount</span>
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
        items.map((b, index) => {
          const nextB = items[index + 1];
          const isSameDayTurnaround = Boolean(
            nextB && !b.revoked && !nextB.revoked && b.checkOut === nextB.checkIn
          );
          const isActive = b.stayStage === "during-stay" || b.stayStage === "checkout-day";
          const isExpired = b.accessStatus === "expired" || b.revoked;
          const isNextArrival = b.id === nextArrivalId;
          const isNoShow = Boolean(b.isNoShow);
          const countdown = isNoShow
            ? "🛑 No-Show"
            : isExpired
              ? (b.revoked ? "Revoked" : "Expired")
              : isActive
                ? "Active now"
                : getDaysUntilLabel(b.checkIn, times.checkInTime);

          const rowClass = [
            "booking-table-row",
            isNoShow ? "is-noshow-row" : "",
            isActive ? "is-active-row" : "",
            isNextArrival ? "is-next-hero-row" : "is-subsequent-row",
          ]
            .filter(Boolean)
            .join(" ");

          const effectiveGross = Number(b.grossAmount) || 0;
          let effectiveNet = Number(b.netAmount) || 0;
          if (effectiveGross > 0 && effectiveNet > 0 && effectiveNet < effectiveGross * 0.5 && (effectiveGross - effectiveNet) > effectiveNet) {
            effectiveNet = Math.max(0, effectiveGross - effectiveNet);
          }

          const d1 = new Date(`${b.checkIn}T00:00:00`);
          const d2 = new Date(`${b.checkOut}T00:00:00`);
          const diffTime = d2.getTime() - d1.getTime();
          const stayNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

          return (
            <Fragment key={b.id}>
              <article
                className={`${rowClass} interactive-row`}
                onClick={() => setEditingBooking(b)}
                title="Click to view and edit reservation details"
              >
                <div className="guest-cell">
                  <span className={`guest-avatar ${isNextArrival ? "hero-avatar-mid" : ""} ${isNoShow ? "noshow-avatar" : ""}`}>
                    {b.firstName[0]}
                    {b.lastName[0]}
                  </span>
                  <div className="guest-info-block">
                    <h4 className={isNextArrival ? "hero-name-txt" : "guest-fullname"}>
                      {b.firstName} {b.lastName}
                    </h4>
                    {isNoShow && (
                      <span className="row-tag noshow-tag">🛑 No-Show / Unpaid</span>
                    )}
                    {isActive && !isNoShow && (
                      <span className="row-tag active-tag">● Currently staying</span>
                    )}
                    {isNextArrival && !isNoShow && (
                      <span className="row-tag next-tag">✦ Closest upcoming arrival</span>
                    )}
                    {b.hasCleaningAgency && (
                      <span
                        className={`row-tag interactive-tag ${b.cleaningStatus === "completed" ? "cleaning-cleaned-tag" : "cleaning-scheduled-tag"}`}
                        onClick={(e) => handleCleaningAction(b, e)}
                        title="Click to update agency cleaning status"
                      >
                        {b.cleaningStatus === "completed"
                          ? `✓ Agency Cleaned (${b.cleaningFeeMkd || 750} MKD)`
                          : `🧹 Agency Scheduled (${b.cleaningFeeMkd || 750} MKD)`}
                      </span>
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
                    <div className="reservation-ops-timeline" aria-label="Reservation operational timeline">
                      <span className="done">Booked</span><span className={b.accessStatus === "upcoming" ? "current" : "done"}>Arrival</span><span className={b.accessStatus === "active" ? "current" : b.accessStatus === "expired" ? "done" : ""}>Stay</span><span className={b.accessStatus === "expired" ? "done" : ""}>Checkout</span>
                    </div>
                  </div>
                </div>

                <div className="stay-cell">
                  <strong className={isNextArrival ? "hero-date-txt" : "stay-date-txt"}>
                    {formatShort(b.checkIn)}
                  </strong>
                  <small className="stay-sub-txt">to {formatShort(b.checkOut)}</small>
                  <span className="stay-nights-badge">🌙 {stayNights} {stayNights === 1 ? "night" : "nights"}</span>
                  <button
                    type="button"
                    className={`cleaning-pill-btn ${!b.hasCleaningAgency ? "unscheduled" : b.cleaningStatus === "completed" ? "cleaned" : "scheduled"}`}
                    onClick={(e) => handleCleaningAction(b, e)}
                    title={
                      !b.hasCleaningAgency
                        ? "Click to schedule cleaning agency for checkout day"
                        : b.cleaningStatus === "completed"
                        ? "Click to manage completed cleaning agency"
                        : "Click to mark cleaning agency completed"
                    }
                  >
                    {!b.hasCleaningAgency
                      ? "+ 🧹 Agency Cleaning"
                      : b.cleaningStatus === "completed"
                      ? `✓ Agency Cleaned (${b.cleaningFeeMkd || 750} MKD)`
                      : `🧹 Agency Scheduled (${b.cleaningFeeMkd || 750} MKD)`}
                  </button>
                </div>

                <div className="source-cell">
                  <span
                    className={`source-dot ${b.source.toLowerCase().replace(".com", "").replace(" ", "-")}`}
                  />
                  <span>{b.source}</span>
                </div>

                <div className="amount-cell">
                  {(effectiveGross > 0 || effectiveNet > 0) ? (
                    <div className="amount-stack">
                      <strong className={`amount-gross-val ${isNextArrival ? "hero-gross-txt" : ""} ${isNoShow ? "strikethrough-gross" : ""}`}>
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(effectiveGross)}
                      </strong>
                      {isNoShow ? (
                        <small className="noshow-unpaid-sub">🛑 Unpaid (Excluded)</small>
                      ) : effectiveNet > 0 ? (
                        <small className="amount-net-sub">
                          Net {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(effectiveNet)}
                        </small>
                      ) : null}
                    </div>
                  ) : (
                    <span className="unpriced-pill" title="Click to add stay prices">+ Add price</span>
                  )}
                </div>

                <div className="timing-cell">
                  <span
                    className={`countdown-pill ${
                      isNoShow
                        ? "chip-noshow"
                        : isActive
                          ? "chip-active"
                          : isExpired
                            ? "chip-expired"
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
                    className="msg-action-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMessagingBooking(b);
                    }}
                    title="View & copy populated messages for this guest"
                  >
                    ✉ Message
                  </button>
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
                    className={`noshow-btn ${isNoShow ? "active-noshow" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNoShow(b);
                    }}
                    title={isNoShow ? "Unmark No-Show status" : "Flag as No-Show / Unpaid (excludes from totals)"}
                  >
                    {isNoShow ? "Unmark No-Show" : "🛑 No-Show"}
                  </button>
                  <button
                    className="danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      changeBooking(b, "delete");
                    }}
                  >
                    Archive
                  </button>
                </div>
              </article>

              {isSameDayTurnaround && nextB && (() => {
                const windowHours = getCleaningWindowHours(times.checkOutTime, times.checkInTime);
                return (
                  <div key={`turnaround-${b.id}-${nextB.id}`} className="turnaround-bridge-row">
                    <div className="turnaround-bridge-content">
                      <div className="turnaround-left-group">
                        <div className="turnaround-arrow-flow">
                          <span className="connector-node top-node" />
                          <span className="connector-stem" />
                          <span className="connector-arrow-head">↓</span>
                        </div>
                        <div className="turnaround-text-block">
                          <div className="turnaround-header-line">
                            <span className="turnaround-tag-title">⚡ SAME-DAY TURNAROUND · {formatShort(b.checkOut)}</span>
                          </div>
                          <p className="turnaround-flow-detail">
                            <b>{b.firstName} {b.lastName}</b> departs at {times.checkOutTime} &nbsp;➔&nbsp; <b>{nextB.firstName} {nextB.lastName}</b> arrives at {times.checkInTime}
                          </p>
                        </div>
                      </div>

                      <div className="turnaround-right-group">
                        <span className={`turnaround-hours-badge ${windowHours <= 2 ? "urgent" : ""}`}>
                          ⏱ {windowHours === 0 ? "0h window (Immediate Turnaround)" : `${windowHours} hours to clean`}
                        </span>
                        {b.hasCleaningAgency || nextB.hasCleaningAgency ? (
                          <span className="turnaround-agency-badge">🧹 Agency Scheduled</span>
                        ) : (
                          <span className="turnaround-alert-badge">⚡ Rapid Cleaning Required</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Fragment>
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
          <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}><span>▦</span>Calendar</button>
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
            className={view === "expenses" ? "active" : ""}
            onClick={() => setView("expenses")}
          >
            <span>💸</span>Expenses
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
          <button className={view === "properties" ? "active" : ""} onClick={() => setView("properties")}><span>▦</span>{hostRole === "master" ? "Properties & admins" : "Account"}</button>
        </nav>
        <div className="sidebar-foot">
          <span>Official stay times</span>
          <strong>{times.checkInTime} → {times.checkOutTime}</strong>
          <small>Portal −{times.portalLeadHours}h · Codes −{times.sensitiveRevealMinutes}m · Expires +{times.accessExpiryMinutes}m</small>
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
                  : view === "calendar"
                    ? "Monthly calendar"
                  : view === "metrics"
                    ? "Revenue & Performance Insights"
                    : view === "expenses"
                      ? "Property Expenses"
                      : view === "guide"
                        ? "Guest guide"
                      : view === "templates"
                        ? "Message templates"
                        : view === "faqs"
                          ? "Frequent answers (FAQs)"
                      : view === "gallery"
                            ? "Photo gallery"
                            : view === "properties"
                              ? hostRole === "master" ? "Properties & administrators" : "My account"
                            : "New booking"}
            </h1>
          </div>
          <label className="property-selector"><span>Property</span><select value={selectedPropertyId} onChange={async (event) => { const propertyId = event.target.value; setSelectedPropertyId(propertyId); await loadBookings(propertyId); }}>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
          <button
            className="quick-add"
            onClick={() => {
              setView("new");
              setResult(null);
            }}
          >
            ＋ Add guest
          </button>
          {lastArchived ? <button className="undo-archive" onClick={async()=>{await fetch(`/api/host/bookings/${lastArchived.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({archivedAt:null})});setLastArchived(null);await loadBookings();}}>Undo archive: {lastArchived.firstName}</button> : null}
        </header>
        {view === "overview" && (
          <>
            <div className="operations-command-center">
              <div className="operations-heading"><div><p className="eyebrow">Today’s work</p><h2>Operations command centre</h2></div><span>{todayKey}</span></div>
              <div className="operations-task-grid">
                {[
                  ["Arriving today", arrivingToday, "Prepare access, parking and welcome message"],
                  ["Departing today", departingToday, "Confirm checkout and cleaning handover"],
                  ["Payment still due", paymentDue, "Collect and record outstanding balances"],
                  ["ID / registration missing", registrationMissing, "Complete required guest registration"],
                ].map(([title, list, hint]) => {
                  const taskBookings = list as Booking[];
                  return <article className={title === "Departing today" ? "departing-task-card" : ""} key={title as string}><div><span>{title as string}</span><strong>{taskBookings.length}</strong></div><p>{hint as string}</p>{taskBookings.slice(0,3).map((booking)=><button key={booking.id} onClick={()=>setEditingBooking(booking)}>{booking.firstName} {booking.lastName}<b>Open →</b></button>)}</article>;
                })}
                <article className="gap-task-card">
                  <div><span>Next unoccupied gap</span><strong>{nextUnoccupiedGap.nights ? `${nextUnoccupiedGap.nights} nights` : "Open"}</strong></div>
                  <p>{nextUnoccupiedGap.end ? `${formatShort(nextUnoccupiedGap.start)} → ${formatShort(nextUnoccupiedGap.end)}` : `From ${formatShort(nextUnoccupiedGap.start)} onward`}</p>
                  <button onClick={() => { setView("new"); setStart(nextUnoccupiedGap.start); setEnd(nextUnoccupiedGap.end); setResult(null); }}>Create booking in this gap<b>Open calendar →</b></button>
                </article>
              </div>
            </div>
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
            {(() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const cleaningToday = bookings.filter(
                (b) => !b.revoked && b.hasCleaningAgency && (b.checkOut === todayStr || b.checkIn === todayStr)
              );
              if (cleaningToday.length === 0) return null;
              const target = cleaningToday[0];
              const isDone = target.cleaningStatus === "completed";
              return (
                <div className={`cleaning-today-banner ${isDone ? "is-verified" : "needs-check"}`}>
                  <div className="cleaning-banner-left">
                    <span className="cleaning-icon">🧹</span>
                    <div>
                      <strong>
                        {isDone
                          ? "✓ Agency Cleaning Inspection Verified Today"
                          : `🧹 Agency Cleaning Scheduled Today (${target.cleaningFeeMkd || 750} MKD)`}
                      </strong>
                      <p>
                        Cleaning agency assigned for <b>{target.firstName} {target.lastName}</b>&apos;s stay ({target.checkIn} to {target.checkOut}). Please inspect cleanliness.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-mark-cleaned"
                    onClick={() => handleCleaningAction(target)}
                  >
                    {isDone ? "✓ Mark Scheduled" : "Mark as Checked & Cleaned ✓"}
                  </button>
                </div>
              );
            })()}

            <div className="dashboard-section-title">
              <div>
                <p className="eyebrow">Coming up</p>
                <h2>Next arrivals</h2>
              </div>
              <button onClick={() => setView("bookings")}>View all →</button>
            </div>
            {rows(overviewList)}
            <div className="pro-tip">
              <span>✦</span>
              <div>
                <strong>Timing handled automatically</strong>
                <p>
                  The general guide opens {times.portalLeadHours} hours before check-in. Building and lockbox details reveal {times.sensitiveRevealMinutes} minutes before {times.checkInTime}, and access expires {times.accessExpiryMinutes} minutes after the {times.checkOutTime} checkout in Skopje time.
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
                Create a five-digit guest PIN for this property. Sensitive access details remain hidden until the configured arrival release time.
              </p>
              <ul>
                <li>Simple five-digit guest PIN</li>
                <li>Automatic activation and expiry</li>
                <li>One-click copy, revoke or archive with undo</li>
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
                  <div className="host-name-row">
                    <label>Payment collected<input type="number" step="0.01" min="0" name="paymentCollected" placeholder="0.00" /></label>
                    <label>Currency<select name="currency" defaultValue="EUR"><option>EUR</option><option>MKD</option><option>USD</option></select></label>
                  </div>
                  <label>
                    Private notes
                    <textarea
                      name="notes"
                      rows={2}
                      placeholder="Arrival details, preferences, reminders…"
                    />
                  </label>
                  <div className="cleaning-card-toggle">
                    <div className="cleaning-card-header">
                      <div className="cleaning-card-info">
                        <span className="cleaning-card-icon">🧹</span>
                        <div>
                          <strong>Schedule Cleaning Agency</strong>
                          <p>Assign cleaning agency for checkout day</p>
                        </div>
                      </div>
                      <label className="switch-toggle" htmlFor="new-cleaning-toggle">
                        <input
                          id="new-cleaning-toggle"
                          type="checkbox"
                          name="hasCleaningAgency"
                          defaultChecked={false}
                          onChange={(e) => {
                            const wrap = document.getElementById("new-cleaning-fee-input-wrap");
                            if (wrap) wrap.style.display = e.target.checked ? "grid" : "none";
                          }}
                        />
                        <span className="switch-slider" />
                      </label>
                    </div>
                    <div id="new-cleaning-fee-input-wrap" className="cleaning-card-body" style={{ display: "none" }}>
                      <div className="form-group">
                        <label htmlFor="new-cleaning-fee">Agency Fee (MKD)</label>
                        <input
                          id="new-cleaning-fee"
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
                    Portal opens {times.portalLeadHours}h before arrival · sensitive details reveal {times.sensitiveRevealMinutes}m before check-in · expires {times.accessExpiryMinutes}m after checkout
                  </p>
                  <button className="submit-button" onClick={copyCode}>
                    {copied ? "Property URL + PIN copied" : "Copy property URL + PIN"}
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
        {view === "calendar" && <CalendarView bookings={bookings} propertyId={selectedPropertyId} checkInTime={times.checkInTime} checkOutTime={times.checkOutTime} onOpenBooking={setEditingBooking} />}
        {view === "expenses" && <ExpensesView bookings={bookings} propertyId={selectedPropertyId} />}
        {view === "guide" && <GuideEditor propertyId={selectedPropertyId} />}
        {view === "templates" && <TemplateManager propertyId={selectedPropertyId} onUpdate={() => loadGuide(selectedPropertyId)} />}
        {view === "faqs" && <FaqManager propertyId={selectedPropertyId} />}
        {view === "gallery" && <GalleryManager propertyId={selectedPropertyId} />}
        {view === "properties" && <PropertyManager role={hostRole} properties={properties} onPropertiesChanged={async () => { const propertyId = await loadPortfolio(); await loadBookings(propertyId); }} />}
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
                      setEditingBooking({ ...editingBooking, source: e.target.value as "Airbnb" | "Booking.com" | "Direct" | "Other" })
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
                  <label htmlFor="edit-net">Net payout after platform fees (€)</label>
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

              {/* Cleaning Agency Scheduling Box */}
              <div className={`cleaning-card-toggle ${editingBooking.hasCleaningAgency ? "is-active" : ""}`}>
                <div className="cleaning-card-header">
                  <div className="cleaning-card-info">
                    <span className="cleaning-card-icon">🧹</span>
                    <div>
                      <strong>Agency Cleaning Service</strong>
                      <p>Schedule cleaning agency for checkout day ({editingBooking.checkOut})</p>
                    </div>
                  </div>
                  <label className="switch-toggle" htmlFor="edit-cleaning-toggle">
                    <input
                      id="edit-cleaning-toggle"
                      type="checkbox"
                      checked={Boolean(editingBooking.hasCleaningAgency)}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          hasCleaningAgency: e.target.checked,
                          cleaningFeeMkd: e.target.checked ? (editingBooking.cleaningFeeMkd || 750) : 0,
                          cleaningStatus: e.target.checked ? (editingBooking.cleaningStatus || "scheduled") : "scheduled",
                        })
                      }
                    />
                    <span className="switch-slider" />
                  </label>
                </div>

                {editingBooking.hasCleaningAgency ? (
                  <div className="cleaning-card-body">
                    <div className="form-group">
                      <label htmlFor="edit-cleaning-fee">Agency Fee (MKD)</label>
                      <input
                        id="edit-cleaning-fee"
                        type="number"
                        step="50"
                        min="0"
                        placeholder="750"
                        value={editingBooking.cleaningFeeMkd ?? 750}
                        onChange={(e) =>
                          setEditingBooking({
                            ...editingBooking,
                            cleaningFeeMkd: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="edit-cleaning-status">Inspection Status</label>
                      <select
                        id="edit-cleaning-status"
                        value={editingBooking.cleaningStatus || "scheduled"}
                        onChange={(e) =>
                          setEditingBooking({
                            ...editingBooking,
                            cleaningStatus: e.target.value as "scheduled" | "completed",
                          })
                        }
                      >
                        <option value="scheduled">⏳ Agency Scheduled ({editingBooking.cleaningFeeMkd || 750} MKD)</option>
                        <option value="completed">✓ Inspection Checked & Cleaned</option>
                      </select>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* No-Show / Unpaid Toggle Box */}
              <div className="noshow-edit-box">
                <label className="checkbox-label" htmlFor="edit-noshow-toggle">
                  <input
                    id="edit-noshow-toggle"
                    type="checkbox"
                    checked={Boolean(editingBooking.isNoShow)}
                    onChange={(e) =>
                      setEditingBooking({
                        ...editingBooking,
                        isNoShow: e.target.checked,
                      })
                    }
                  />
                  <span>🛑 Flag as No-Show / Unpaid (Keeps price displayed but excludes from revenue totals)</span>
                </label>
              </div>

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

      {messagingBooking && (
        <GuestMessageModal
          booking={messagingBooking}
          guide={guestGuide}
          propertySlug={properties.find((property) => property.id === (messagingBooking.propertyId || "konios-house"))?.slug}
          onClose={() => setMessagingBooking(null)}
        />
      )}
    </main>
  );
}
