"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking as BaseBooking } from "@/lib/bookings";
import type { CalendarBlock } from "@/lib/calendar-blocks";

type Booking = BaseBooking & {
  accessStatus: "upcoming" | "active" | "expired" | "revoked";
  stayStage?: "before-arrival" | "arrival-ready" | "during-stay" | "checkout-day" | "after-departure";
};

type Props = {
  bookings: Booking[];
  propertyId: string;
  checkInTime: string;
  checkOutTime: string;
  onEditBooking?: (booking: Booking) => void;
};

type InsightType = "critical" | "opportunity" | "pricing" | "occupancy" | "operations" | "positive";

interface Insight {
  id: string;
  type: InsightType;
  badge: string;
  title: string;
  description: string;
  impact: string;
  actionText?: string;
  targetBooking?: Booking;
}

const nightsBetween = (start: string, end: string) =>
  Math.max(0, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000));

const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
};

const isGenericName = (firstName: string, lastName: string) => {
  const name = `${firstName} ${lastName}`.trim().toLowerCase();
  return (
    name.includes("booking.com") ||
    name.includes("airbnb guest") ||
    name.includes("guest") ||
    name === "booking" ||
    name === "airbnb"
  );
};

export default function AdvisorView({ bookings, propertyId, checkInTime, checkOutTime, onEditBooking }: Props) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [filter, setFilter] = useState<"all" | "action" | "pricing" | "operations">("all");

  useEffect(() => {
    let live = true;
    fetch(`/api/host/blocked-dates?propertyId=${encodeURIComponent(propertyId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live && data?.blocks) setBlocks(data.blocks);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [propertyId]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const insights = useMemo(() => {
    const list: Insight[] = [];
    const activeBookings = bookings.filter((b) => !b.revoked).sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    // A. Missing Price Insight Notification
    const missingPriceBookings = activeBookings.filter((b) => b.checkOut >= todayStr && (!b.grossAmount || b.grossAmount === 0));
    missingPriceBookings.forEach((b) => {
      list.push({
        id: `missing-price-${b.id}`,
        type: "critical",
        badge: "Action Required",
        title: `Missing Nightly Price / Rate`,
        description: `Reservation for ${b.firstName} ${b.lastName} (${b.checkIn} → ${b.checkOut}) has no price recorded. Add nightly rate to complete financial reporting.`,
        impact: "Required for monthly revenue & tax compliance",
        actionText: "Fix Rate & Financials ✏️",
        targetBooking: b,
      });
    });

    // B. Missing Tourist Tax Insight Notification
    const missingTaxBookings = activeBookings.filter((b) => b.checkOut >= todayStr && (!b.touristTaxAmount || b.touristTaxAmount === 0));
    missingTaxBookings.forEach((b) => {
      list.push({
        id: `missing-tax-${b.id}`,
        type: "pricing",
        badge: "Action Required",
        title: `Tourist Tax Unrecorded`,
        description: `Stay for ${b.firstName} ${b.lastName} (${b.checkIn} → ${b.checkOut}) lacks local tourist tax entry. Click to enter tax amount.`,
        impact: "Local municipal tax compliance",
        actionText: "Enter Tourist Tax Amount ✏️",
        targetBooking: b,
      });
    });

    // C. Generic Placeholder Name Notification
    const genericNameBookings = activeBookings.filter((b) => b.checkOut >= todayStr && isGenericName(b.firstName, b.lastName));
    genericNameBookings.forEach((b) => {
      list.push({
        id: `generic-name-${b.id}`,
        type: "operations",
        badge: "Action Required",
        title: `Placeholder Guest Name (${b.firstName} ${b.lastName})`,
        description: `This booking is registered as "${b.firstName} ${b.lastName}". Click here to enter the guest's real full name for check-in verification.`,
        impact: "Security verification & guest communication",
        actionText: "Update Guest Name ✏️",
        targetBooking: b,
      });
    });

    // 1. One-Night Gap Detector (High urgency)
    const periods = [
      ...activeBookings.map((b) => ({ start: b.checkIn, end: b.checkOut })),
      ...blocks.map((b) => ({ start: b.start, end: b.end })),
    ].sort((a, b) => a.start.localeCompare(b.start));

    const merged: { start: string; end: string }[] = [];
    periods.forEach((p) => {
      const last = merged.at(-1);
      if (!last || p.start > last.end) merged.push({ ...p });
      else if (p.end > last.end) last.end = p.end;
    });

    const oneNightGaps: string[] = [];
    for (let i = 0; i < merged.length - 1; i++) {
      const gapStart = merged[i].end;
      const gapEnd = merged[i + 1].start;
      if (nightsBetween(gapStart, gapEnd) === 1 && gapStart >= todayStr) {
        oneNightGaps.push(gapStart);
      }
    }

    if (oneNightGaps.length > 0) {
      list.push({
        id: "one-night-gaps",
        type: "critical",
        badge: "Revenue Leak",
        title: `${oneNightGaps.length} Unsold 1-Night Gap${oneNightGaps.length > 1 ? "s" : ""} Detected`,
        description: `Isolated 1-night gaps (e.g. ${oneNightGaps.slice(0, 3).join(", ")}) exist between bookings. Adjust minimum stay settings to allow 1-night bookings.`,
        impact: `Estimated revenue recovery ~€${oneNightGaps.length * 50} - €${oneNightGaps.length * 75}`,
        actionText: "Allow 1-Night Minimum Stay",
      });
    }

    // 2. 30-Day Occupancy Health Check
    const next30Days = Array.from({ length: 30 }, (_, i) => addDays(todayStr, i));
    const booked30Count = next30Days.filter((date) =>
      activeBookings.some((b) => date >= b.checkIn && date < b.checkOut)
    ).length;
    const occupancyRate = Math.round((booked30Count / 30) * 100);

    if (occupancyRate < 40) {
      list.push({
        id: "low-occupancy",
        type: "pricing",
        badge: "Occupancy Alert",
        title: `Low Next 30-Day Occupancy (${occupancyRate}%)`,
        description: `Only ${booked30Count} of the next 30 days are reserved. Running a 10% last-minute promotion can boost booking velocity.`,
        impact: "Boosts search algorithm ranking & fills open calendar slots",
        actionText: "Review Pricing & Promotions",
      });
    } else if (occupancyRate >= 80) {
      list.push({
        id: "high-occupancy",
        type: "positive",
        badge: "Strong Demand",
        title: `High Occupancy Rate (${occupancyRate}%)`,
        description: `Calendar is ${occupancyRate}% booked over the next 30 days. High demand allows increasing nightly rates on remaining dates.`,
        impact: "Maximize Average Daily Rate (ADR) profit margin",
      });
    }

    // 3. Same-Day Turnaround Operations Warning
    const turnarounds = activeBookings.filter((b) => {
      return activeBookings.some((other) => other.id !== b.id && other.checkIn === b.checkOut && b.checkOut >= todayStr);
    });

    if (turnarounds.length > 0) {
      list.push({
        id: "same-day-turnaround",
        type: "operations",
        badge: "Operations Alert",
        title: `${turnarounds.length} Same-Day Turnaround${turnarounds.length > 1 ? "s" : ""}`,
        description: `Checkout (${checkOutTime}) and check-in (${checkInTime}) occur on the same day (${turnarounds.map((t) => t.checkOut).slice(0, 2).join(", ")}).`,
        impact: "Prevents check-in delays & maintains 5-star cleanliness",
        actionText: "Verify Cleaning Schedule",
      });
    }

    // 4. Unpaid Booking Due Alert
    const unpaidBookings = activeBookings.filter(
      (b) => b.grossAmount && (!b.paymentCollected || b.paymentCollected < b.grossAmount) && b.checkIn >= todayStr
    );
    if (unpaidBookings.length > 0) {
      const unpaidTotal = unpaidBookings.reduce((sum, b) => sum + ((Number(b.grossAmount) || 0) - (Number(b.paymentCollected) || 0)), 0);
      list.push({
        id: "unpaid-bookings",
        type: "opportunity",
        badge: "Pending Cashflow",
        title: `${unpaidBookings.length} Upcoming Reservation${unpaidBookings.length > 1 ? "s" : ""} Unpaid`,
        description: `${unpaidBookings.length} upcoming stay(s) have €${unpaidTotal} total pending balance due before arrival.`,
        impact: `Collect €${unpaidTotal} in pending revenue`,
        actionText: "Send Stripe Payment Links",
      });
    }

    // 5. Default Positive Hospitality Tip
    if (list.length < 3) {
      list.push({
        id: "guest-experience-tip",
        type: "positive",
        badge: "Best Practice",
        title: "Digital Guest Guide Utilization",
        description: "Guests who review their self-check-in PIN and guide 24 hours prior to arrival report 95% smoother check-ins.",
        impact: "Saves host time & boosts 5-star reviews",
      });
    }

    return list;
  }, [bookings, blocks, todayStr, checkInTime, checkOutTime]);

  const filteredInsights = useMemo(() => {
    if (filter === "action") return insights.filter((i) => Boolean(i.targetBooking));
    if (filter === "pricing") return insights.filter((i) => i.type === "pricing" || i.type === "critical" || i.type === "opportunity");
    if (filter === "operations") return insights.filter((i) => i.type === "operations" || i.type === "positive");
    return insights;
  }, [insights, filter]);

  const kpis = useMemo(() => {
    const active = bookings.filter((b) => !b.revoked);
    const avgNights = active.length > 0 ? (active.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0) / active.length).toFixed(1) : "0";
    const directPercentage = active.length > 0 ? Math.round((active.filter((b) => b.source === "Direct").length / active.length) * 100) : 0;
    const actionRequiredCount = insights.filter((i) => Boolean(i.targetBooking)).length;
    const totalRevenue = active.reduce((sum, b) => sum + (Number(b.grossAmount) || 0), 0);

    return { avgNights, directPercentage, actionRequiredCount, totalRevenue };
  }, [bookings, insights]);

  const getIconForType = (type: InsightType) => {
    switch (type) {
      case "critical": return "🚨";
      case "pricing": return "💶";
      case "opportunity": return "⚡";
      case "operations": return "🧹";
      case "positive": return "✨";
      default: return "💡";
    }
  };

  return (
    <div className="adv-redesign-wrapper">
      {/* Top Banner KPI Header */}
      <div className="adv-executive-banner">
        <div className="adv-banner-content">
          <div className="adv-pill-tag">
            <span>✨ INTELLIGENT PROPERTY ADVISOR</span>
          </div>
          <h2>Revenue Optimization &amp; Operations Desk</h2>
          <p>Automated real-time recommendations to fix missing data, boost occupancy, and eliminate revenue leaks.</p>
        </div>

        <div className="adv-metrics-strip">
          <div className="adv-metric-box urgent">
            <span>Action Required</span>
            <strong>{kpis.actionRequiredCount}</strong>
            <small>{kpis.actionRequiredCount > 0 ? "Requires host update" : "All clean!"}</small>
          </div>
          <div className="adv-metric-box">
            <span>Booked Revenue</span>
            <strong>€{kpis.totalRevenue}</strong>
            <small>Active bookings</small>
          </div>
          <div className="adv-metric-box">
            <span>Avg Length of Stay</span>
            <strong>{kpis.avgNights} nights</strong>
            <small>Per reservation</small>
          </div>
          <div className="adv-metric-box">
            <span>Direct Bookings</span>
            <strong>{kpis.directPercentage}%</strong>
            <small>Commission saved</small>
          </div>
        </div>
      </div>

      {/* Filter Tabs Navigation */}
      <div className="adv-filter-tabs">
        <button
          type="button"
          className={`adv-tab-chip ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All Recommendations ({insights.length})
        </button>
        <button
          type="button"
          className={`adv-tab-chip ${filter === "action" ? "active" : ""}`}
          onClick={() => setFilter("action")}
        >
          🚨 Action Required ({kpis.actionRequiredCount})
        </button>
        <button
          type="button"
          className={`adv-tab-chip ${filter === "pricing" ? "active" : ""}`}
          onClick={() => setFilter("pricing")}
        >
          💶 Revenue &amp; Pricing
        </button>
        <button
          type="button"
          className={`adv-tab-chip ${filter === "operations" ? "active" : ""}`}
          onClick={() => setFilter("operations")}
        >
          🧹 Operations &amp; Cleanliness
        </button>
      </div>

      {/* Structured Card Grid */}
      <div className="adv-insights-grid">
        {filteredInsights.length === 0 ? (
          <div className="adv-empty-card">
            <span className="empty-icon">🎉</span>
            <h3>No pending items in this category</h3>
            <p>Your property rates, reservations, and operations are currently up-to-date.</p>
          </div>
        ) : (
          filteredInsights.map((item) => (
            <article
              key={item.id}
              className={`adv-card type-${item.type} ${item.targetBooking ? "is-clickable" : ""}`}
              onClick={() => item.targetBooking && onEditBooking?.(item.targetBooking)}
            >
              <div className="adv-card-header">
                <span className="adv-type-icon">{getIconForType(item.type)}</span>
                <span className={`adv-badge-tag badge-${item.type}`}>{item.badge}</span>
              </div>

              <div className="adv-card-body">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>

              <div className="adv-card-impact-box">
                <span className="impact-label">Expected Business Impact:</span>
                <strong className="impact-value">{item.impact}</strong>
              </div>

              {item.actionText ? (
                <div className="adv-card-footer">
                  <button type="button" className="adv-cta-btn">
                    {item.actionText} ➔
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
