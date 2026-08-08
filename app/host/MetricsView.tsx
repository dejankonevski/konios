"use client";

import { useMemo, useState } from "react";

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

export type MonthlyMetric = {
  monthKey: string;
  monthName: string;
  nights: number;
  daysInMonth: number;
  occupancyPct: number;
  gross: number;
  net: number;
  commission: number;
  bookingCount: number;
};

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

export default function MetricsView({ bookings }: { bookings: Booking[] }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    bookings.forEach((b) => {
      if (b.checkIn) years.add(new Date(`${b.checkIn}T12:00:00`).getFullYear());
      if (b.checkOut) years.add(new Date(`${b.checkOut}T12:00:00`).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  // Unpriced Bookings Count
  const unpricedBookings = useMemo(() => {
    return bookings.filter(
      (b) => !b.revoked && (!b.grossAmount || b.grossAmount === 0)
    );
  }, [bookings]);

  // Main Calculations Engine
  const metrics = useMemo(() => {
    const monthsMap = new Map<string, MonthlyMetric>();

    for (let m = 0; m < 12; m++) {
      const monthNum = String(m + 1).padStart(2, "0");
      const monthKey = `${selectedYear}-${monthNum}`;
      const daysInMonth = new Date(selectedYear, m + 1, 0).getDate();

      monthsMap.set(monthKey, {
        monthKey,
        monthName: `${monthNames[m]}`,
        nights: 0,
        daysInMonth,
        occupancyPct: 0,
        gross: 0,
        net: 0,
        commission: 0,
        bookingCount: 0,
      });
    }

    const validBookings = bookings.filter((b) => !b.revoked);

    // Channel Stats
    const channelStats: Record<string, { nights: number; gross: number; count: number }> = {
      Airbnb: { nights: 0, gross: 0, count: 0 },
      "Booking.com": { nights: 0, gross: 0, count: 0 },
      Direct: { nights: 0, gross: 0, count: 0 },
      Other: { nights: 0, gross: 0, count: 0 },
    };

    validBookings.forEach((b) => {
      const checkInDate = new Date(`${b.checkIn}T00:00:00`);
      const checkOutDate = new Date(`${b.checkOut}T00:00:00`);

      const diffTime = checkOutDate.getTime() - checkInDate.getTime();
      const totalNights = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));

      const gross = Number(b.grossAmount) || 0;
      const net = Number(b.netAmount) || 0;
      const commission = gross - net;

      const nightlyGross = gross / totalNights;
      const nightlyNet = net / totalNights;
      const nightlyCommission = commission / totalNights;

      const curr = new Date(checkInDate);
      const countedMonths = new Set<string>();

      const channelKey =
        b.source && channelStats[b.source] ? b.source : "Other";

      while (curr < checkOutDate) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const monthKey = `${yyyy}-${mm}`;

        const isAfterFrom = !filterFrom || dateStr >= filterFrom;
        const isBeforeTo = !filterTo || dateStr <= filterTo;

        if (isAfterFrom && isBeforeTo) {
          if (monthsMap.has(monthKey)) {
            const mData = monthsMap.get(monthKey)!;
            mData.nights += 1;
            mData.gross += nightlyGross;
            mData.net += nightlyNet;
            mData.commission += nightlyCommission;

            if (!countedMonths.has(monthKey)) {
              mData.bookingCount += 1;
              countedMonths.add(monthKey);
            }

            channelStats[channelKey].nights += 1;
            channelStats[channelKey].gross += nightlyGross;
          }
        }

        curr.setDate(curr.getDate() + 1);
      }
    });

    const monthlyBreakdown = Array.from(monthsMap.values()).map((m) => ({
      ...m,
      occupancyPct: Math.min(100, Math.round((m.nights / m.daysInMonth) * 100)),
    }));

    let totalGross = 0;
    let totalNet = 0;
    let totalCommission = 0;
    let totalNights = 0;
    let totalBookings = 0;
    let maxMonthlyGross = 0;

    monthlyBreakdown.forEach((m) => {
      totalGross += m.gross;
      totalNet += m.net;
      totalCommission += m.commission;
      totalNights += m.nights;
      totalBookings += m.bookingCount;
      if (m.gross > maxMonthlyGross) maxMonthlyGross = m.gross;
    });

    const totalDaysInYear = 365;
    const yearOccupancyPct = Math.min(100, Math.round((totalNights / totalDaysInYear) * 100));
    const adr = totalNights > 0 ? totalGross / totalNights : 0;
    const revPar = totalGross / totalDaysInYear;
    const netMarginPct = totalGross > 0 ? Math.round((totalNet / totalGross) * 100) : 0;
    const commPct = totalGross > 0 ? Math.round((totalCommission / totalGross) * 100) : 0;

    return {
      totalGross,
      totalNet,
      totalCommission,
      totalNights,
      totalBookings,
      yearOccupancyPct,
      adr,
      revPar,
      netMarginPct,
      commPct,
      maxMonthlyGross,
      monthlyBreakdown,
      channelStats,
    };
  }, [bookings, selectedYear, filterFrom, filterTo]);

  function clearFilters() {
    setFilterFrom("");
    setFilterTo("");
    setSelectedYear(currentYear);
  }

  function setPresetRange(preset: "ytd" | "next30" | "all") {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "ytd") {
      setFilterFrom(`${currentYear}-01-01`);
      setFilterTo(todayStr);
      setSelectedYear(currentYear);
    } else if (preset === "next30") {
      const next30 = new Date(today.getTime() + 30 * 86400000);
      setFilterFrom(todayStr);
      setFilterTo(next30.toISOString().split("T")[0]);
      setSelectedYear(today.getFullYear());
    } else if (preset === "all") {
      setFilterFrom("");
      setFilterTo("");
    }
  }

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  return (
    <div className="analytics-container">
      {/* Sleek Top Filter Bar */}
      <div className="analytics-filter-toolbar">
        <div className="toolbar-left">
          <div className="year-selector-pill">
            <span className="pill-label">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="date-input-group">
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              title="Filter From Date"
            />
            <span className="range-dash">to</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              title="Filter To Date"
            />
          </div>

          <div className="preset-buttons">
            <button
              className="preset-chip"
              onClick={() => setPresetRange("next30")}
            >
              Next 30 Days
            </button>
            <button
              className="preset-chip"
              onClick={() => setPresetRange("ytd")}
            >
              Year-to-Date
            </button>
            <button className="preset-chip" onClick={() => setPresetRange("all")}>
              All Time
            </button>
          </div>
        </div>

        {filterFrom || filterTo || selectedYear !== currentYear ? (
          <button className="reset-filter-btn" onClick={clearFilters}>
            ✕ Reset Filters
          </button>
        ) : null}
      </div>

      {/* Unpriced Stays Warning Banner */}
      {unpricedBookings.length > 0 ? (
        <div className="unpriced-warning-banner">
          <span className="warning-icon">💡</span>
          <div>
            <strong>{unpricedBookings.length} booking{unpricedBookings.length > 1 ? "s" : ""} missing price data</strong>
            <p>
              Click on reservations in the Bookings table to enter Gross & Net amounts for 100% precise revenue reporting.
            </p>
          </div>
        </div>
      ) : null}

      {/* Executive Key Performance Indicators Grid */}
      <div className="analytics-kpi-row">
        <div className="insight-card gross-insight">
          <div className="insight-head">
            <span className="insight-label">Gross Revenue</span>
            <span className="insight-badge blue-bg">Total Income</span>
          </div>
          <strong className="insight-val">{formatEuro(metrics.totalGross)}</strong>
          <div className="insight-foot">
            <span>ADR: <b>{formatEuro(metrics.adr)}</b> / night</span>
            <span>RevPAR: <b>{formatEuro(metrics.revPar)}</b></span>
          </div>
        </div>

        <div className="insight-card net-insight">
          <div className="insight-head">
            <span className="insight-label">Net Host Profit</span>
            <span className="insight-badge green-bg">{metrics.netMarginPct}% Margin</span>
          </div>
          <strong className="insight-val">{formatEuro(metrics.totalNet)}</strong>
          <div className="insight-foot">
            <span>Net profit after commissions & cleaning</span>
          </div>
        </div>

        <div className="insight-card comm-insight">
          <div className="insight-head">
            <span className="insight-label">Commissions & Fees</span>
            <span className="insight-badge amber-bg">{metrics.commPct}% Fee Share</span>
          </div>
          <strong className="insight-val">{formatEuro(metrics.totalCommission)}</strong>
          <div className="insight-foot">
            <span>Platform commissions & service costs</span>
          </div>
        </div>

        <div className="insight-card occ-insight">
          <div className="insight-head">
            <span className="insight-label">Occupancy & Nights</span>
            <span className="insight-badge purple-bg">{metrics.yearOccupancyPct}% Occupied</span>
          </div>
          <strong className="insight-val">{metrics.totalNights} nights</strong>
          <div className="insight-foot">
            <span>Across {metrics.totalBookings} stay{metrics.totalBookings !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>

      {/* Visual Chart & Channel Split Grid */}
      <div className="analytics-visual-grid">
        {/* Monthly Revenue Bar Chart */}
        <div className="visual-card chart-card">
          <div className="card-top-title">
            <h3>Monthly Gross Revenue Distribution ({selectedYear})</h3>
            <span className="chart-legend">💶 Gross Revenue Bar</span>
          </div>
          <div className="bar-chart-container">
            {metrics.monthlyBreakdown.map((m) => {
              const heightPct =
                metrics.maxMonthlyGross > 0
                  ? Math.max(6, Math.round((m.gross / metrics.maxMonthlyGross) * 100))
                  : 6;
              return (
                <div key={m.monthKey} className="bar-col" title={`${m.monthName}: ${formatEuro(m.gross)} (${m.nights} nights)`}>
                  <div className="bar-value-label">
                    {m.gross > 0 ? `€${Math.round(m.gross)}` : ""}
                  </div>
                  <div className="bar-track">
                    <div
                      className={`bar-fill ${m.gross > 0 ? "active-bar" : ""}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="bar-x-label">{m.monthName.slice(0, 3)}</span>
                  {m.nights > 0 ? <small className="bar-nights">{m.nights}n</small> : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Booking Channels Split */}
        <div className="visual-card channel-card">
          <h3>Booking Channels Share</h3>
          <div className="channel-list">
            {Object.entries(metrics.channelStats).map(([ch, data]) => {
              const sharePct =
                metrics.totalGross > 0
                  ? Math.round((data.gross / metrics.totalGross) * 100)
                  : metrics.totalNights > 0
                  ? Math.round((data.nights / metrics.totalNights) * 100)
                  : 0;

              return (
                <div key={ch} className="channel-row">
                  <div className="channel-meta">
                    <div className="channel-name-wrap">
                      <span className={`channel-dot ${ch.toLowerCase().replace(".com", "").replace(" ", "-")}`} />
                      <strong>{ch}</strong>
                    </div>
                    <span className="channel-stat-val">
                      <b>{data.nights} nights</b> ({formatEuro(data.gross)})
                    </span>
                  </div>
                  <div className="channel-progress-track">
                    <div
                      className={`channel-progress-bar bar-${ch.toLowerCase().replace(".com", "")}`}
                      style={{ width: `${sharePct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed Monthly Metrics Table */}
      <div className="analytics-table-card">
        <div className="table-card-head">
          <h3>Monthly Financial Performance ({selectedYear})</h3>
          <span className="table-count-badge">12 Calendar Months</span>
        </div>
        <div className="table-responsive">
          <table className="analytics-data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Booked Nights</th>
                <th>Occupancy %</th>
                <th>Gross Revenue (€)</th>
                <th>Commissions (€)</th>
                <th>Net Host Profit (€)</th>
                <th>ADR (€/night)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.monthlyBreakdown.map((m) => {
                const avgRate = m.nights > 0 ? m.gross / m.nights : 0;
                const sharePct =
                  metrics.maxMonthlyGross > 0
                    ? Math.round((m.gross / metrics.maxMonthlyGross) * 100)
                    : 0;
                const hasData = m.nights > 0 || m.gross > 0;

                return (
                  <tr key={m.monthKey} className={hasData ? "row-has-data" : "row-empty"}>
                    <td className="col-month-name">
                      <strong>{m.monthName} {selectedYear}</strong>
                      {m.bookingCount > 0 ? (
                        <small className="col-stays-sub">
                          {m.bookingCount} reservation{m.bookingCount > 1 ? "s" : ""}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      <b>{m.nights}</b> / {m.daysInMonth} nights
                    </td>
                    <td>
                      <span className={`occ-pill ${m.occupancyPct >= 50 ? "high-occ" : m.occupancyPct > 0 ? "mid-occ" : "zero-occ"}`}>
                        {m.occupancyPct}%
                      </span>
                    </td>
                    <td className="col-gross">
                      <div className="gross-bar-cell">
                        <strong>{formatEuro(m.gross)}</strong>
                        {m.gross > 0 ? (
                          <div className="row-mini-bar-track">
                            <div
                              className="row-mini-bar"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="col-comm">{formatEuro(m.commission)}</td>
                    <td className="col-net">
                      <strong>{formatEuro(m.net)}</strong>
                    </td>
                    <td className="col-adr">{m.nights > 0 ? formatEuro(avgRate) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="analytics-total-row">
                <td>Full Year Total ({selectedYear})</td>
                <td><b>{metrics.totalNights}</b> nights</td>
                <td>{metrics.yearOccupancyPct}% avg</td>
                <td className="col-gross">{formatEuro(metrics.totalGross)}</td>
                <td className="col-comm">{formatEuro(metrics.totalCommission)}</td>
                <td className="col-net">{formatEuro(metrics.totalNet)}</td>
                <td className="col-adr">{formatEuro(metrics.adr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
