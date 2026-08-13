"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking } from "@/lib/bookings";
import type { CalendarBlock } from "@/lib/calendar-blocks";

type Props = {
  bookings: Booking[];
  propertyId: string;
  checkInTime: string;
  checkOutTime: string;
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
  actionType?: string;
}

const nightsBetween = (start: string, end: string) =>
  Math.max(0, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000));

const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toISOString().slice(0, 10);
};

export default function AdvisorView({ bookings, propertyId, checkInTime, checkOutTime }: Props) {
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);

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
        description: `You have isolated 1-night gaps (e.g. ${oneNightGaps.slice(0, 3).join(", ")}) between existing bookings. Standard minimum stay settings prevent travelers from booking these dates.`,
        impact: `Potential revenue loss of ~€${oneNightGaps.length * 45} - €${oneNightGaps.length * 70}`,
        actionText: "Enable 1-night minimum stay for gap dates",
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
        description: `Only ${booked30Count} out of the next 30 days are booked. High-demand platforms prioritize listings with momentum. Consider running a 10-15% early bird or weekly discount.`,
        impact: "Improves search algorithm ranking & fills empty calendar slots",
        actionText: "Review pricing & promotions",
      });
    } else if (occupancyRate >= 80) {
      list.push({
        id: "high-occupancy",
        type: "positive",
        badge: "Strong Demand",
        title: `High Occupancy Rate (${occupancyRate}%)`,
        description: `Your calendar is ${occupancyRate}% booked for the next 30 days. High demand indicates you can raise nightly rates for remaining open dates without losing booking velocity.`,
        impact: "Maximize ADR (Average Daily Rate) profit margin",
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
        badge: "Operations Heavy",
        title: `${turnarounds.length} Same-Day Turnaround${turnarounds.length > 1 ? "s" : ""} Upcoming`,
        description: `Guests check out at ${checkOutTime} and new guests arrive at ${checkInTime} on the same day (${turnarounds.map((t) => t.checkOut).slice(0, 2).join(", ")}). Ensure cleaning staff is notified in advance.`,
        impact: "Prevents delayed check-in complaints & maintains 5-star cleanliness ratings",
        actionText: "Verify cleaning team schedule",
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
        badge: "Cashflow",
        title: `${unpaidBookings.length} Upcoming Reservation${unpaidBookings.length > 1 ? "s" : ""} Unpaid`,
        description: `You have ${unpaidBookings.length} upcoming reservation(s) with €${unpaidTotal} pending balance. Send direct Stripe payment links to guests before arrival.`,
        impact: `Collect €${unpaidTotal} in pending revenue`,
        actionText: "Copy Stripe payment links in Bookings tab",
      });
    }

    // 5. Booking Lead Time Insight
    const upcomingWithLeadTime = activeBookings.filter((b) => b.checkIn > todayStr);
    if (upcomingWithLeadTime.length > 3) {
      const avgLeadDays = Math.round(
        upcomingWithLeadTime.reduce((sum, b) => sum + nightsBetween(todayStr, b.checkIn), 0) / upcomingWithLeadTime.length
      );

      list.push({
        id: "lead-time-insight",
        type: "opportunity",
        badge: "Booking Trend",
        title: `Average Booking Lead Time is ${avgLeadDays} Days`,
        description: `Guests are booking your property an average of ${avgLeadDays} days before arrival. Adjust your calendar availability window and promotional rates to capture this advance demand window.`,
        impact: "Optimizes long-term occupancy strategy",
      });
    }

    // 6. Default Positive Hospitality Tip if list is small
    if (list.length < 3) {
      list.push({
        id: "guest-experience-tip",
        type: "positive",
        badge: "Guest Experience",
        title: "Digital Guest Guide Utilization",
        description: "Guests who view their self-check-in PIN and guide 24 hours prior to arrival report 95% smoother check-ins with fewer host calls.",
        impact: "Saves host time & increases 5-star review likelihood",
      });
    }

    return list;
  }, [bookings, blocks, todayStr, checkInTime, checkOutTime]);

  const kpis = useMemo(() => {
    const active = bookings.filter((b) => !b.revoked);
    const totalRevenue = active.reduce((sum, b) => sum + (Number(b.grossAmount) || 0), 0);
    const avgNights = active.length > 0 ? (active.reduce((sum, b) => sum + nightsBetween(b.checkIn, b.checkOut), 0) / active.length).toFixed(1) : "0";
    const directPercentage = active.length > 0 ? Math.round((active.filter((b) => b.source === "Direct").length / active.length) * 100) : 0;

    return { totalRevenue, avgNights, directPercentage };
  }, [bookings]);

  return (
    <div className="advisor-page">
      {/* Header Banner */}
      <div className="advisor-hero">
        <div className="advisor-hero-text">
          <span className="advisor-pill">💡 AI PROPERTY ADVISOR</span>
          <h2>Smart Performance &amp; Revenue Insights</h2>
          <p>
            Real-time automated recommendations to maximize occupancy, eliminate revenue leaks, and streamline operations for{" "}
            <strong>Konios House</strong>.
          </p>
        </div>
        <div className="advisor-stats-cards">
          <div className="advisor-stat-card">
            <span>Avg Length of Stay</span>
            <strong>{kpis.avgNights} nights</strong>
          </div>
          <div className="advisor-stat-card">
            <span>Direct Bookings</span>
            <strong>{kpis.directPercentage}%</strong>
          </div>
        </div>
      </div>

      {/* Insights Grid */}
      <div className="advisor-grid">
        {insights.map((item) => (
          <article key={item.id} className={`advisor-card type-${item.type}`}>
            <div className="advisor-card-top">
              <span className={`advisor-badge badge-${item.type}`}>{item.badge}</span>
            </div>
            <h3>{item.title}</h3>
            <p className="advisor-desc">{item.description}</p>
            <div className="advisor-impact">
              <span>Expected Impact:</span>
              <strong>{item.impact}</strong>
            </div>
            {item.actionText ? (
              <div className="advisor-card-foot">
                <span className="advisor-action-hint">💡 Action: {item.actionText}</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
