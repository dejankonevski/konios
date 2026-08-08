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

  // Extract available years from bookings
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    bookings.forEach((b) => {
      if (b.checkIn) {
        years.add(new Date(`${b.checkIn}T12:00:00`).getFullYear());
      }
      if (b.checkOut) {
        years.add(new Date(`${b.checkOut}T12:00:00`).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  // Pro-rata Monthly Financial Engine
  const metrics = useMemo(() => {
    const monthsMap = new Map<string, MonthlyMetric>();
    for (let m = 0; m < 12; m++) {
      const monthNum = String(m + 1).padStart(2, "0");
      const monthKey = `${selectedYear}-${monthNum}`;
      monthsMap.set(monthKey, {
        monthKey,
        monthName: `${monthNames[m]} ${selectedYear}`,
        nights: 0,
        gross: 0,
        net: 0,
        commission: 0,
        bookingCount: 0,
      });
    }

    const validBookings = bookings.filter((b) => !b.revoked);

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
          }
        }

        curr.setDate(curr.getDate() + 1);
      }
    });

    const monthlyBreakdown = Array.from(monthsMap.values());
    let totalGross = 0;
    let totalNet = 0;
    let totalCommission = 0;
    let totalNights = 0;
    let totalBookings = 0;

    monthlyBreakdown.forEach((m) => {
      totalGross += m.gross;
      totalNet += m.net;
      totalCommission += m.commission;
      totalNights += m.nights;
      totalBookings += m.bookingCount;
    });

    const avgNightlyRate = totalNights > 0 ? totalGross / totalNights : 0;
    const avgProfitPerNight = totalNights > 0 ? totalNet / totalNights : 0;

    return {
      totalGross,
      totalNet,
      totalCommission,
      totalNights,
      totalBookings,
      avgNightlyRate,
      avgProfitPerNight,
      monthlyBreakdown,
    };
  }, [bookings, selectedYear, filterFrom, filterTo]);

  function clearFilters() {
    setFilterFrom("");
    setFilterTo("");
    setSelectedYear(currentYear);
  }

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);

  return (
    <div className="metrics-dashboard">
      <div className="metrics-header-row">
        <div>
          <p className="eyebrow">Financial Analytics</p>
          <h2>Revenue, Profit & Commission Breakdown</h2>
          <p className="metrics-subtitle">
            Night-by-night pro-rated metrics calculated across calendar months and date ranges.
          </p>
        </div>

        {/* Date Filters */}
        <div className="metrics-filter-bar">
          <label className="metrics-filter-item">
            <span>Year</span>
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
          </label>

          <label className="metrics-filter-item">
            <span>From Date</span>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </label>

          <label className="metrics-filter-item">
            <span>To Date</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </label>

          {filterFrom || filterTo || selectedYear !== currentYear ? (
            <button className="metrics-clear-btn" onClick={clearFilters}>
              Reset Filters
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="metrics-kpi-grid">
        <div className="kpi-card gross-card">
          <span className="kpi-title">Gross Revenue</span>
          <strong className="kpi-value">{formatEuro(metrics.totalGross)}</strong>
          <small className="kpi-sub">Total payouts & guest payments</small>
        </div>

        <div className="kpi-card net-card">
          <span className="kpi-title">Net Profit</span>
          <strong className="kpi-value">{formatEuro(metrics.totalNet)}</strong>
          <small className="kpi-sub">Host net revenue after fees</small>
        </div>

        <div className="kpi-card comm-card">
          <span className="kpi-title">Commissions & Fees</span>
          <strong className="kpi-value">{formatEuro(metrics.totalCommission)}</strong>
          <small className="kpi-sub">Gross minus Net total</small>
        </div>

        <div className="kpi-card nights-card">
          <span className="kpi-title">Total Nights Booked</span>
          <strong className="kpi-value">{metrics.totalNights} nights</strong>
          <small className="kpi-sub">Avg {formatEuro(metrics.avgNightlyRate)} / night</small>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="metrics-table-wrapper">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Booked Nights</th>
              <th>Gross Revenue (€)</th>
              <th>Commission & Fees (€)</th>
              <th>Net Profit (€)</th>
              <th>Avg. Nightly Rate</th>
            </tr>
          </thead>
          <tbody>
            {metrics.monthlyBreakdown.map((m) => {
              const avgRate = m.nights > 0 ? m.gross / m.nights : 0;
              const hasData = m.nights > 0 || m.gross > 0;
              return (
                <tr key={m.monthKey} className={hasData ? "has-data-row" : "empty-row"}>
                  <td className="month-col">
                    <strong>{m.monthName}</strong>
                    {m.bookingCount > 0 ? (
                      <small>
                        {m.bookingCount} stay{m.bookingCount > 1 ? "s" : ""}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <b>{m.nights}</b> nights
                  </td>
                  <td className="gross-cell">{formatEuro(m.gross)}</td>
                  <td className="comm-cell">{formatEuro(m.commission)}</td>
                  <td className="net-cell">
                    <strong>{formatEuro(m.net)}</strong>
                  </td>
                  <td>{m.nights > 0 ? formatEuro(avgRate) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="metrics-total-row">
              <td>Total ({selectedYear})</td>
              <td>
                <b>{metrics.totalNights}</b> nights
              </td>
              <td className="gross-cell">{formatEuro(metrics.totalGross)}</td>
              <td className="comm-cell">{formatEuro(metrics.totalCommission)}</td>
              <td className="net-cell">
                <strong>{formatEuro(metrics.totalNet)}</strong>
              </td>
              <td>{formatEuro(metrics.avgNightlyRate)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
